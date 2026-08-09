# RenzyHub Key System v2

Provider-based key system for RenzyHub.

## What changed in v2

- Checkpoints support `linkvertise` and `lootlabs`.
- Admin can create, edit, enable/disable, reorder, and delete checkpoints.
- Checkpoint flow is sequential by `position`.
- Linkvertise uses the Anti-Bypass verification endpoint.
- LootLabs uses the documented server-to-server postback model.
- Key duration remains configurable.
- Existing Linkvertise-only databases can be upgraded with `db/migrate-provider.sql`.

LootLabs documents postback as a way to confirm completed tasks. The `puid` value sent in the LootLabs link is returned as `click_id` to your postback route, which this project validates against the current session/checkpoint. See the official LootLabs postback documentation for panel setup.

## Existing database upgrade

If you already ran the original v1 schema (as with your current Neon database):

1. Open Neon SQL Editor.
2. Create a new query.
3. Paste the entire contents of `db/migrate-provider.sql`.
4. Run it once.
5. Do not delete the existing `key_systems` or `checkpoints` rows.

The migration copies existing `linkvertise_url` values into the new `url` field and marks those checkpoints as `linkvertise`.

## Fresh database

For a new database, run `db/schema.sql`.

## Environment variables

Set these in Vercel:

- `DATABASE_URL`
- `APP_URL`
- `SESSION_SECRET`
- `LINKVERTISE_ANTI_BYPASS_TOKEN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DEFAULT_KEY_DURATION`
- `LOOTLABS_API_TOKEN` (optional for future automatic link creation)

Redeploy after changing environment variables.

## LootLabs setup

The postback route is:

`https://YOUR_DOMAIN/api/lootlabs/postback`

In your LootLabs panel, enable postback and configure that URL. LootLabs sends `click_id`, `ip`, and `unique_id`. The application uses `click_id` to identify the session/checkpoint and verifies the IP when both sides provide one.

When an admin creates a LootLabs checkpoint, the app appends:

`puid=<signed-session-value>`

to the configured LootLabs URL.

## Admin

Open `/admin` and log in using the admin credentials configured/seeded in the database.

The checkpoint editor supports:

- Provider: Linkvertise / LootLabs
- Position
- Name
- URL
- Enabled/disabled
- Create/edit/delete

## Important

Never commit `.env` or real provider/database credentials to GitHub.
