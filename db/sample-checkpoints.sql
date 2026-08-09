-- Replace the system UUID with the one printed by `npm run db:seed`.
-- Each Linkvertise URL should be a Target-Link configured to redirect to:
-- https://YOUR-DOMAIN/checkpoint/callback?session=...&checkpoint=...
-- The app appends session/checkpoint automatically.

INSERT INTO checkpoints(system_id, position, name, linkvertise_url)
VALUES
  ('REPLACE-SYSTEM-UUID', 1, 'Checkpoint 1', 'https://link-here.example/'),
  ('REPLACE-SYSTEM-UUID', 2, 'Checkpoint 2', 'https://link-here.example/');
