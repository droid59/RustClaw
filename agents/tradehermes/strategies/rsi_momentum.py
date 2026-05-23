"""
RSI Momentum Strategy v1 — Seed Strategy
----------------------------------------
Signal logic:
  LONG  when RSI crosses up through oversold (30) AND volume > 20-bar MA
  SHORT when RSI crosses down through overbought (70) AND volume > 20-bar MA
  Exit via ATR-based stop-loss (2x ATR) and take-profit (3x ATR)
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Optional
from loguru import logger


@dataclass
class Signal:
    direction: str      # "long" | "short" | "none"
    entry_price: float
    stop_loss: float
    take_profit: float
    confidence: float   # 0-1
    reason: str = ""


def compute_indicators(df: pd.DataFrame, params: dict) -> pd.DataFrame:
    rsi_period = params.get("rsi_period", 14)
    vol_period = params.get("volume_ma_period", 20)
    atr_period = params.get("atr_period", 14)

    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=rsi_period - 1, min_periods=rsi_period).mean()
    avg_loss = loss.ewm(com=rsi_period - 1, min_periods=rsi_period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))

    df["vol_ma"] = df["volume"].rolling(vol_period).mean()
    df["vol_ratio"] = df["volume"] / df["vol_ma"]

    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift()).abs()
    low_close = (df["low"] - df["close"].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df["atr"] = tr.ewm(com=atr_period - 1, min_periods=atr_period).mean()

    df["rsi_prev"] = df["rsi"].shift(1)
    return df


def generate_signal(df: pd.DataFrame, params: dict) -> Signal:
    df = compute_indicators(df.copy(), params)
    if len(df) < 2 or df["rsi"].isna().iloc[-1]:
        return Signal("none", 0, 0, 0, 0, "insufficient data")

    latest = df.iloc[-1]
    prev = df.iloc[-2]

    price = latest["close"]
    atr = latest["atr"]
    sl_mult = params.get("atr_sl_multiplier", 2.0)
    tp_mult = params.get("atr_tp_multiplier", 3.0)
    rsi_os = params.get("rsi_oversold", 30)
    rsi_ob = params.get("rsi_overbought", 70)
    vol_thresh = params.get("volume_ratio_min", 1.0)

    vol_ok = latest["vol_ratio"] >= vol_thresh if not np.isnan(latest["vol_ratio"]) else False

    # RSI crosses up through oversold
    if prev["rsi"] < rsi_os and latest["rsi"] >= rsi_os and vol_ok:
        sl = price - sl_mult * atr
        tp = price + tp_mult * atr
        conf = min(1.0, (latest["vol_ratio"] - 1.0) * 0.5 + 0.6)
        logger.info(f"LONG signal | RSI={latest['rsi']:.1f} vol_ratio={latest['vol_ratio']:.2f}")
        return Signal("long", price, sl, tp, conf, f"RSI oversold cross rsi={latest['rsi']:.1f}")

    # RSI crosses down through overbought
    if prev["rsi"] > rsi_ob and latest["rsi"] <= rsi_ob and vol_ok:
        sl = price + sl_mult * atr
        tp = price - tp_mult * atr
        conf = min(1.0, (latest["vol_ratio"] - 1.0) * 0.5 + 0.6)
        logger.info(f"SHORT signal | RSI={latest['rsi']:.1f} vol_ratio={latest['vol_ratio']:.2f}")
        return Signal("short", price, sl, tp, conf, f"RSI overbought cross rsi={latest['rsi']:.1f}")

    return Signal("none", price, 0, 0, 0, f"no signal rsi={latest['rsi']:.1f}")
