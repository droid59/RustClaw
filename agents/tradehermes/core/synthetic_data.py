"""
Synthetic OHLCV generator using Geometric Brownian Motion.
Used for CI / sandboxed environments without network access.
Parameters calibrated to approximate real US equity hourly bars.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta


_PROFILES = {
    "SPY":  {"mu": 0.00012, "sigma": 0.0035, "start_price": 480.0,  "avg_vol": 25_000_000},
    "QQQ":  {"mu": 0.00015, "sigma": 0.0042, "start_price": 430.0,  "avg_vol": 18_000_000},
    "AAPL": {"mu": 0.00010, "sigma": 0.0045, "start_price": 195.0,  "avg_vol": 12_000_000},
    "BTC/USDT": {"mu": 0.00020, "sigma": 0.0120, "start_price": 65000.0, "avg_vol": 5_000},
}
_DEFAULT = {"mu": 0.00010, "sigma": 0.0040, "start_price": 100.0, "avg_vol": 1_000_000}


def generate(symbol: str, timeframe: str = "1h", n_bars: int = 2000,
             seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    p = _PROFILES.get(symbol, _DEFAULT)
    mu, sigma, s0 = p["mu"], p["sigma"], p["start_price"]

    dt = 1.0
    returns = (mu - 0.5 * sigma ** 2) * dt + sigma * rng.standard_normal(n_bars)
    prices = s0 * np.exp(np.cumsum(returns))

    # OHLC from close
    intrabar_vol = sigma * 0.4
    opens = np.roll(prices, 1); opens[0] = s0
    highs = prices * np.exp(np.abs(rng.normal(0, intrabar_vol, n_bars)))
    lows = prices * np.exp(-np.abs(rng.normal(0, intrabar_vol, n_bars)))
    highs = np.maximum(highs, np.maximum(opens, prices))
    lows = np.minimum(lows, np.minimum(opens, prices))

    # Volume: log-normal around mean, with occasional spikes
    base_vol = rng.lognormal(np.log(p["avg_vol"]), 0.5, n_bars)
    spike_mask = rng.random(n_bars) < 0.05
    base_vol[spike_mask] *= rng.uniform(2, 5, spike_mask.sum())
    volume = base_vol.astype(float)

    freq_map = {"1m": "min", "5m": "5min", "15m": "15min", "30m": "30min",
                "1h": "h", "4h": "4h", "1d": "D"}
    freq = freq_map.get(timeframe, "h")
    start = datetime(2023, 1, 1, 9, 30, tzinfo=timezone.utc)
    idx = pd.date_range(start=start, periods=n_bars, freq=freq)

    df = pd.DataFrame({"open": opens, "high": highs, "low": lows,
                        "close": prices, "volume": volume}, index=idx)
    df.index.name = "timestamp"
    return df
