-- ============================================
-- Contact Messages Table
-- ============================================

CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for sorting by latest
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
    ON contact_messages (created_at DESC);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to INSERT (public form submission)
CREATE POLICY "Allow public insert on contact_messages"
    ON contact_messages
    FOR INSERT
    WITH CHECK (true);

-- Allow authenticated users (admins) to SELECT
CREATE POLICY "Allow admin select on contact_messages"
    ON contact_messages
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Allow authenticated users (admins) to DELETE
CREATE POLICY "Allow admin delete on contact_messages"
    ON contact_messages
    FOR DELETE
    USING (auth.role() = 'authenticated');
