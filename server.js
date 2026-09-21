const path = require('node:path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getConfig, saveConfig, findAdmin, createAdmin } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const root = __dirname;
const dataDir = path.join(root, '.data');

if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters.');
if (!adminUsername || !adminPassword) throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set.');
if (adminPassword === 'CHANGE_THIS_PASSWORD') throw new Error('Set a strong ADMIN_PASSWORD before starting.');

app.disable('x-powered-by');
app.set('trust proxy', isProduction ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '256kb' }));

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin !== ownOrigin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: 'Invalid request origin.' });
  }
  next();
}
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(session({
  name: 'yu_admin_session',
  secret: sessionSecret,
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: dataDir, concurrentDB: true }),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: isProduction, maxAge: 1000 * 60 * 60 * 8 }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const sendError = (res, status, message) => res.status(status).json({ error: message });
function requireAdmin(req, res, next) { return req.session?.admin?.id ? next() : sendError(res, 401, 'Authentication required.'); }
function text(value, name, required = false, max = 5000) { if (typeof value !== 'string') { if (required) throw new Error(`${name} is required.`); return ''; } const result = value.trim(); if (required && !result) throw new Error(`${name} is required.`); if (result.length > max) throw new Error(`${name} is too long.`); return result; }
function list(value, name) { if (!Array.isArray(value) || value.length > 200) throw new Error(`${name} must be an array.`); return value; }
function bool(value, fallback = true) { return typeof value === 'boolean' ? value : fallback; }
function checkedUrl(value, name, required = false) { const result = text(value || '', name, required, 2000); if (!result || result === '#' || result.startsWith('mailto:')) return result; try { const parsed = new URL(result); if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString(); } catch {} throw new Error(`${name} must be a valid HTTP or HTTPS URL.`); }
function color(value) { const result = text(value || '#14a8ff', 'Accent color', true, 20); if (!/^#[0-9a-f]{6}$/i.test(result)) throw new Error('Accent color must be a hex color.'); return result; }
function normalizeConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration must be an object.');
  const p = input.profile || {};
  const profile = { name: text(p.name, 'Profile name', true, 120), verified: bool(p.verified, false), role: text(p.role, 'Role', true, 180), quote: text(p.quote || '', 'Quote', false, 300), bio: text(p.bio, 'Bio', true), location: text(p.location || '', 'Location', false, 120), joined: text(p.joined || p.joinedDate || '', 'Joined date', false, 120), joinedDate: text(p.joinedDate || p.joined || '', 'Joined date', false, 120), platform: text(p.platform || 'Roblox', 'Platform', false, 80), image: text(p.image || p.profileImage || '', 'Profile image', false, 2000), profileImage: text(p.profileImage || p.image || '', 'Profile image', false, 2000) };
  const socials = list(input.socials || [], 'Social links').map((item, i) => ({ id: String(item.id || `social-${i + 1}`), title: text(item.title, 'Social title', true, 100), icon: text(item.icon || '◉', 'Social icon', false, 20), url: checkedUrl(item.url, 'Social URL'), enabled: bool(item.enabled) }));
  const stats = list(input.stats || [], 'Stats').map((item, i) => ({ id: String(item.id || `stat-${i + 1}`), label: text(item.label, 'Stat label', true, 80), value: text(String(item.value ?? ''), 'Stat value', true, 80), icon: text(item.icon || '★', 'Stat icon', false, 20), enabled: bool(item.enabled) }));
  const scripts = list(input.scripts || [], 'Scripts').map((item, i) => ({ id: String(item.id || `script-${i + 1}`), name: text(item.name, 'Script name', true, 160), description: text(item.description || '', 'Script description', false, 2000), url: checkedUrl(item.url, 'Script URL', true), tags: list(item.tags || [], 'Script tags').map(tag => text(tag, 'Script tag', true, 40)), thumbnail: text(item.thumbnail || '', 'Thumbnail', false, 2000), enabled: bool(item.enabled) }));
  if (!input.sections || typeof input.sections !== 'object' || Array.isArray(input.sections)) throw new Error('Sections must be an object.');
  const sections = Object.fromEntries(Object.entries(input.sections).map(([id, item]) => { if (!/^[\w-]{1,60}$/.test(id) || !item || typeof item !== 'object') throw new Error('Invalid section.'); return [id, { id, title: text(item.title, 'Section title', true, 120), enabled: bool(item.enabled), type: text(item.type || id, 'Section type', false, 60), content: text(item.content || '', 'Section content', false, 10000) }]; }));
  const ui = input.ui || {}; const accent = color(ui.accent || ui.accentColor); const footer = text(ui.footer || ui.footerText || '', 'Footer text', false, 500);
  const quickLinks = list(input.quickLinks || [], 'Quick links').map((item, i) => ({ id: String(item.id || `quick-${i + 1}`), title: text(item.title, 'Quick link title', true, 100), icon: text(item.icon || '◉', 'Quick link icon', false, 20), url: checkedUrl(item.url, 'Quick link URL', true), enabled: bool(item.enabled) }));
  return { profile, socials, stats, scripts, sections, ui: { title: text(ui.title || 'YU🔵 — Roblox Scripts & Tools', 'Site title', true, 180), accent, accentColor: accent, background: text(ui.background || '#030812', 'Background', false, 40), theme: ['dark', 'light'].includes(ui.theme) ? ui.theme : 'dark', footer, footerText: footer }, quickLinks };
}

async function ensureAdmin() { if (!findAdmin(adminUsername)) createAdmin(adminUsername, await bcrypt.hash(adminPassword, 12)); }
app.get('/api/site-config', (req, res) => { try { return res.json(getConfig()); } catch { return sendError(res, 500, 'Unable to load site configuration.'); } });
app.post('/api/admin/login', loginLimiter, sameOrigin, async (req, res) => { try { const username = text(req.body?.username, 'Username', true, 120); const password = typeof req.body?.password === 'string' ? req.body.password : ''; const user = findAdmin(username); if (!user || !(await bcrypt.compare(password, user.password_hash))) return sendError(res, 401, 'Invalid username or password.'); req.session.regenerate(error => { if (error) return sendError(res, 500, 'Unable to create session.'); req.session.admin = { id: user.id, username: user.username }; return res.json({ authenticated: true, username: user.username }); }); } catch (error) { return sendError(res, 400, error.message || 'Invalid login request.'); } });
app.post('/api/admin/logout', requireAdmin, sameOrigin, (req, res) => req.session.destroy(error => error ? sendError(res, 500, 'Unable to log out.') : (res.clearCookie('yu_admin_session'), res.json({ authenticated: false }))));
app.get('/api/admin/session', (req, res) => res.json({ authenticated: Boolean(req.session?.admin?.id), username: req.session?.admin?.username || null }));
app.get('/api/admin/site-config', requireAdmin, (req, res) => { try { return res.json(getConfig()); } catch { return sendError(res, 500, 'Unable to load site configuration.'); } });
app.put('/api/admin/site-config', requireAdmin, sameOrigin, (req, res) => { try { return res.json(saveConfig(normalizeConfig(req.body))); } catch (error) { return sendError(res, 400, error.message || 'Invalid configuration.'); } });

// Serve only the public app. Sensitive server/database/config files are never passed to express.static.
app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/admin/', (req, res) => res.sendFile(path.join(root, 'admin', 'index.html')));
app.get('/admin/index.html', (req, res) => res.sendFile(path.join(root, 'admin', 'index.html')));
app.use('/assets', express.static(path.join(root, 'assets'), { dotfiles: 'deny' }));
app.use('/data', express.static(path.join(root, 'data'), { dotfiles: 'deny', index: false }));
app.get('/style.css', (req, res) => res.sendFile(path.join(root, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(root, 'script.js')));
app.use('/admin', express.static(path.join(root, 'admin'), { dotfiles: 'deny', index: false }));
app.use((req, res) => req.path.startsWith('/api/') ? sendError(res, 404, 'Not found.') : res.status(404).send('Not found.'));
app.use((error, req, res, next) => { if (error instanceof SyntaxError && error.status === 400) return sendError(res, 400, 'Invalid JSON.'); console.error('Unhandled server error:', error); return sendError(res, 500, 'Internal server error.'); });

(async () => { try { await ensureAdmin(); app.listen(PORT, () => console.log(`YU server listening on http://localhost:${PORT}`)); } catch (error) { console.error('Startup failed:', error.message); process.exit(1); } })();
