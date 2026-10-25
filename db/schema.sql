CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS key_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES key_systems(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  linkvertise_url TEXT,
  provider TEXT NOT NULL DEFAULT 'linkvertise',
  url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(system_id, position),
  CONSTRAINT checkpoints_provider_check CHECK (provider IN ('linkvertise', 'lootlabs')),
  CONSTRAINT checkpoints_url_check CHECK (url IS NOT NULL OR linkvertise_url IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES key_systems(id) ON DELETE RESTRICT,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_keys_system_id ON keys(system_id);
CREATE INDEX IF NOT EXISTS idx_keys_expires_at ON keys(expires_at);

CREATE TABLE IF NOT EXISTS checkpoint_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES key_systems(id) ON DELETE CASCADE,
  current_position INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  client_ip TEXT
);

CREATE TABLE IF NOT EXISTS checkpoint_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES checkpoint_sessions(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, checkpoint_id)
);

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

CREATE INDEX IF NOT EXISTS idx_checkpoint_sessions_expires_at
  ON checkpoint_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_lootlabs_postbacks_session
  ON lootlabs_postbacks(session_id);
