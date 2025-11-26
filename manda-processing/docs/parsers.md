# Document Parser Module

Story: E3.2 - Integrate Docling for Document Parsing

## Overview

The parser module provides document parsing capabilities for the M&A platform, extracting structured content from various document types (PDF, Excel, Word, images) for downstream processing including embeddings generation and AI analysis.

## Architecture

```
src/parsers/
├── __init__.py          # Core models, exceptions, and utilities
├── chunker.py           # Semantic text chunking
├── docling_parser.py    # Main parser using Docling library
├── excel_parser.py      # Excel-specific parser with formula preservation
└── pdf_parser.py        # PDF parser with OCR support
```

### Component Overview

1. **DoclingParser** - Main entry point for document parsing. Routes documents to appropriate handlers and orchestrates the parsing pipeline.

2. **ExcelParser** - Specialized parser for Excel files (.xlsx, .xls) that preserves formulas as text for AI analysis.

3. **PDFParser** - PDF parser using Docling with OCR support for scanned documents.

4. **Chunker** - Semantic text chunker that splits content into embedding-ready chunks while respecting semantic boundaries.

## Supported File Types

| Category | Extensions | MIME Types |
|----------|------------|------------|
| PDF | .pdf | application/pdf |
| Excel | .xlsx, .xls | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel |
| Word | .docx, .doc | application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword |
| Images | .png, .jpg, .jpeg, .tiff, .bmp | image/* |

## Data Models

### ChunkData

Represents a single chunk of parsed content:

```python
from src.parsers import ChunkData

chunk = ChunkData(
    content="Revenue increased by 25% year over year...",
    chunk_type="text",  # "text", "table", "formula", "image"
    chunk_index=0,
    token_count=256,
    page_number=3,       # For PDFs
    sheet_name="Summary", # For Excel
    metadata={"source": "report.xlsx"}
)
```

### TableData

Represents extracted table content:

```python
from src.parsers import TableData

table = TableData(
    content="| Header | Value |\n|--------|-------|\n| A | 100 |",
    rows=2,
    cols=2,
    headers=["Header", "Value"],
    data=[["A", "100"]],
    page_number=1
)
```

### FormulaData

Represents Excel formulas preserved as text:

```python
from src.parsers import FormulaData

formula = FormulaData(
    formula="=SUM(A1:A10)",
    cell_reference="A11",
    sheet_name="Revenue",
    result_value="1500000",
    references=["A1", "A10"]
)
```

### ParseResult

Complete result from parsing a document:

```python
from src.parsers import ParseResult

result = ParseResult(
    chunks=[...],           # List[ChunkData]
    tables=[...],           # List[TableData]
    formulas=[...],         # List[FormulaData]
    metadata={"source": "report.pdf"},
    total_pages=10,         # For PDFs
    total_sheets=3,         # For Excel
    parse_time_ms=2500,
    errors=[],
    warnings=[]
)
```

## Usage

### Basic Parsing

```python
from pathlib import Path
from src.parsers.docling_parser import create_docling_parser

# Create parser
parser = create_docling_parser()

# Parse a document
result = await parser.parse(Path("report.pdf"))

# Access chunks for embedding
for chunk in result.chunks:
    print(f"Chunk {chunk.chunk_index}: {chunk.token_count} tokens")
    print(chunk.content[:200])

# Access extracted formulas (Excel only)
for formula in result.formulas:
    print(f"{formula.cell_reference}: {formula.formula}")
```

### Direct Excel Parsing

```python
from src.parsers.excel_parser import ExcelParser

parser = ExcelParser()
result = await parser.parse(Path("financial_model.xlsx"))

# Formulas are preserved
print(f"Found {len(result.formulas)} formulas")
print(f"Sheets: {result.total_sheets}")
```

### Custom Chunking

```python
from src.parsers.chunker import Chunker

# Custom token limits
chunker = Chunker(
    min_tokens=256,
    max_tokens=512,
    overlap_tokens=25
)

# Chunk text
chunks = chunker.chunk_text(
    long_text,
    chunk_type="text",
    base_metadata={"source": "document.pdf"},
    page_number=1
)

# Chunk tables (keeps intact if possible)
table_chunks = chunker.chunk_table(
    markdown_table,
    chunk_index=0
)
```

### File Type Detection

```python
from src.parsers import get_file_category, is_supported

# Get category
category = get_file_category(".xlsx")  # "excel"
category = get_file_category("application/pdf")  # "pdf"

# Check support
if is_supported(".xlsx"):
    print("Excel files are supported")
```

## Configuration

Parser behavior is controlled via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PARSER_TEMP_DIR` | `/tmp/manda-processing` | Temporary directory for processing |
| `PARSER_OCR_ENABLED` | `true` | Enable OCR for scanned documents |
| `PARSER_MAX_FILE_SIZE_MB` | `100` | Maximum file size to process |
| `CHUNK_MIN_TOKENS` | `512` | Minimum tokens per chunk |
| `CHUNK_MAX_TOKENS` | `1024` | Maximum tokens per chunk |
| `CHUNK_OVERLAP_TOKENS` | `50` | Token overlap between chunks |

## Chunking Strategy

The chunker implements semantic chunking that:

1. **Respects paragraph boundaries** - Never splits mid-paragraph when possible
2. **Preserves table integrity** - Keeps tables as single chunks unless they exceed max tokens
3. **Handles large tables** - Splits by rows while preserving headers in each chunk
4. **Uses token-based limits** - Uses tiktoken (GPT-4 compatible) for accurate token counting
5. **Supports overlap** - Configurable overlap between chunks for context continuity

### Token Limits

- **Minimum**: 512 tokens (ensures chunks have meaningful content)
- **Maximum**: 1024 tokens (optimal for embedding models)
- **Overlap**: 50 tokens (provides context continuity)

## Error Handling

The module defines specific exception types:

```python
from src.parsers import (
    ParseError,
    UnsupportedFileTypeError,
    CorruptFileError,
    FileTooLargeError
)

try:
    result = await parser.parse(path)
except UnsupportedFileTypeError as e:
    print(f"File type not supported: {e}")
except CorruptFileError as e:
    print(f"File is corrupt: {e}")
except FileTooLargeError as e:
    print(f"File exceeds size limit: {e}")
except ParseError as e:
    print(f"Parse error: {e}")
```

## Excel Formula Preservation

The ExcelParser preserves formulas as human-readable text for AI analysis:

**Input (Excel cell B4):**
```
=SUM(B2:B3)
```

**Output (FormulaData):**
```python
FormulaData(
    formula="=SUM(B2:B3)",
    cell_reference="B4",
    sheet_name="Income Statement",
    result_value="40000000",  # If computed
    references=["B2", "B3"]
)
```

This enables AI models to understand the financial relationships in spreadsheets.

## OCR Support

PDF parsing includes OCR for scanned documents:

- Enabled by default (`PARSER_OCR_ENABLED=true`)
- Uses Docling's built-in OCR engine
- Handles mixed documents (native text + scanned pages)

## Testing

Run parser tests:

```bash
# All parser tests
pytest tests/unit/test_parsers -v

# Integration tests
pytest tests/integration/test_parsers -v

# Coverage report
pytest tests/unit/test_parsers --cov=src/parsers --cov-report=term-missing
```

Note: Some tests require the Docling library (`docling>=2.15.0`). Tests gracefully skip when Docling is not installed.

## Dependencies

- `docling>=2.15.0` - Document parsing with OCR
- `openpyxl>=3.1.5` - Excel file reading
- `python-docx>=1.1.2` - Word document reading
- `tiktoken>=0.9.0` - Token counting (GPT-4 compatible)

## Limitations

1. **File Size**: Maximum 100MB by default (configurable)
2. **Password-Protected Files**: Not supported
3. **Macros**: Excel macros are ignored (only formulas are preserved)
4. **Complex Layouts**: Very complex PDF layouts may not parse perfectly
5. **Handwriting**: OCR optimized for printed text, not handwriting
