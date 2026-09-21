# RBXScripts V2 — YU🔵 website and admin CMS

## Termux / Android compatibility

The project uses JSON file persistence and has no native database addons. `better-sqlite3`, `sqlite3`, and SQLite session-store packages are not required. This avoids `node-gyp`, prebuilt-binary, and ARM64 Android compilation failures.

## Setup

1. Install Node.js 18 or newer in Termux.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set a strong `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and random `SESSION_SECRET` of at least 32 characters.
5. Run `npm start`.
6. Open `http://localhost:3000/`.
7. Open `http://localhost:3000/admin/`.

`data/site-config.json` is the persistent source of truth. Admin saves use an atomic temporary-file rename, so a failed write does not partially corrupt the configuration. The public frontend tries `/api/site-config` first and falls back to `/data/site-config.json`.

The admin password is verified server-side with bcrypt and is never sent to the browser. Sessions use HTTP-only, SameSite cookies. The default Express session store is dependency-free and suitable for a single-process Termux deployment; use a shared external session store for multi-process production deployments.

## API

- `GET /api/site-config` — public read-only configuration.
- `POST /api/admin/login` — rate-limited admin login.
- `POST /api/admin/logout` — destroy the current session.
- `GET /api/admin/session` — check session status.
- `GET /api/admin/site-config` — authenticated configuration read.
- `PUT /api/admin/site-config` — authenticated, validated configuration update.

Keep `assets/reference-ui.png` available for the profile artwork. `.env` and runtime files are ignored by Git.
