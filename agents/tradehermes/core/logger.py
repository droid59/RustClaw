from loguru import logger
import sys
from pathlib import Path

LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)


def setup_logger(name: str = "tradehermes", level: str = "INFO") -> None:
    logger.remove()
    logger.add(sys.stderr, level=level, colorize=True,
               format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - {message}")
    logger.add(LOG_DIR / f"{name}.log", rotation="50 MB", retention="30 days",
               level="DEBUG", compression="gz")
    logger.add(LOG_DIR / "errors.log", rotation="10 MB", retention="90 days",
               level="ERROR", compression="gz")
