"""
Vectorised backtest engine.
Usage:
    from backtests.engine import run_backtest
    results = run_backtest(df, strategy_fn, params, risk_config)
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Callable
from core.config import RiskConfig


@dataclass
class BacktestResult:
    equity_curve: pd.Series
    trades: pd.DataFrame
    metrics: dict

    def summary(self) -> str:
        m = self.metrics
        return (
            f"  Trades       : {m['n_trades']}\n"
            f"  Win Rate     : {m['win_rate']:.1%}\n"
            f"  Profit Factor: {m['profit_factor']:.2f}\n"
            f"  Sharpe       : {m['sharpe']:.2f}\n"
            f"  Sortino      : {m['sortino']:.2f}\n"
            f"  Max DD       : {m['max_drawdown']:.1%}\n"
            f"  Calmar       : {m['calmar']:.2f}\n"
            f"  Total Return : {m['total_return']:.2%}\n"
        )


def run_backtest(df: pd.DataFrame, signal_fn: Callable, params: dict,
                 risk: RiskConfig) -> BacktestResult:
    equity = risk.initial_capital
    peak = equity
    equities = []
    trades = []
    position = None  # dict or None

    for i in range(50, len(df)):
        window = df.iloc[:i + 1]
        signal = signal_fn(window, params)
        price = df["close"].iloc[i]
        equities.append(equity)

        if position is not None:
            hit_sl = (position["side"] == "long" and price <= position["sl"]) or \
                     (position["side"] == "short" and price >= position["sl"])
            hit_tp = (position["side"] == "long" and price >= position["tp"]) or \
                     (position["side"] == "short" and price <= position["tp"])

            if hit_sl or hit_tp:
                reason = "tp" if hit_tp else "sl"
                exit_price = position["tp"] if hit_tp else position["sl"]
                pnl_unit = (exit_price - position["entry"]) if position["side"] == "long" else (position["entry"] - exit_price)
                pnl = pnl_unit * position["size"]
                equity += pnl
                peak = max(peak, equity)
                trades.append({"side": position["side"], "entry": position["entry"],
                                "exit": exit_price, "pnl": pnl, "reason": reason,
                                "exit_idx": i})
                position = None

        if position is None and signal.direction in ("long", "short"):
            dd = (peak - equity) / peak if peak > 0 else 0
            if dd < risk.max_drawdown_limit:
                risk_dollars = equity * risk.max_risk_per_trade
                sl_dist = abs(signal.entry_price - signal.stop_loss)
                size = risk_dollars / sl_dist if sl_dist > 0 else 0
                position = {
                    "side": signal.direction,
                    "entry": signal.entry_price,
                    "sl": signal.stop_loss,
                    "tp": signal.take_profit,
                    "size": size,
                }

    equity_series = pd.Series(equities, index=df.index[50:50 + len(equities)])
    trades_df = pd.DataFrame(trades) if trades else pd.DataFrame(
        columns=["side", "entry", "exit", "pnl", "reason", "exit_idx"])
    metrics = _compute_metrics(equity_series, trades_df, risk.initial_capital)
    return BacktestResult(equity_curve=equity_series, trades=trades_df, metrics=metrics)


def _compute_metrics(equity: pd.Series, trades: pd.DataFrame, initial: float) -> dict:
    if len(equity) < 2:
        return {}
    total_return = (equity.iloc[-1] - initial) / initial
    wins = trades[trades["pnl"] > 0] if len(trades) else pd.DataFrame()
    losses = trades[trades["pnl"] <= 0] if len(trades) else pd.DataFrame()
    gross_profit = wins["pnl"].sum() if len(wins) else 0
    gross_loss = abs(losses["pnl"].sum()) if len(losses) else 1e-9
    peak = equity.cummax()
    dd = (peak - equity) / peak
    max_dd = dd.max()

    # Use per-trade returns for risk metrics to avoid sparse-returns distortion
    if len(trades) >= 2:
        trade_returns = trades["pnl"].values / initial
        n_per_year = 252          # assume ~1 trade/day as base freq
        annual_factor = np.sqrt(n_per_year)
        mu = trade_returns.mean()
        sigma = trade_returns.std()
        sharpe = (mu / sigma * annual_factor) if sigma > 0 else 0.0
        neg = trade_returns[trade_returns < 0]
        downside = neg.std() if len(neg) >= 2 else sigma
        sortino = (mu / downside * annual_factor) if downside > 0 else 0.0
    else:
        sharpe = sortino = 0.0

    calmar = (total_return / max_dd) if max_dd > 0 else 0.0
    return {
        "n_trades": len(trades),
        "win_rate": len(wins) / len(trades) if len(trades) > 0 else 0,
        "profit_factor": gross_profit / gross_loss,
        "sharpe": round(sharpe, 3),
        "sortino": round(sortino, 3),
        "max_drawdown": max_dd,
        "calmar": calmar,
        "total_return": total_return,
    }
