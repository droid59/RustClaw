#!/usr/bin/env python3
"""
TradeHermes — Autonomous Trading Agent
Entry point: python main.py [backtest|paper|live|report]
"""
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.logger import setup_logger
from core.config import Config
from loguru import logger


def cmd_backtest(config: Config):
    from core.data_feed import DataFeed
    from backtests.engine import run_backtest
    from strategies.rsi_momentum import generate_signal

    logger.info("=== BACKTEST MODE ===")
    feed = DataFeed(config)
    for symbol in config.markets.symbols:
        logger.info(f"Backtesting {symbol} @ {config.markets.timeframe}")
        df = feed.fetch_ohlcv(symbol, config.markets.timeframe, limit=1000)
        result = run_backtest(df, generate_signal, config.strategy.params, config.risk)
        logger.info(f"\n{result.summary()}")
        out = Path("backtests") / f"result_{symbol.replace('/', '_')}_{config.markets.timeframe}.csv"
        result.trades.to_csv(out, index=False)
        logger.info(f"Trades saved to {out}")


def cmd_paper(config: Config):
    from core.paper_trader import PaperTrader
    import schedule, time

    logger.info("=== PAPER TRADING MODE ===")
    trader = PaperTrader(config)
    tf_map = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400}
    interval = tf_map.get(config.markets.timeframe, 3600)
    trader.run_loop(interval_seconds=interval)


def cmd_report(config: Config):
    from core.metrics import generate_performance_report
    import glob, os
    session_files = glob.glob("reports/trades_*.jsonl")
    if not session_files:
        logger.warning("No trade logs found in reports/")
        return
    latest = max(session_files, key=os.path.getmtime)
    session_id = Path(latest).stem.replace("trades_", "")
    print(generate_performance_report(session_id))


def main():
    parser = argparse.ArgumentParser(description="TradeHermes — Autonomous Trading Agent")
    parser.add_argument("command", choices=["backtest", "paper", "live", "report"],
                        help="Command to run")
    args = parser.parse_args()

    setup_logger(level="INFO")
    config = Config.load()
    logger.info(f"TradeHermes v{config.mode} | strategy={config.strategy.name} | capital=${config.risk.initial_capital:,.0f}")

    if args.command == "backtest":
        cmd_backtest(config)
    elif args.command == "paper":
        if config.mode == "live":
            logger.warning("Config mode is 'live' but you ran 'paper'. Running paper anyway.")
        cmd_paper(config)
    elif args.command == "live":
        logger.error("Live trading not yet enabled. Set mode=live in config.yaml and implement live executor.")
        sys.exit(1)
    elif args.command == "report":
        cmd_report(config)


if __name__ == "__main__":
    main()
