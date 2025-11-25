-- Migration: 00012_add_gcs_columns_to_documents
-- Description: Add GCS-specific columns to documents table for Google Cloud Storage integration
-- Story: E2.1 - Implement Document Upload to Google Cloud Storage
-- AC: Support GCS bucket storage with folder structure and category organization

-- Add GCS-specific columns
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS gcs_bucket text,
ADD COLUMN IF NOT EXISTS gcs_object_path text,
ADD COLUMN IF NOT EXISTS folder_path text,
ADD COLUMN IF NOT EXISTS category text;

-- Update file_path comment to reflect GCS usage
COMMENT ON COLUMN documents.file_path IS 'Full GCS path: gs://{bucket}/{object_path}';
COMMENT ON COLUMN documents.gcs_bucket IS 'GCS bucket name for the document';
COMMENT ON COLUMN documents.gcs_object_path IS 'Object path within the GCS bucket';
COMMENT ON COLUMN documents.folder_path IS 'User-defined folder path for organization (e.g., "Financial/Q1")';
COMMENT ON COLUMN documents.category IS 'Document category for bucket view organization';

-- Create index for folder_path queries (folder structure view)
CREATE INDEX IF NOT EXISTS idx_documents_folder_path ON documents(deal_id, folder_path);

-- Create index for category queries (bucket view)
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(deal_id, category);

-- Add check constraint for valid categories (M&A due diligence categories)
-- Note: Using a more flexible approach - categories can be extended
ALTER TABLE documents
ADD CONSTRAINT documents_category_check
CHECK (category IS NULL OR category IN (
    'financial',
    'legal',
    'commercial',
    'operational',
    'tax',
    'hr',
    'it',
    'environmental',
    'regulatory',
    'contracts',
    'corporate',
    'insurance',
    'intellectual_property',
    'real_estate',
    'other'
));
