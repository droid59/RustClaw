"""
Paper trading executor.
Simulates order fills at market price with slippage.
Hooks into RiskManager for position tracking.
"""
import time
from datetime import datetime, timezone
from loguru import logger
from core.risk import RiskManager, Position
from core.config import Config
from core.data_feed import DataFeed
from core.metrics import save_trade, save_equity_snapshot
from strategies.rsi_momentum import generate_signal

SESSION_ID = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
SLIPPAGE = 0.001  # 0.1%


class PaperTrader:
    def __init__(self, config: Config):
        self.config = config
        self.feed = DataFeed(config)
        self.risk = RiskManager(config=config.risk)
        self.session_id = SESSION_ID
        self.iteration = 0

    def tick(self, symbol: str):
        self.iteration += 1
        tf = self.config.markets.timeframe
        df = self.feed.fetch_ohlcv(symbol, tf, limit=200)

        signal = generate_signal(df, self.config.strategy.params)
        price = df["close"].iloc[-1]

        # Check existing positions for exits
        for pos in list(self.risk.positions):
            if pos.symbol != symbol:
                continue
            hit_sl = (pos.side == "long" and price <= pos.stop_loss) or \
                     (pos.side == "short" and price >= pos.stop_loss)
            hit_tp = (pos.side == "long" and price >= pos.take_profit) or \
                     (pos.side == "short" and price <= pos.take_profit)
            if hit_sl or hit_tp:
                reason = "take_profit" if hit_tp else "stop_loss"
                exit_price = price * (1 - SLIPPAGE if pos.side == "long" else 1 + SLIPPAGE)
                self.risk.close_position(pos, exit_price, reason)
                trade = {k: getattr(pos, k) for k in ["symbol", "side", "entry_price", "size"]}
                trade.update({"exit_price": exit_price, "pnl": pos.pnl, "reason": reason})
                save_trade(trade, self.session_id)

        # Open new position on signal
        ok, reason = self.risk.can_trade()
        if ok and signal.direction in ("long", "short"):
            fill_price = price * (1 + SLIPPAGE) if signal.direction == "long" else price * (1 - SLIPPAGE)
            size = self.risk.position_size(fill_price, signal.stop_loss)
            if size > 0:
                pos = Position(
                    symbol=symbol,
                    side=signal.direction,
                    entry_price=fill_price,
                    size=size,
                    stop_loss=signal.stop_loss,
                    take_profit=signal.take_profit,
                    entry_time=datetime.now(timezone.utc).isoformat(),
                )
                self.risk.open_position(pos)
        elif not ok:
            logger.warning(f"Trade blocked: {reason}")

        save_equity_snapshot(self.risk.equity, self.session_id)
        logger.debug(f"Tick #{self.iteration} | equity={self.risk.equity:.2f} | dd={self.risk.drawdown:.2%} | open_pos={len(self.risk.positions)}")

    def run_loop(self, interval_seconds: int = 3600):
        logger.info(f"PaperTrader started | session={self.session_id} | mode=paper | interval={interval_seconds}s")
        import time
        while True:
            for symbol in self.config.markets.symbols:
                try:
                    self.tick(symbol)
                except Exception as e:
                    logger.error(f"Tick error for {symbol}: {e}")
            time.sleep(interval_seconds)
