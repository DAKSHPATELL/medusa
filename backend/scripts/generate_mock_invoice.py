"""Generate mock commercial invoice PDF for curl tests."""

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
FIXTURES.mkdir(parents=True, exist_ok=True)
OUT = FIXTURES / "mock_invoice.pdf"


def main() -> None:
    c = canvas.Canvas(str(OUT), pagesize=letter)
    width, height = letter
    y = height - 72

    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, y, "COMMERCIAL INVOICE")
    y -= 36

    c.setFont("Helvetica", 11)
    lines = [
        "Shipper: Shenzhen Apex Electronics Co., Ltd.",
        "Country of Origin: CN",
        "Waybill / Reference: WB-2026-448291",
        "",
        "Description: Laptop components — HS 8471.30",
        "Quantity: 120 units",
        "",
        "Invoice Total (correct): USD 2,400.00",
        "Erroneous declared value on prior filing: USD 240.00",
        "",
        "Preferred contact language: Mandarin (zh)",
        "Broker note: Correct decimal placement before customs release.",
    ]
    for line in lines:
        c.drawString(72, y, line)
        y -= 18

    c.save()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
