#!/usr/bin/env python3
"""
Create a scanned PDF test file for EC-003 testing.
This creates an image-based PDF (simulating a scanned document) that requires OCR to extract text.
"""

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io
import os

def create_scanned_pdf(output_path: str):
    """Create an image-based PDF that simulates a scanned document."""

    # Create an image with text (simulating a scanned page)
    width, height = 2550, 3300  # 300 DPI for letter size
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)

    # Add some "noise" to make it look more like a scan
    import random
    for _ in range(500):
        x = random.randint(0, width)
        y = random.randint(0, height)
        gray = random.randint(230, 250)
        draw.point((x, y), fill=(gray, gray, gray))

    # Try to use a basic font, fall back to default if not available
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72)
        font_medium = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 48)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Add document content
    y_pos = 200

    # Title
    draw.text((200, y_pos), "ACME Corporation", fill='black', font=font_large)
    y_pos += 120
    draw.text((200, y_pos), "Financial Summary Report", fill='black', font=font_medium)
    y_pos += 100
    draw.text((200, y_pos), "Fiscal Year 2024", fill='black', font=font_small)
    y_pos += 150

    # Horizontal line
    draw.line([(200, y_pos), (2350, y_pos)], fill='black', width=3)
    y_pos += 80

    # Content sections
    content = [
        ("Executive Summary", [
            "ACME Corporation achieved record revenue of $52.3 million in FY2024,",
            "representing a 23% increase over the previous fiscal year.",
            "Net income reached $8.7 million with an EBITDA margin of 18.5%.",
        ]),
        ("Key Financial Metrics", [
            "• Total Revenue: $52,300,000",
            "• Gross Profit: $21,400,000 (40.9% margin)",
            "• Operating Income: $11,200,000",
            "• Net Income: $8,700,000",
            "• EBITDA: $9,670,000",
            "• Cash Position: $15,400,000",
        ]),
        ("Business Highlights", [
            "• Customer base grew by 34% to 2,847 active accounts",
            "• Launched 3 new product lines in Q2 and Q3",
            "• Expanded operations to 5 new markets",
            "• Employee headcount increased from 127 to 189",
        ]),
        ("Risk Factors", [
            "• Customer concentration: Top 5 customers represent 42% of revenue",
            "• Pending litigation with former supplier (estimated exposure: $500K)",
            "• Foreign exchange exposure in European markets",
        ]),
    ]

    for section_title, lines in content:
        # Section header
        draw.text((200, y_pos), section_title, fill='black', font=font_medium)
        y_pos += 80

        # Section content
        for line in lines:
            draw.text((200, y_pos), line, fill='black', font=font_small)
            y_pos += 55

        y_pos += 40

    # Footer
    y_pos = 3100
    draw.text((200, y_pos), "Confidential - For Due Diligence Purposes Only", fill='gray', font=font_small)
    draw.text((1800, y_pos), "Page 1 of 1", fill='gray', font=font_small)

    # Save image to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG', dpi=(300, 300))
    img_bytes.seek(0)

    # Create PDF with the image (this makes it a "scanned" PDF - image-based, not text)
    c = canvas.Canvas(output_path, pagesize=letter)

    # Save the image temporarily
    temp_img_path = output_path.replace('.pdf', '_temp.png')
    img.save(temp_img_path, 'PNG', dpi=(300, 300))

    # Draw the image on the PDF (full page)
    c.drawImage(temp_img_path, 0, 0, width=letter[0], height=letter[1])
    c.save()

    # Clean up temp image
    os.remove(temp_img_path)

    print(f"Created scanned PDF: {output_path}")
    print(f"File size: {os.path.getsize(output_path)} bytes")
    print("\nThis PDF contains image-based text that requires OCR to extract.")
    print("Key content includes:")
    print("  - Company: ACME Corporation")
    print("  - Revenue: $52.3 million")
    print("  - Net Income: $8.7 million")
    print("  - EBITDA margin: 18.5%")
    print("  - Customer count: 2,847")


if __name__ == "__main__":
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, "scanned-financial-report.pdf")
    create_scanned_pdf(output_path)
