from dataclasses import dataclass, field
from typing import Optional
from loguru import logger
from core.config import RiskConfig


@dataclass
class Position:
    symbol: str
    side: str          # "long" | "short"
    entry_price: float
    size: float        # in base currency units
    stop_loss: float
    take_profit: float
    entry_time: str = ""
    pnl: float = 0.0


@dataclass
class RiskManager:
    config: RiskConfig
    equity: float = 0.0
    peak_equity: float = 0.0
    daily_start_equity: float = 0.0
    positions: list = field(default_factory=list)
    trade_log: list = field(default_factory=list)

    def __post_init__(self):
        self.equity = self.config.initial_capital
        self.peak_equity = self.equity
        self.daily_start_equity = self.equity

    @property
    def drawdown(self) -> float:
        if self.peak_equity == 0:
            return 0.0
        return (self.peak_equity - self.equity) / self.peak_equity

    @property
    def daily_loss(self) -> float:
        if self.daily_start_equity == 0:
            return 0.0
        return (self.daily_start_equity - self.equity) / self.daily_start_equity

    def can_trade(self) -> tuple[bool, str]:
        if self.drawdown >= self.config.max_drawdown_limit:
            return False, f"Max drawdown breached: {self.drawdown:.1%}"
        if self.daily_loss >= self.config.daily_loss_limit:
            return False, f"Daily loss limit hit: {self.daily_loss:.1%}"
        if len(self.positions) >= self.config.max_open_positions:
            return False, f"Max positions open: {len(self.positions)}"
        return True, "ok"

    def position_size(self, price: float, stop_loss: float) -> float:
        risk_dollars = self.equity * self.config.max_risk_per_trade
        risk_per_unit = abs(price - stop_loss)
        if risk_per_unit == 0:
            return 0.0
        size = risk_dollars / risk_per_unit
        logger.debug(f"Position size: {size:.4f} units (risk=${risk_dollars:.2f}, sl_dist={risk_per_unit:.4f})")
        return size

    def open_position(self, pos: Position):
        self.positions.append(pos)
        logger.info(f"OPEN {pos.side.upper()} {pos.symbol} @ {pos.entry_price:.4f} | size={pos.size:.4f} | sl={pos.stop_loss:.4f} | tp={pos.take_profit:.4f}")

    def close_position(self, pos: Position, exit_price: float, reason: str = ""):
        pnl_per_unit = (exit_price - pos.entry_price) if pos.side == "long" else (pos.entry_price - exit_price)
        pos.pnl = pnl_per_unit * pos.size
        self.equity += pos.pnl
        self.peak_equity = max(self.peak_equity, self.equity)
        self.positions.remove(pos)
        self.trade_log.append({
            "symbol": pos.symbol,
            "side": pos.side,
            "entry": pos.entry_price,
            "exit": exit_price,
            "size": pos.size,
            "pnl": pos.pnl,
            "reason": reason,
        })
        logger.info(f"CLOSE {pos.side.upper()} {pos.symbol} @ {exit_price:.4f} | PnL={pos.pnl:+.2f} | equity={self.equity:.2f} | reason={reason}")

    def reset_daily(self):
        self.daily_start_equity = self.equity
        logger.info(f"Daily reset | equity={self.equity:.2f} | peak={self.peak_equity:.2f}")
