"""
DataFeed — supports both yfinance (free, no key) and Alpaca (live/paper, needs key).
yfinance is the default for backtesting US stocks without API credentials.
"""
import pandas as pd
import os
from loguru import logger
from core.config import Config


# yfinance timeframe map
_YF_INTERVAL = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1wk",
}
# yfinance period to get ~limit bars at given tf
_YF_PERIOD = {
    "1m": "7d", "5m": "60d", "15m": "60d", "30m": "60d",
    "1h": "730d", "4h": "730d", "1d": "5y", "1w": "10y",
}


class DataFeed:
    def __init__(self, config: Config):
        self.config = config
        source = getattr(config.markets, "data_source", "yfinance")
        self.source = source
        if source == "yfinance":
            import yfinance as yf
            import logging as _logging
            _logging.getLogger("yfinance").setLevel(_logging.CRITICAL)
            self._yf = yf
            logger.info("DataFeed initialized: yfinance (public, no auth)")
        elif source == "alpaca":
            self._init_alpaca()
        else:
            raise ValueError(f"Unknown data_source: {source}")

    def _init_alpaca(self):
        from alpaca.data.historical import StockHistoricalDataClient
        key = os.environ.get("ALPACA_API_KEY", "")
        secret = os.environ.get("ALPACA_SECRET", "")
        if not key:
            logger.warning("ALPACA_API_KEY not set — Alpaca data may be limited")
        self._alpaca = StockHistoricalDataClient(api_key=key or None, secret_key=secret or None)
        logger.info(f"DataFeed initialized: Alpaca (authenticated={bool(key)})")

    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 500) -> pd.DataFrame:
        if self.source == "yfinance":
            return self._fetch_yfinance(symbol, timeframe, limit)
        return self._fetch_alpaca(symbol, timeframe, limit)

    def _fetch_yfinance(self, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
        interval = _YF_INTERVAL.get(timeframe, "1h")
        period = _YF_PERIOD.get(timeframe, "730d")
        try:
            ticker = self._yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval, auto_adjust=True)
            if df.empty:
                raise ValueError(f"No data returned for {symbol}")
            df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.columns = ["open", "high", "low", "close", "volume"]
            df.index.name = "timestamp"
            if df.index.tz is None:
                df.index = df.index.tz_localize("UTC")
            else:
                df.index = df.index.tz_convert("UTC")
            df = df.tail(limit)
            logger.debug(f"yfinance: {len(df)} bars for {symbol} @ {interval}")
            return df
        except Exception as e:
            logger.warning(f"yfinance fetch failed for {symbol}: {e} — falling back to synthetic data")
            from core.synthetic_data import generate
            df = generate(symbol, timeframe, limit)
            logger.info(f"Synthetic data: {len(df)} bars for {symbol} @ {timeframe}")
            return df

    def _fetch_alpaca(self, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
        from alpaca.data.requests import StockBarsRequest
        from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
        from datetime import datetime, timedelta, timezone
        tf_map = {"1m": (1, TimeFrameUnit.Minute), "5m": (5, TimeFrameUnit.Minute),
                  "15m": (15, TimeFrameUnit.Minute), "1h": (1, TimeFrameUnit.Hour),
                  "1d": (1, TimeFrameUnit.Day)}
        amount, unit = tf_map.get(timeframe, (1, TimeFrameUnit.Hour))
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=365 * 2)
        req = StockBarsRequest(symbol_or_symbols=symbol,
                               timeframe=TimeFrame(amount, unit),
                               start=start, end=end, limit=limit)
        bars = self._alpaca.get_stock_bars(req).df
        df = bars.reset_index()
        df = df.rename(columns={"open": "open", "high": "high", "low": "low",
                                 "close": "close", "volume": "volume", "timestamp": "timestamp"})
        df = df[["timestamp", "open", "high", "low", "close", "volume"]].set_index("timestamp")
        logger.debug(f"Alpaca: {len(df)} bars for {symbol}")
        return df

    def fetch_ticker(self, symbol: str) -> dict:
        if self.source == "yfinance":
            t = self._yf.Ticker(symbol)
            info = t.fast_info
            return {"last": info.last_price, "symbol": symbol}
        raise NotImplementedError("ticker only supported for yfinance currently")
