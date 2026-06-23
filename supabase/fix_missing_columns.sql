-- ============================================================
-- FIX: Add missing columns to questionnaire_submissions
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Step 1: Add total_score column if missing
ALTER TABLE questionnaire_submissions 
    ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0;

-- Step 2: Add perception_category column if missing
ALTER TABLE questionnaire_submissions 
    ADD COLUMN IF NOT EXISTS perception_category TEXT;

-- Step 3: Add index for fast filtering
CREATE INDEX IF NOT EXISTS idx_qs_perception_category 
    ON questionnaire_submissions(perception_category);

-- ============================================================
-- Step 4: Backfill total_score from existing JSONB answers
-- (for any rows inserted before the columns were added)
-- ============================================================
UPDATE questionnaire_submissions
SET total_score = (
    SELECT COALESCE(SUM((value->>'score')::int), 0)
    FROM jsonb_each(answers)
)
WHERE total_score = 0 AND answers != '{}';

-- ============================================================
-- Step 5: Backfill perception_category from total_score
-- (mirrors frontend CATEGORY_RANGES logic)
-- ============================================================
UPDATE questionnaire_submissions
SET perception_category = CASE
    WHEN total_score BETWEEN 0 AND 2 THEN 'Promotional Thinker'
    WHEN total_score BETWEEN 3 AND 5 THEN 'Sales Thinker'
    WHEN total_score BETWEEN 6 AND 7 THEN 'Value Thinker'
    WHEN total_score BETWEEN 8 AND 9 THEN 'Strategic Value Architect'
    ELSE 'Promotional Thinker'
END
WHERE perception_category IS NULL;

-- ============================================================
-- Verify: Check that data is now correct
-- ============================================================
SELECT 
    id,
    profile,
    total_score,
    perception_category,
    created_at
FROM questionnaire_submissions
ORDER BY created_at DESC
LIMIT 20;
