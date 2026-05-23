import ccxt
import pandas as pd
from loguru import logger
from typing import Optional
from core.config import Config


class DataFeed:
    """Fetches OHLCV data from exchange via CCXT."""

    def __init__(self, config: Config):
        self.config = config
        self.exchange = self._init_exchange()

    def _init_exchange(self) -> ccxt.Exchange:
        name = self.config.markets.exchange
        key, secret = self.config.binance_key() if name == "binance" else ("", "")
        exchange_class = getattr(ccxt, name)
        params = {"enableRateLimit": True}
        if key:
            params["apiKey"] = key
            params["secret"] = secret
        ex = exchange_class(params)
        logger.info(f"Exchange initialized: {name} (authenticated={bool(key)})")
        return ex

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 500) -> pd.DataFrame:
        try:
            raw = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(raw, columns=["timestamp", "open", "high", "low", "close", "volume"])
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
            df.set_index("timestamp", inplace=True)
            logger.debug(f"Fetched {len(df)} candles for {symbol} @ {timeframe}")
            return df
        except Exception as e:
            logger.error(f"OHLCV fetch failed for {symbol}: {e}")
            raise

    def fetch_ticker(self, symbol: str) -> dict:
        return self.exchange.fetch_ticker(symbol)

    def fetch_order_book(self, symbol: str, depth: int = 10) -> dict:
        return self.exchange.fetch_order_book(symbol, depth)
