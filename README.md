# RBXScripts V2 — YU🔵 website

The root homepage is a responsive YU🔵 profile and Roblox scripts website. It reads public content from `data/site-config.json`.

## Admin panel

Open `/admin/` to use the dashboard. The client sends authenticated requests to:

- `GET /api/site-config`
- `PUT /api/site-config`

The existing Express server must protect these routes with its server-side session/auth middleware and persist the JSON/configuration in the database or server storage. No password, session secret, or credential is included in browser code. Connect those routes to the repository's existing authentication and database layers rather than implementing client-side authentication.

For local static preview, the public page falls back to starter data when `data/site-config.json` cannot be fetched. A real Express server is required for admin saving and shared persistence.

Keep `assets/reference-ui.png` available for the profile artwork. Replace `example.com` script URLs and placeholder social URLs in the admin panel before publishing.
