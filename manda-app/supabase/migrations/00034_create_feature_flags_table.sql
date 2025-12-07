-- Migration: 00034_create_feature_flags_table
-- Description: Create feature_flags table for safe rollout of dangerous operations
-- Story: E7.1 - Implement Finding Correction via Chat
-- AC: #12, #13, #14, #15 (Source error cascade gated by feature flags)

-- Create feature_flags table for runtime feature toggling
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default flags for Learning Loop (E7)
INSERT INTO feature_flags (flag_name, enabled, description, risk_level) VALUES
    ('sourceValidationEnabled', true, 'Show source citation before accepting corrections', 'low'),
    ('sourceErrorCascadeEnabled', false, 'Enable full cascade when source document has errors', 'high'),
    ('autoFlagDocumentFindings', false, 'Auto-flag all findings from error document', 'high'),
    ('autoReembedCorrections', true, 'Regenerate embeddings for corrected findings', 'medium'),
    ('neo4jSyncEnabled', true, 'Sync corrections to Neo4j knowledge graph', 'medium'),
    ('confidenceAdjustmentEnabled', true, 'Adjust confidence scores on validation/rejection', 'low'),
    ('patternDetectionEnabled', true, 'Detect edit patterns from response edits', 'low')
ON CONFLICT (flag_name) DO NOTHING;

-- Create index for flag lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);

-- Enable Row Level Security
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read feature flags
CREATE POLICY "Anyone can read feature flags" ON feature_flags
    FOR SELECT USING (true);

-- RLS Policy: Authenticated users can update flags
-- Note: In production, this should be restricted to admin role
CREATE POLICY "Authenticated users can update flags" ON feature_flags
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Create trigger function to log feature flag changes
CREATE OR REPLACE FUNCTION log_feature_flag_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if enabled actually changed
    IF OLD.enabled IS DISTINCT FROM NEW.enabled THEN
        INSERT INTO audit_logs (event_type, entity_type, entity_id, user_id, details)
        VALUES (
            'feature_flag_changed',
            'feature_flags',
            NEW.id,
            auth.uid(),
            jsonb_build_object(
                'flag_name', NEW.flag_name,
                'old_enabled', OLD.enabled,
                'new_enabled', NEW.enabled,
                'risk_level', NEW.risk_level
            )
        );
    END IF;

    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for feature flag audit
DROP TRIGGER IF EXISTS feature_flag_audit ON feature_flags;
CREATE TRIGGER feature_flag_audit
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION log_feature_flag_change();

-- Add comments for documentation
COMMENT ON TABLE feature_flags IS 'Runtime feature flags for safe rollout of dangerous operations';
COMMENT ON COLUMN feature_flags.flag_name IS 'Unique identifier for the feature flag';
COMMENT ON COLUMN feature_flags.enabled IS 'Whether the feature is currently enabled';
COMMENT ON COLUMN feature_flags.risk_level IS 'Risk level: low, medium, or high';
COMMENT ON COLUMN feature_flags.updated_by IS 'User who last changed this flag';
