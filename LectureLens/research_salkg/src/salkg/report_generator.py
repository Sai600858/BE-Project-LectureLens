"""Pure-Python, zero-dependency PDF document generator for research reports."""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Tuple


class PDFWriter:
    """Generates standard compliant multi-page PDF 1.4 documents from text and tables."""

    def __init__(self, page_width: float = 612.0, page_height: float = 792.0):
        self.width = page_width
        self.height = page_height
        self.margin_x = 54.0
        self.margin_y = 54.0
        self.printable_width = self.width - 2 * self.margin_x
        self.pages: List[str] = []
        self.current_stream: List[str] = []
        self.cursor_y = self.height - self.margin_y

    def _start_new_page(self):
        if self.current_stream:
            self.pages.append("\n".join(self.current_stream))
            self.current_stream = []
        self.cursor_y = self.height - self.margin_y - 20.0

    def _escape_pdf_text(self, text: str) -> str:
        # Map common typography characters to ASCII
        replacements = {
            "\u2022": "*",
            "\u2013": "-",
            "\u2014": "--",
            "\u2018": "'",
            "\u2019": "'",
            "\u201c": '"',
            "\u201d": '"',
            "\u2264": "<=",
            "\u2265": ">=",
            "\u2260": "!=",
            "\u2248": "~=",
            "\u2192": "->",
            "\u2190": "<-",
            "\u03c0": "pi",
            "\u03c4": "tau",
            "\u03c9": "omega",
            "\u03c3": "sigma",
            "\u03b1": "alpha",
            "\u03b2": "beta",
            "\u03b3": "gamma",
            "\u03bb": "lambda",
        }
        for k, v in replacements.items():
            text = text.replace(k, v)

        clean = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        # Filter non-latin1 characters
        return "".join([c if ord(c) < 128 else "?" for c in clean])

    def add_header_footer(self, page_num: int, total_pages: int):
        # Header line
        stream = [
            "0.7 0.7 0.7 RG",
            f"{self.margin_x} {self.height - 40} m {self.width - self.margin_x} {self.height - 40} l S",
            "BT",
            "/F3 8 Tf",
            "0.4 0.4 0.4 rg",
            f"{self.margin_x} {self.height - 35} Td",
            "(SALKG Research Report | Final-Year BE Computer Engineering Project) Tj",
            "ET",
            # Footer
            f"{self.margin_x} 45 m {self.width - self.margin_x} 45 l S",
            "BT",
            "/F1 8 Tf",
            "0.4 0.4 0.4 rg",
            f"{self.width / 2 - 25} 32 Td",
            f"(Page {page_num} of {total_pages}) Tj",
            "ET",
        ]
        return "\n".join(stream)

    def add_title(self, text: str):
        self._check_page_break(50)
        escaped = self._escape_pdf_text(text)
        self.current_stream.extend([
            "BT",
            "/F2 18 Tf",
            "0.1 0.2 0.4 rg",
            f"{self.margin_x} {self.cursor_y} Td",
            f"({escaped}) Tj",
            "ET",
        ])
        self.cursor_y -= 28

    def add_heading_1(self, text: str):
        self._check_page_break(38)
        self.cursor_y -= 10
        escaped = self._escape_pdf_text(text)
        self.current_stream.extend([
            "0.2 0.3 0.5 RG",
            "1 w",
            f"{self.margin_x} {self.cursor_y - 2} m {self.width - self.margin_x} {self.cursor_y - 2} l S",
            "BT",
            "/F2 13 Tf",
            "0.1 0.2 0.3 rg",
            f"{self.margin_x} {self.cursor_y} Td",
            f"({escaped}) Tj",
            "ET",
        ])
        self.cursor_y -= 22

    def add_heading_2(self, text: str):
        self._check_page_break(28)
        self.cursor_y -= 6
        escaped = self._escape_pdf_text(text)
        self.current_stream.extend([
            "BT",
            "/F2 11 Tf",
            "0.15 0.25 0.35 rg",
            f"{self.margin_x} {self.cursor_y} Td",
            f"({escaped}) Tj",
            "ET",
        ])
        self.cursor_y -= 16

    def add_paragraph(self, text: str, is_bold: bool = False, is_italic: bool = False):
        font = "/F2" if is_bold else ("/F3" if is_italic else "/F1")
        font_size = 9.5
        line_height = 13.5
        lines = self._wrap_text(text, font_size, self.printable_width)

        for line in lines:
            self._check_page_break(line_height)
            escaped = self._escape_pdf_text(line)
            self.current_stream.extend([
                "BT",
                f"{font} {font_size} Tf",
                "0.1 0.1 0.1 rg",
                f"{self.margin_x} {self.cursor_y} Td",
                f"({escaped}) Tj",
                "ET",
            ])
            self.cursor_y -= line_height
        self.cursor_y -= 4

    def add_bullet(self, text: str):
        line_height = 13.5
        lines = self._wrap_text(text, 9.5, self.printable_width - 15)
        for idx, line in enumerate(lines):
            self._check_page_break(line_height)
            escaped = self._escape_pdf_text(line)
            prefix = "(*) Tj 15 0 Td " if idx == 0 else "15 0 Td "
            self.current_stream.extend([
                "BT",
                "/F1 9.5 Tf",
                "0.1 0.1 0.1 rg",
                f"{self.margin_x} {self.cursor_y} Td",
                f"{prefix}({escaped}) Tj",
                "ET",
            ])
            self.cursor_y -= line_height
        self.cursor_y -= 2

    def add_table(self, rows: List[List[str]]):
        if not rows:
            return
        col_count = len(rows[0])
        col_w = self.printable_width / max(1, col_count)
        row_h = 16.0

        for r_idx, row in enumerate(rows):
            self._check_page_break(row_h + 4)
            # Background fill for header
            if r_idx == 0:
                self.current_stream.extend([
                    "0.92 0.94 0.96 rg",
                    f"{self.margin_x} {self.cursor_y - 3} {self.printable_width} {row_h} re f",
                ])

            # Draw cells
            for c_idx, cell in enumerate(row):
                cell_text = self._escape_pdf_text(cell[:28])
                x = self.margin_x + c_idx * col_w + 4
                font = "/F2 8.5 Tf" if r_idx == 0 else "/F1 8.0 Tf"
                self.current_stream.extend([
                    "BT",
                    font,
                    "0.1 0.1 0.1 rg",
                    f"{x} {self.cursor_y} Td",
                    f"({cell_text}) Tj",
                    "ET",
                ])

            # Bottom row divider line
            self.current_stream.extend([
                "0.8 0.8 0.8 RG",
                "0.5 w",
                f"{self.margin_x} {self.cursor_y - 3} m {self.width - self.margin_x} {self.cursor_y - 3} l S",
            ])
            self.cursor_y -= row_h
        self.cursor_y -= 8

    def _check_page_break(self, needed_height: float):
        if (self.cursor_y - needed_height) < self.margin_y + 20:
            self._start_new_page()

    def _wrap_text(self, text: str, font_size: float, max_width: float) -> List[str]:
        # Approximate average char width: ~0.52 * font_size for Helvetica
        char_w = font_size * 0.50
        max_chars = max(10, int(max_width / char_w))
        words = text.split()
        if not words:
            return [""]

        lines = []
        curr = []
        curr_len = 0
        for w in words:
            if curr_len + len(w) + 1 <= max_chars:
                curr.append(w)
                curr_len += len(w) + 1
            else:
                if curr:
                    lines.append(" ".join(curr))
                curr = [w]
                curr_len = len(w)
        if curr:
            lines.append(" ".join(curr))
        return lines

    def compile(self) -> bytes:
        if self.current_stream:
            self.pages.append("\n".join(self.current_stream))
            self.current_stream = []

        total_pages = len(self.pages)
        objects: List[str] = []

        def add_obj(content: str) -> int:
            objects.append(content)
            return len(objects)

        # 1. Catalog (Obj 1)
        add_obj("<< /Type /Catalog /Pages 2 0 R >>")

        # 2. Page Tree placeholder (Obj 2)
        pages_tree_idx = len(objects)
        objects.append("")  # will replace

        # Fonts
        f1 = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        f2 = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
        f3 = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>")
        f4 = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

        # Page objects
        page_refs = []
        for p_idx, page_content in enumerate(self.pages):
            header_footer = self.add_header_footer(p_idx + 1, total_pages)
            full_stream = f"{header_footer}\n{page_content}"
            stream_obj = add_obj(
                f"<< /Length {len(full_stream.encode('latin1'))} >>\nstream\n{full_stream}\nendstream"
            )
            page_obj = add_obj(
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.width} {self.height}] "
                f"/Contents {stream_obj} 0 R /Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R /F3 {f3} 0 R /F4 {f4} 0 R >> >> >>"
            )
            page_refs.append(f"{page_obj} 0 R")

        # Fill in Pages tree
        objects[1] = f"<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(page_refs)} >>"

        # Generate binary PDF
        pdf_chunks = ["%PDF-1.4\n"]
        offsets = []
        for i, obj in enumerate(objects):
            offsets.append(sum(len(c.encode("latin1")) for c in pdf_chunks))
            pdf_chunks.append(f"{i + 1} 0 obj\n{obj}\nendobj\n")

        xref_pos = sum(len(c.encode("latin1")) for c in pdf_chunks)
        pdf_chunks.append(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n")
        for off in offsets:
            pdf_chunks.append(f"{off:010d} 00000 n \n")

        pdf_chunks.append(
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
        )

        return "".join(pdf_chunks).encode("latin1")


def generate_all_reports():
    """Reads Markdown report, generates final PDF, and validates reports directory."""
    report_md_path = Path("research_salkg/reports/final_research_report.md")
    pdf_out_path = Path("research_salkg/reports/final_research_report.pdf")

    if not report_md_path.exists():
        raise FileNotFoundError(f"Markdown report not found at: {report_md_path}")

    text = report_md_path.read_text(encoding="utf-8")
    writer = PDFWriter()

    in_table = False
    table_rows: List[List[str]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if in_table and table_rows:
                writer.add_table(table_rows)
                table_rows = []
                in_table = False
            continue

        if line.startswith("|") and line.endswith("|"):
            in_table = True
            # Check if divider line
            if re.match(r"^\|(?:\s*:?-+:?\s*\|)+$", line):
                continue
            cells = [c.strip() for c in line.split("|")[1:-1]]
            table_rows.append(cells)
            continue
        elif in_table:
            writer.add_table(table_rows)
            table_rows = []
            in_table = False

        if line.startswith("# "):
            writer.add_title(line[2:].strip())
        elif line.startswith("## "):
            writer.add_heading_1(line[3:].strip())
        elif line.startswith("### "):
            writer.add_heading_2(line[4:].strip())
        elif line.startswith("- ") or line.startswith("* "):
            writer.add_bullet(line[2:].strip())
        elif line.startswith("> "):
            writer.add_paragraph(line[2:].strip(), is_italic=True)
        else:
            writer.add_paragraph(line)

    if in_table and table_rows:
        writer.add_table(table_rows)

    pdf_bytes = writer.compile()
    pdf_out_path.write_bytes(pdf_bytes)
    print(f"Final research report PDF successfully compiled: {pdf_out_path} ({len(pdf_bytes)} bytes, {len(writer.pages)} pages)")
