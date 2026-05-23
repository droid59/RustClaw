import os
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import List

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


@dataclass
class RiskConfig:
    initial_capital: float = 10000.0
    max_risk_per_trade: float = 0.01
    max_open_positions: int = 3
    max_drawdown_limit: float = 0.15
    daily_loss_limit: float = 0.03


@dataclass
class StrategyConfig:
    name: str = "RSIMomentum_v1"
    params: dict = field(default_factory=dict)


@dataclass
class MarketConfig:
    exchange: str = "binance"
    symbols: List[str] = field(default_factory=lambda: ["BTC/USDT"])
    timeframe: str = "1h"


@dataclass
class Config:
    mode: str = "paper"
    markets: MarketConfig = field(default_factory=MarketConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)

    @classmethod
    def load(cls) -> "Config":
        with open(CONFIG_PATH) as f:
            raw = yaml.safe_load(f)
        c = cls()
        c.mode = raw.get("system", {}).get("mode", "paper")
        m = raw.get("markets", {})
        c.markets = MarketConfig(
            exchange=m.get("exchange", "binance"),
            symbols=m.get("symbols", ["BTC/USDT"]),
            timeframe=m.get("timeframe", "1h"),
        )
        r = raw.get("risk", {})
        c.risk = RiskConfig(
            initial_capital=r.get("initial_capital", 10000),
            max_risk_per_trade=r.get("max_risk_per_trade", 0.01),
            max_open_positions=r.get("max_open_positions", 3),
            max_drawdown_limit=r.get("max_drawdown_limit", 0.15),
            daily_loss_limit=r.get("daily_loss_limit", 0.03),
        )
        s = raw.get("strategy", {})
        c.strategy = StrategyConfig(name=s.get("name", "RSIMomentum_v1"), params=s.get("params", {}))
        return c

    def binance_key(self) -> tuple[str, str]:
        return os.environ.get("BINANCE_API_KEY", ""), os.environ.get("BINANCE_SECRET", "")

    def alpaca_key(self) -> tuple[str, str]:
        return os.environ.get("ALPACA_API_KEY", ""), os.environ.get("ALPACA_SECRET", "")
