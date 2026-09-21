# RBXScripts V2 — YU🔵 website and admin CMS

## Production audit status

The server now uses a SQLite-backed session store, HTTP-only `SameSite=Strict` cookies, login rate limiting, Helmet, same-origin checks for state-changing admin routes, server-side validation, and an allowlisted static file map. `server.js`, `db.js`, `.env`, and `.data/` are not served as public files.

I could not execute `npm install`, start a process, or perform live HTTP/browser tests from the repository API environment. Run the verification checklist below locally or in CI before deployment.

## Setup and deployment

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set a strong `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and random `SESSION_SECRET` of at least 32 characters.
5. Set `NODE_ENV=production` behind HTTPS.
6. Run `npm start`.
7. Open `/` for the public website and `/admin/` for the protected dashboard.

The admin password is read only by the server and stored as a bcrypt hash in SQLite. It is never sent to the browser. `.env`, `.data/`, and SQLite files are ignored by Git.

## API endpoints

- `GET /api/site-config` — public, read-only configuration.
- `POST /api/admin/login` — rate-limited login and HTTP-only session creation.
- `POST /api/admin/logout` — authenticated session destruction.
- `GET /api/admin/session` — authentication status.
- `GET /api/admin/site-config` — authenticated configuration read.
- `PUT /api/admin/site-config` — authenticated, validated configuration update.

The first startup creates `.data/site.sqlite` and seeds it from `data/site-config.json` only when no database configuration exists. SQLite is then the source of truth. The public frontend tries `/api/site-config` first and falls back to `/data/site-config.json` if the API is unavailable.

## Verification checklist

With a valid `.env`, verify:

```sh
npm install
npm start
curl -i http://localhost:3000/
curl -i http://localhost:3000/admin/
curl -i http://localhost:3000/api/site-config
curl -i http://localhost:3000/api/admin/site-config
curl -i -c cookies.txt -H 'Content-Type: application/json' -d '{"username":"...","password":"..."}' http://localhost:3000/api/admin/login
curl -i -b cookies.txt http://localhost:3000/api/admin/site-config
curl -i -b cookies.txt -H 'Content-Type: application/json' -X PUT -d '{...validated config...}' http://localhost:3000/api/admin/site-config
curl -i -b cookies.txt -X POST http://localhost:3000/api/admin/logout
```

Restart the server after a successful update and confirm the public endpoint returns the saved value. Invalid JSON/configuration must return JSON `400`; unauthenticated admin requests must return `401`.

Keep `assets/reference-ui.png` available for the profile artwork.
