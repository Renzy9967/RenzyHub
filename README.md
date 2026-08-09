# RenzyHub Key System

Full-stack key system for RenzyHub:

- Next.js 16 App Router
- PostgreSQL
- Server-side key generation and validation
- Multi-checkpoint flow
- Linkvertise Anti-Bypass verification
- Admin dashboard
- Duration / expiration
- Key revoke
- REST API for RenzyHub library

## Important Linkvertise setup

This project uses Linkvertise's official Anti-Bypass API. The Linkvertise documentation states that the anti-bypass flow works with Target-Links, adds a `hash` query parameter after the visitor completes the ad-step, and the hash is only stored by Linkvertise for about 10 seconds. Your backend must therefore verify it immediately.

Official docs:
- https://publisher.linkvertise.com/documentations/Anti_Bypass_Documentation.pdf

For each checkpoint, create a Linkvertise Target-Link whose target points to:

`https://YOUR-DOMAIN/checkpoint/callback?session=SESSION_ID&checkpoint=CHECKPOINT_ID`

Do not put the Linkvertise API token in client-side code.

## Local setup

Requirements:
- Node.js 20.9+
- PostgreSQL

1. Copy `.env.example` to `.env`.
2. Create the database.
3. Install dependencies:

```bash
npm install
```

4. Apply schema:

```bash
npm run db:migrate
```

5. Seed admin:

```bash
npm run db:seed
```

6. Start:

```bash
npm run dev
```

Open http://localhost:3000

## Production

Use HTTPS. Set:
- `APP_URL`
- `DATABASE_URL`
- `SESSION_SECRET`
- `LINKVERTISE_ANTI_BYPASS_TOKEN`
- strong admin password

Run:

```bash
npm run build
npm start
```

## API

### Start key flow

`POST /api/checkpoints/start`

Body:

```json
{ "systemId": "YOUR_SYSTEM_UUID" }
```

Response contains a session and the first Linkvertise URL.

### Verify checkpoint

The browser normally reaches:

`GET /checkpoint/callback?session=...&checkpoint=...&hash=...`

The server verifies the hash with Linkvertise and marks the checkpoint complete.

### Validate key from RenzyHub

`POST /api/keys/validate`

```json
{
  "key": "RENZY-ABCD-EFGH-IJKL"
}
```

Response:

```json
{
  "valid": true,
  "expiresAt": "2026-08-16T00:00:00.000Z",
  "remainingSeconds": 604800
}
```

### Admin

`POST /api/admin/login`

```json
{
  "username": "admin",
  "password": "..."
}
```

`GET /api/admin/keys`

`POST /api/admin/keys`

```json
{
  "systemId": "YOUR_SYSTEM_UUID",
  "durationSeconds": 86400
}
```

`POST /api/admin/keys/revoke`

```json
{
  "id": "KEY_UUID"
}
```

## Security notes

- Raw keys are never stored in PostgreSQL; only an HMAC digest is stored.
- The admin session is an HTTP-only, same-site cookie.
- Linkvertise verification happens server-side.
- The client cannot mark a checkpoint as complete by itself.
- Rate limiting is intentionally kept simple in this starter; put the app behind a reverse proxy/WAF and add Redis-backed rate limiting for a public deployment.
- If you use this for a public library, consider binding keys to a device/user identifier only if that identifier is privacy-safe and necessary.

