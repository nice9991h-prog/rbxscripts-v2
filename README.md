# RBXScripts V2 — YU🔵 website and admin CMS

## Setup

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set a strong `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a random `SESSION_SECRET` (at least 32 characters).
5. Run `npm start`.
6. Open `http://localhost:3000/` for the public site.
7. Open `http://localhost:3000/admin/` for the protected admin panel.

The admin password is never sent to the browser. It is stored server-side as a bcrypt hash in the SQLite database when the database is created. `.env`, the SQLite database, and session files are ignored by Git.

## API endpoints

- `GET /api/site-config` — public configuration read endpoint.
- `POST /api/admin/login` — creates an HTTP-only admin session.
- `POST /api/admin/logout` — destroys the active admin session.
- `GET /api/admin/session` — returns session status.
- `GET /api/admin/site-config` — authenticated configuration read.
- `PUT /api/admin/site-config` — authenticated configuration write.

The first startup creates `.data/site.sqlite` and seeds it from `data/site-config.json` only if no configuration exists. After that, SQLite is the source of truth. The public frontend tries `/api/site-config` first and falls back to `/data/site-config.json` if the API is unavailable.

## Security notes

- Admin routes require an authenticated Express session.
- Credentials are not embedded in frontend code.
- Sessions use HTTP-only cookies with `SameSite=Strict`.
- Login is rate limited.
- Helmet is enabled.
- HTTPS is strongly recommended for production.

Keep `assets/reference-ui.png` available for the profile artwork.
