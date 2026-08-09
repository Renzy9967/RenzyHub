-- Run this ONCE against the existing RenzyHub database.
-- It upgrades the original Linkvertise-only checkpoint table
-- without deleting existing checkpoints.

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS url TEXT;

UPDATE checkpoints
SET provider = COALESCE(provider, 'linkvertise'),
    url = COALESCE(url, linkvertise_url)
WHERE provider IS NULL OR url IS NULL;

ALTER TABLE checkpoints
  ALTER COLUMN provider SET DEFAULT 'linkvertise';

ALTER TABLE checkpoints
  ALTER COLUMN provider SET NOT NULL;

ALTER TABLE checkpoints
  DROP CONSTRAINT IF EXISTS checkpoints_provider_check;

ALTER TABLE checkpoints
  ADD CONSTRAINT checkpoints_provider_check
  CHECK (provider IN ('linkvertise', 'lootlabs'));

ALTER TABLE checkpoints
  DROP CONSTRAINT IF EXISTS checkpoints_url_check;

ALTER TABLE checkpoints
  ADD CONSTRAINT checkpoints_url_check
  CHECK (url IS NOT NULL);

ALTER TABLE checkpoint_sessions
  ADD COLUMN IF NOT EXISTS client_ip TEXT;

CREATE TABLE IF NOT EXISTS lootlabs_postbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES checkpoint_sessions(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  click_id TEXT NOT NULL,
  unique_id TEXT NOT NULL,
  client_ip TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unique_id)
);

CREATE INDEX IF NOT EXISTS idx_lootlabs_postbacks_session
  ON lootlabs_postbacks(session_id);
