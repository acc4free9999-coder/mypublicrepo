"""Extract unmodified 2023-2024 EUR/USD observations from the official ECB XML."""

import csv
import sys
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/import-ecb.py /path/to/eurofxref-hist.xml")
    root = ET.parse(sys.argv[1]).getroot()
    rows = []
    for element in root.iter():
        day = element.attrib.get("time", "")
        if "2023-01-01" <= day <= "2024-12-31":
            date.fromisoformat(day)
            usd = [child.attrib["rate"] for child in element
                   if child.attrib.get("currency") == "USD"]
            if len(usd) != 1 or not 0.8 < float(usd[0]) < 1.5:
                raise ValueError(f"Missing or implausible EUR/USD observation: {day}")
            rows.append((day, usd[0]))
    rows.sort()
    if len(rows) != 511 or len({day for day, _ in rows}) != len(rows):
        raise ValueError(f"Expected 511 unique observations, got {len(rows)}")
    if rows[0] != ("2023-01-02", "1.0683") or rows[-1] != ("2024-12-31", "1.0389"):
        raise ValueError("Dataset endpoint cross-check failed")
    target = Path(__file__).resolve().parent.parent / "data" / "eurusd-ecb.csv"
    target.parent.mkdir(exist_ok=True)
    with target.open("w", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(("date", "usd_per_eur"))
        writer.writerows(rows)
    print(f"Extracted {len(rows)} observations to {target}")


if __name__ == "__main__":
    main()
