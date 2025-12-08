-- Migration: 00031_create_edit_patterns_table.sql
-- Story: E7.3 - Enable Response Editing and Learning
-- Purpose: Create edit_patterns table for learning analyst editing preferences

-- Create edit_patterns table for learning editing preferences
CREATE TABLE edit_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyst_id UUID REFERENCES auth.users(id) NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('word_replacement', 'phrase_removal', 'tone_adjustment', 'structure_change')),
  original_pattern TEXT NOT NULL,
  replacement_pattern TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,

  -- Each analyst can only have one pattern per type+original combination
  CONSTRAINT unique_pattern_per_analyst UNIQUE (analyst_id, pattern_type, original_pattern)
);

-- Create indexes for efficient queries
CREATE INDEX idx_edit_patterns_analyst ON edit_patterns(analyst_id);
CREATE INDEX idx_edit_patterns_active ON edit_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_edit_patterns_count ON edit_patterns(occurrence_count DESC);
CREATE INDEX idx_edit_patterns_type ON edit_patterns(pattern_type);

-- Enable Row Level Security
ALTER TABLE edit_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own patterns
CREATE POLICY "Users can view their own patterns" ON edit_patterns
  FOR SELECT USING (analyst_id = auth.uid());

-- RLS Policy: Users can insert their own patterns
CREATE POLICY "Users can insert their own patterns" ON edit_patterns
  FOR INSERT WITH CHECK (analyst_id = auth.uid());

-- RLS Policy: Users can update their own patterns (toggle active, update occurrence count)
CREATE POLICY "Users can update their own patterns" ON edit_patterns
  FOR UPDATE USING (analyst_id = auth.uid());

-- RLS Policy: Users can delete their own patterns (optional - for cleanup)
CREATE POLICY "Users can delete their own patterns" ON edit_patterns
  FOR DELETE USING (analyst_id = auth.uid());

COMMENT ON TABLE edit_patterns IS 'Stores learned editing patterns per analyst for few-shot prompt enhancement. Patterns with 3+ occurrences are considered significant.';
COMMENT ON COLUMN edit_patterns.pattern_type IS 'Type of pattern: word_replacement, phrase_removal, tone_adjustment, structure_change';
COMMENT ON COLUMN edit_patterns.occurrence_count IS 'Number of times this pattern has been detected. Patterns with 3+ are used in few-shot prompts.';
COMMENT ON COLUMN edit_patterns.is_active IS 'Whether this pattern should be used in future prompt enhancement. User can toggle off.';