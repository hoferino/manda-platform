# E2E Test Fixtures

This directory contains test fixtures for E2E tests.

## Required Fixtures

### sample-cim.pdf
A sample Confidential Information Memorandum (CIM) PDF for testing document upload and processing.

**Requirements:**
- 10+ pages
- Contains financial data (revenue, EBITDA, etc.)
- PDF format (not password protected)

**To create:**
1. Use an existing sample CIM document
2. Or generate a test PDF with sample financial data

### financial-statements.xlsx
An Excel file with financial statements for testing Excel upload.

**Requirements:**
- Multiple sheets (Income Statement, Balance Sheet, Cash Flow)
- Numerical data for analysis

## Usage

Place the files in this directory before running smoke tests:

```bash
# From manda-app directory
npm run test:smoke
```

## Environment Variables

Set these for authenticated tests:

```bash
export E2E_TEST_EMAIL="your-test-email@example.com"
export E2E_TEST_PASSWORD="your-test-password"
```
