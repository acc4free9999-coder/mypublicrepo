"""End-to-end smoke test for the free stack (no paid services, no credentials).

Covers both supported free paths:
  * "manual"  - MT5 statement file upload
  * "demo"    - built-in generated sample history
"""
from __future__ import annotations

import os
import tempfile
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/smoke.db")
os.environ.setdefault("MT5_PROVIDER", "manual")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

ROW = """
<tr>
  <td>{open_time}</td><td>{ticket}</td><td>{symbol}</td><td>{direction}</td><td>{volume}</td>
  <td>{open_price}</td><td></td><td></td>
  <td>{close_time}</td><td>{close_price}</td>
  <td>-0.50</td><td>0.00</td><td>{profit}</td>
</tr>
"""


def build_statement() -> bytes:
    """Generate an MT5-style HTML report covering several days and symbols."""
    rows = []
    start = datetime.now(timezone.utc) - timedelta(days=40)
    symbols = ["EURUSD", "GBPUSD", "XAUUSD"]
    for i in range(30):
        opened = start + timedelta(days=i, hours=9)
        closed = opened + timedelta(hours=3)
        symbol = symbols[i % len(symbols)]
        direction = "buy" if i % 2 == 0 else "sell"
        profit = 120.50 if i % 3 else -75.25
        base = 2350.0 if symbol == "XAUUSD" else 1.0850
        rows.append(
            ROW.format(
                open_time=opened.strftime("%Y.%m.%d %H:%M:%S"),
                ticket=900000 + i,
                symbol=symbol,
                direction=direction,
                volume="0.20",
                open_price=f"{base:.4f}",
                close_time=closed.strftime("%Y.%m.%d %H:%M:%S"),
                close_price=f"{base * 1.002:.4f}",
                profit=f"{profit:.2f}",
            )
        )
    header = (
        "<tr><th>Time</th><th>Position</th><th>Symbol</th><th>Type</th><th>Volume</th>"
        "<th>Price</th><th>S / L</th><th>T / P</th><th>Time</th><th>Price</th>"
        "<th>Commission</th><th>Swap</th><th>Profit</th></tr>"
    )
    return f"<html><body><table>{header}{''.join(rows)}</table></body></html>".encode()


def main() -> None:
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert "manual" in health.json()["available_providers"], health.text

        r = client.post(
            "/api/auth/register",
            json={"email": "trader@example.com", "password": "supersecret1", "full_name": "T"},
        )
        assert r.status_code == 201, r.text
        scheme = "Bearer"
        headers = {"Authorization": scheme + " " + r.json()["access_token"]}

        # --- Free path 1: manual account + statement upload (no password at all) ---
        r = client.post(
            "/api/accounts",
            headers=headers,
            json={
                "name": "Exness Real",
                "login": "12345678",
                "server": "Exness-MT5Real",
                "broker": "Exness",
                "provider": "manual",
                "starting_balance": 10000,
            },
        )
        assert r.status_code == 201, r.text
        account = r.json()
        assert account["status"] == "connected"
        assert "password" not in account
        account_id = account["id"]

        r = client.post(
            f"/api/accounts/{account_id}/import",
            headers=headers,
            files={"file": ("report.html", build_statement(), "text/html")},
        )
        assert r.status_code == 200, r.text
        result = r.json()
        assert result["trades_imported"] == 30, result
        print("import:", result["message"])

        # Re-importing the same file must not duplicate trades.
        r = client.post(
            f"/api/accounts/{account_id}/import",
            headers=headers,
            files={"file": ("report.html", build_statement(), "text/html")},
        )
        assert r.status_code == 200 and r.json()["trades_imported"] == 0, r.text

        # A garbage upload should fail cleanly, not 500.
        r = client.post(
            f"/api/accounts/{account_id}/import",
            headers=headers,
            files={"file": ("junk.html", b"not a statement", "text/html")},
        )
        assert r.status_code == 422, r.text

        r = client.get("/api/accounts", headers=headers)
        assert r.status_code == 200
        balance = r.json()[0]["balance"]
        assert balance != 10000, "balance should reflect imported P/L"
        print(f"balance after import: {balance}")

        r = client.get("/api/trades?page_size=5", headers=headers)
        assert r.status_code == 200, r.text
        page = r.json()
        assert page["total"] == 30, page["total"]
        trade_id = page["items"][0]["id"]

        for period in ("day", "week", "month", "year"):
            r = client.get(f"/api/analytics/summary?period={period}", headers=headers)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["buckets"], f"no buckets for {period}"
            assert data["equity_curve"]
            print(
                f"{period:>5}: buckets={len(data['buckets'])} "
                f"win_rate={data['overall']['win_rate']}% net={data['overall']['net_pl']}"
            )

        # Candles come from Yahoo Finance (free, no key).
        r = client.get(f"/api/trades/{trade_id}/chart", headers=headers)
        assert r.status_code == 200, r.text
        chart = r.json()
        assert len(chart["candles"]) > 10, chart["candles"]
        assert len(chart["markers"]) == 2
        print(f"chart: tf={chart['timeframe']} candles={len(chart['candles'])}")

        r = client.get("/api/trades/symbols", headers=headers)
        assert r.status_code == 200 and r.json()
        print("symbols:", r.json())

        r = client.get("/api/trades?result=win&direction=buy", headers=headers)
        assert r.status_code == 200 and r.json()["total"] > 0

        # --- Free path 2: demo provider still works for exploring the app ---
        r = client.post(
            "/api/accounts",
            headers=headers,
            json={
                "name": "Sample",
                "login": "99999999",
                "server": "Demo",
                "broker": "Demo",
                "provider": "demo",
            },
        )
        assert r.status_code == 201, r.text
        demo_id = r.json()["id"]
        r = client.post(f"/api/accounts/{demo_id}/sync", headers=headers)
        assert r.status_code == 200 and r.json()["success"], r.text
        print("demo sync:", r.json()["message"])

    print("SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
