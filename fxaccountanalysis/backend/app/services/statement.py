"""Parser for MetaTrader 5 account statement exports.

MT5 can export a report from ``Toolbox -> History -> right click -> Report``.
This module accepts the HTML and XLSX variants of that report and turns the
closed-position rows into :class:`ProviderTrade` records, so trade history can
be imported with no broker credentials and no paid bridge.
"""
from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from html.parser import HTMLParser

from app.providers.base import ProviderError, ProviderTrade

# MT5 reports localise headers; match on the English defaults plus common variants.
HEADER_ALIASES: dict[str, set[str]] = {
    "open_time": {"open time", "time", "opentime"},
    "ticket": {"position", "ticket", "order", "deal"},
    "symbol": {"symbol"},
    "direction": {"type"},
    "volume": {"volume", "size", "lots"},
    "open_price": {"price"},
    "stop_loss": {"s / l", "s/l", "sl", "stop loss"},
    "take_profit": {"t / p", "t/p", "tp", "take profit"},
    "close_time": {"close time", "closetime"},
    "close_price": {"close price"},
    "commission": {"commission"},
    "swap": {"swap"},
    "profit": {"profit"},
}

NUMBER_CLEAN_RE = re.compile(r"[^\d.\-]")


class _TableExtractor(HTMLParser):
    """Collect every table row in the document as a list of cell strings."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row.append("".join(self._cell).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if any(cell for cell in self._row):
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)


def _clean(value: str) -> str:
    return value.replace("\xa0", " ").replace("\u202f", " ").strip()


def parse_number(value: str | float | int | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = _clean(str(value))
    if not text or text in {"-", "—"}:
        return None
    # Strip thousands separators (space or comma) but keep the decimal point.
    text = text.replace(" ", "")
    if "," in text and "." in text:
        text = text.replace(",", "")
    elif text.count(",") == 1 and len(text.split(",")[-1]) in (1, 2):
        text = text.replace(",", ".")
    else:
        text = text.replace(",", "")
    text = NUMBER_CLEAN_RE.sub("", text)
    if not text or text in {"-", ".", "-."}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


DATE_FORMATS = (
    "%Y.%m.%d %H:%M:%S",
    "%Y.%m.%d %H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%d.%m.%Y %H:%M:%S",
    "%d.%m.%Y %H:%M",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
)


def parse_datetime(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = _clean(str(value))
    if not text:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _map_headers(row: list[str]) -> dict[str, int] | None:
    """Return {field: column index} when the row looks like a positions header."""
    mapping: dict[str, int] = {}
    seen: set[str] = set()
    for index, raw in enumerate(row):
        label = _clean(raw).lower()
        if not label:
            continue
        for field, aliases in HEADER_ALIASES.items():
            if label in aliases and field not in seen:
                # "Price" appears twice (open and close); the first is the open.
                mapping[field] = index
                seen.add(field)
                break

    required = {"symbol", "direction", "volume", "open_time", "profit"}
    if not required.issubset(mapping.keys()):
        return None

    # MT5 lists Price twice: the second occurrence is the close price.
    if "close_price" not in mapping:
        price_columns = [
            i for i, raw in enumerate(row) if _clean(raw).lower() in {"price"}
        ]
        if len(price_columns) >= 2:
            mapping["open_price"] = price_columns[0]
            mapping["close_price"] = price_columns[-1]

    # Same for Time (open/close) in the compact report layout.
    time_columns = [i for i, raw in enumerate(row) if _clean(raw).lower() in {"time"}]
    if len(time_columns) >= 2:
        mapping["open_time"] = time_columns[0]
        mapping["close_time"] = time_columns[-1]

    return mapping


def _cell(row: list[str], mapping: dict[str, int], field: str) -> str | None:
    index = mapping.get(field)
    if index is None or index >= len(row):
        return None
    value = _clean(row[index])
    return value or None


def _rows_from_html(payload: bytes) -> list[list[str]]:
    for encoding in ("utf-16", "utf-8", "cp1252"):
        try:
            text = payload.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
        if "<" in text:
            parser = _TableExtractor()
            parser.feed(text)
            if parser.rows:
                return parser.rows
    raise ProviderError("Could not read the statement file as an MT5 HTML report")


def _rows_from_xlsx(payload: bytes) -> list[list[str]]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise ProviderError("XLSX support requires the openpyxl package") from exc

    workbook = load_workbook(io.BytesIO(payload), read_only=True, data_only=True)
    rows: list[list[str]] = []
    for sheet in workbook.worksheets:
        for record in sheet.iter_rows(values_only=True):
            cells = [
                "" if cell is None else (cell.strftime("%Y.%m.%d %H:%M:%S") if isinstance(cell, datetime) else str(cell))
                for cell in record
            ]
            if any(cell.strip() for cell in cells):
                rows.append(cells)
    workbook.close()
    return rows


def parse_statement(payload: bytes, filename: str = "") -> list[ProviderTrade]:
    """Parse an MT5 HTML or XLSX statement into trades.

    Raises :class:`ProviderError` when the file is unreadable or contains no
    recognisable closed positions.
    """
    if not payload:
        raise ProviderError("The uploaded statement file is empty")

    name = filename.lower()
    is_xlsx = payload[:2] == b"PK" or name.endswith((".xlsx", ".xls"))
    rows = _rows_from_xlsx(payload) if is_xlsx else _rows_from_html(payload)

    trades: list[ProviderTrade] = []
    mapping: dict[str, int] | None = None
    seen_tickets: set[str] = set()

    for row in rows:
        header = _map_headers(row)
        if header:
            # A new section header (Positions / Deals) resets the column layout.
            mapping = header
            continue
        if mapping is None:
            continue

        symbol = _cell(row, mapping, "symbol")
        direction_raw = (_cell(row, mapping, "direction") or "").lower()
        open_time = parse_datetime(_cell(row, mapping, "open_time"))
        volume = parse_number(_cell(row, mapping, "volume"))
        profit = parse_number(_cell(row, mapping, "profit"))

        if not symbol or open_time is None or volume is None or profit is None:
            continue
        if "buy" not in direction_raw and "sell" not in direction_raw:
            continue
        # Skip non-trade rows such as balance/credit operations.
        if symbol.lower() in {"balance", "credit", "total", "summary"}:
            continue

        direction = "buy" if "buy" in direction_raw else "sell"
        open_price = parse_number(_cell(row, mapping, "open_price"))
        if open_price is None:
            continue

        close_time = parse_datetime(_cell(row, mapping, "close_time"))
        close_price = parse_number(_cell(row, mapping, "close_price"))
        is_open = close_time is None or close_price is None

        ticket = _cell(row, mapping, "ticket")
        if not ticket or not ticket.replace("-", "").isdigit():
            ticket = f"{symbol}-{int(open_time.timestamp())}-{direction}-{volume}"
        if ticket in seen_tickets:
            continue
        seen_tickets.add(ticket)

        trades.append(
            ProviderTrade(
                ticket=str(ticket),
                symbol=symbol.upper(),
                direction=direction,
                volume=volume,
                open_time=open_time,
                close_time=close_time,
                open_price=open_price,
                close_price=close_price,
                stop_loss=parse_number(_cell(row, mapping, "stop_loss")),
                take_profit=parse_number(_cell(row, mapping, "take_profit")),
                profit=0.0 if is_open else profit,
                commission=parse_number(_cell(row, mapping, "commission")) or 0.0,
                swap=parse_number(_cell(row, mapping, "swap")) or 0.0,
                is_open=is_open,
                comment="imported",
            )
        )

    if not trades:
        raise ProviderError(
            "No closed positions were found in that file. Export from MT5 via "
            "History -> right click -> Report, and upload the HTML or XLSX file."
        )
    return trades
