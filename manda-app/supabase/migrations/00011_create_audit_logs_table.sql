-- Migration: Create audit_logs table for security event tracking
-- Story: E1.9 - Implement Audit Logging for Security Events
--
-- This table stores tamper-proof audit logs for all security-relevant events.
-- Logs are append-only - UPDATE and DELETE operations are blocked by triggers.

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- Nullable for failed login attempts
    timestamp timestamptz DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    success boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Add table comment
COMMENT ON TABLE audit_logs IS 'Tamper-proof audit logs for security events. Append-only - no updates or deletes allowed.';

-- Add column comments
COMMENT ON COLUMN audit_logs.event_type IS 'Type of event: auth_login, auth_logout, auth_signup, project_created, access_denied, etc.';
COMMENT ON COLUMN audit_logs.user_id IS 'User who triggered the event. NULL for failed login attempts.';
COMMENT ON COLUMN audit_logs.timestamp IS 'When the event occurred.';
COMMENT ON COLUMN audit_logs.ip_address IS 'Client IP address from request headers.';
COMMENT ON COLUMN audit_logs.user_agent IS 'Client user agent string from request headers.';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional event-specific data (JSON).';
COMMENT ON COLUMN audit_logs.success IS 'Whether the event/action succeeded.';

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success) WHERE success = false;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_timestamp ON audit_logs(event_type, timestamp DESC);

-- Create function to prevent audit log modifications (tamper-proof)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted. Event ID: %',
        CASE
            WHEN TG_OP = 'UPDATE' THEN OLD.id::text
            WHEN TG_OP = 'DELETE' THEN OLD.id::text
            ELSE 'unknown'
        END;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent UPDATE on audit_logs
DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs;
CREATE TRIGGER prevent_audit_log_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Create trigger to prevent DELETE on audit_logs
DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs;
CREATE TRIGGER prevent_audit_log_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can INSERT audit logs
-- Note: Application uses service role for audit logging to ensure logs are always created
CREATE POLICY "Service role can insert audit logs"
    ON audit_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- RLS Policy: Service role can SELECT audit logs (for admin dashboard in Phase 2)
CREATE POLICY "Service role can read audit logs"
    ON audit_logs
    FOR SELECT
    TO service_role
    USING (true);

-- RLS Policy: Authenticated users can read their own audit logs
CREATE POLICY "Users can read own audit logs"
    ON audit_logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT, SELECT ON audit_logs TO service_role;
