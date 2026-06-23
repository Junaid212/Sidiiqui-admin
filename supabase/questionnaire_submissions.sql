-- ============================================================
-- questionnaire_submissions table
-- Run this SQL in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS questionnaire_submissions (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile              TEXT        NOT NULL,
    answers              JSONB       NOT NULL DEFAULT '{}',
    total_score          INTEGER     NOT NULL DEFAULT 0,
    perception_category  TEXT,
    voter_ip             TEXT,
    session_id           TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_qs_profile             ON questionnaire_submissions(profile);
CREATE INDEX IF NOT EXISTS idx_qs_created_at          ON questionnaire_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qs_perception_category ON questionnaire_submissions(perception_category);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_questionnaire_submissions_updated_at
    BEFORE UPDATE ON questionnaire_submissions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security (service role bypasses this)
ALTER TABLE questionnaire_submissions ENABLE ROW LEVEL SECURITY;

-- Allow public INSERT (visitors submit responses)
CREATE POLICY "Allow public insert" ON questionnaire_submissions
    FOR INSERT WITH CHECK (true);

-- Only service role can SELECT (admin reads via service role key)
CREATE POLICY "Service role select" ON questionnaire_submissions
    FOR SELECT USING (auth.role() = 'service_role');

-- ============================================================
-- If the table already exists, run these to add new columns:
-- ============================================================
-- ALTER TABLE questionnaire_submissions ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE questionnaire_submissions ADD COLUMN IF NOT EXISTS perception_category TEXT;
-- CREATE INDEX IF NOT EXISTS idx_qs_perception_category ON questionnaire_submissions(perception_category);
