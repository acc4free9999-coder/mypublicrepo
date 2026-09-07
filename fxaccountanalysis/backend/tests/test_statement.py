"""Tests for the MT5 statement parser and Yahoo symbol mapping (free stack)."""
from __future__ import annotations

import io

from app.providers.base import ProviderError
from app.services.statement import parse_number, parse_statement
from app.services.yahoo import to_yahoo_symbol

# Mirrors the structure MT5 produces for History -> Report (HTML).
MT5_HTML = """
<html><body><table>
<tr><th colspan=13>Trade Report</th></tr>
<tr><th>Positions</th></tr>
<tr>
  <th>Time</th><th>Position</th><th>Symbol</th><th>Type</th><th>Volume</th>
  <th>Price</th><th>S / L</th><th>T / P</th><th>Time</th><th>Price</th>
  <th>Commission</th><th>Swap</th><th>Profit</th>
</tr>
<tr>
  <td>2026.01.05 08:30:00</td><td>123456789</td><td>EURUSD</td><td>buy</td><td>0.50</td>
  <td>1.08500</td><td>1.08000</td><td>1.09500</td>
  <td>2026.01.05 11:45:00</td><td>1.09120</td>
  <td>-3.50</td><td>-0.20</td><td>310.00</td>
</tr>
<tr>
  <td>2026.01.06 14:00:00</td><td>123456790</td><td>XAUUSD</td><td>sell</td><td>1.00</td>
  <td>2 350.40</td><td>2 380.00</td><td>2 300.00</td>
  <td>2026.01.07 09:15:00</td><td>2 372.10</td>
  <td>-7.00</td><td>1.10</td><td>-2 170.00</td>
</tr>
<tr>
  <td>2026.01.08 10:00:00</td><td>123456791</td><td>GBPUSD</td><td>buy</td><td>0.10</td>
  <td>1.27000</td><td></td><td></td>
  <td></td><td></td>
  <td>0.00</td><td>0.00</td><td>0.00</td>
</tr>
<tr><td>balance</td><td>999</td><td>balance</td><td>balance</td><td>0</td>
  <td>0</td><td></td><td></td><td></td><td></td><td>0</td><td>0</td><td>5000.00</td></tr>
</table></body></html>
"""


def test_parses_closed_and_open_positions() -> None:
    trades = parse_statement(MT5_HTML.encode(), "report.html")
    assert len(trades) == 3, [t.ticket for t in trades]

    eurusd = next(t for t in trades if t.symbol == "EURUSD")
    assert eurusd.direction == "buy"
    assert eurusd.volume == 0.5
    assert eurusd.open_price == 1.085
    assert eurusd.close_price == 1.0912
    assert eurusd.stop_loss == 1.08
    assert eurusd.take_profit == 1.095
    assert eurusd.profit == 310.0
    assert eurusd.commission == -3.5
    assert eurusd.swap == -0.2
    assert eurusd.is_open is False
    assert eurusd.open_time.year == 2026

    # Thousands separators and negative values must survive parsing.
    gold = next(t for t in trades if t.symbol == "XAUUSD")
    assert gold.open_price == 2350.40
    assert gold.profit == -2170.00
    assert gold.direction == "sell"

    # A row with no close time/price is an open position.
    gbp = next(t for t in trades if t.symbol == "GBPUSD")
    assert gbp.is_open is True
    assert gbp.close_price is None


def test_balance_rows_are_ignored() -> None:
    trades = parse_statement(MT5_HTML.encode(), "report.html")
    assert all(t.symbol.lower() != "balance" for t in trades)


def test_reimport_is_idempotent_by_ticket() -> None:
    first = parse_statement(MT5_HTML.encode(), "report.html")
    second = parse_statement(MT5_HTML.encode(), "report.html")
    assert [t.ticket for t in first] == [t.ticket for t in second]
    assert len({t.ticket for t in first}) == len(first)


def test_rejects_unusable_file() -> None:
    for payload, name in [(b"", "x.html"), (b"nothing here", "x.html")]:
        try:
            parse_statement(payload, name)
        except ProviderError:
            continue
        raise AssertionError(f"expected ProviderError for {name}")


def test_number_parsing_variants() -> None:
    assert parse_number("1 234.56") == 1234.56
    assert parse_number("1,234.56") == 1234.56
    assert parse_number("-2 170.00") == -2170.0
    assert parse_number("1,50") == 1.5
    assert parse_number("") is None
    assert parse_number("-") is None


def test_xlsx_statement() -> None:
    from openpyxl import Workbook

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(
        [
            "Time", "Position", "Symbol", "Type", "Volume", "Price", "S / L",
            "T / P", "Time", "Price", "Commission", "Swap", "Profit",
        ]
    )
    sheet.append(
        [
            "2026.02.01 09:00:00", "555000111", "USDJPY", "sell", 0.2, 151.20,
            152.0, 150.0, "2026.02.01 12:00:00", 150.80, -1.2, 0.0, 53.0,
        ]
    )
    buffer = io.BytesIO()
    workbook.save(buffer)

    trades = parse_statement(buffer.getvalue(), "report.xlsx")
    assert len(trades) == 1
    assert trades[0].symbol == "USDJPY"
    assert trades[0].direction == "sell"
    assert trades[0].profit == 53.0


def test_yahoo_symbol_mapping() -> None:
    assert to_yahoo_symbol("EURUSD") == "EURUSD=X"
    assert to_yahoo_symbol("XAUUSD") == "GC=F"
    assert to_yahoo_symbol("BTCUSD") == "BTC-USD"
    # Exness-style broker suffixes must be stripped.
    assert to_yahoo_symbol("EURUSDm") == "EURUSD=X"
    assert to_yahoo_symbol("XAUUSD.raw") == "GC=F"
    assert to_yahoo_symbol("GBPUSDc") == "GBPUSD=X"
