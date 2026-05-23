"""Performance metrics tracker — persists trade log and equity snapshots."""
import json
from pathlib import Path
from datetime import datetime, timezone
from loguru import logger

REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def save_trade(trade: dict, session_id: str):
    path = REPORTS_DIR / f"trades_{session_id}.jsonl"
    with open(path, "a") as f:
        f.write(json.dumps({**trade, "ts": datetime.now(timezone.utc).isoformat()}) + "\n")


def save_equity_snapshot(equity: float, session_id: str):
    path = REPORTS_DIR / f"equity_{session_id}.jsonl"
    with open(path, "a") as f:
        f.write(json.dumps({"equity": equity, "ts": datetime.now(timezone.utc).isoformat()}) + "\n")


def load_trade_log(session_id: str) -> list:
    path = REPORTS_DIR / f"trades_{session_id}.jsonl"
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def generate_performance_report(session_id: str) -> str:
    trades = load_trade_log(session_id)
    if not trades:
        return "No trades recorded yet."
    wins = [t for t in trades if t.get("pnl", 0) > 0]
    losses = [t for t in trades if t.get("pnl", 0) <= 0]
    total_pnl = sum(t.get("pnl", 0) for t in trades)
    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss = abs(sum(t["pnl"] for t in losses)) or 1e-9
    report = (
        f"=== TradeHermes Performance Report ===\n"
        f"Session  : {session_id}\n"
        f"Generated: {datetime.now(timezone.utc).isoformat()}\n"
        f"Trades   : {len(trades)} (W:{len(wins)} L:{len(losses)})\n"
        f"Win Rate : {len(wins)/len(trades):.1%}\n"
        f"Gross P  : {gross_profit:+.2f}\n"
        f"Gross L  : {-gross_loss:+.2f}\n"
        f"Net PnL  : {total_pnl:+.2f}\n"
        f"P.Factor : {gross_profit/gross_loss:.2f}\n"
    )
    logger.info(report)
    return report
