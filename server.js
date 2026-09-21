require('dotenv').config();
const path = require('node:path');
const express = require('express');
const session = require('express-session');
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

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be set to a value at least 32 characters long.');
}
if (!adminUsername || !adminPassword) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in the environment.');
}
if (adminPassword === 'CHANGE_THIS_PASSWORD') {
  throw new Error('Set a strong ADMIN_PASSWORD in your .env before starting the server.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '256kb' }));

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(session({
  name: 'yu_admin_session',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin && req.session.admin.id) {
    return next();
  }
  return sendError(res, 401, 'Authentication required.');
}

function ensureString(value, name, options = {}) {
  const { required = false, max = 5000 } = options;
  if (typeof value !== 'string') {
    if (required) {
      throw new Error(`${name} is required.`);
    }
    return '';
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new Error(`${name} is required.`);
  }
  if (trimmed.length > max) {
    throw new Error(`${name} is too long.`);
  }
  return trimmed;
}

function normalizeString(value, name, options) {
  return ensureString(value, name, options);
}

function validUrl(value, name, required = false) {
  const raw = normalizeString(value || '', name, { required });
  if (!raw || raw === '#') return raw;
  if (raw.startsWith('mailto:')) return raw;
  try {
    const parsed = new URL(raw);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch (error) {
    // fall through to validation error below
  }
  throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
}

function validHexColor(value, name) {
  const text = normalizeString(value || '#14a8ff', name, { required: true, max: 20 });
  if (!/^#[0-9a-fA-F]{6}$/.test(text)) {
    throw new Error(`${name} must be a valid hex color.`);
  }
  return text;
}

function yesNo(value, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  return value;
}

function normalizeConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Configuration must be an object.');
  }

  const profile = input.profile || {};
  const canonical = {
    profile: {
      name: normalizeString(profile.name, 'Profile name', { required: true, max: 120 }),
      verified: yesNo(profile.verified, true),
      role: normalizeString(profile.role, 'Role', { required: true, max: 180 }),
      quote: normalizeString(profile.quote || '', 'Quote', { required: false, max: 300 }),
      bio: normalizeString(profile.bio, 'Bio', { required: true, max: 5000 }),
      location: normalizeString(profile.location || '', 'Location', { required: false, max: 120 }),
      joined: normalizeString(profile.joined || profile.joinedDate || '', 'Joined date', { required: false, max: 120 }),
      joinedDate: normalizeString(profile.joinedDate || profile.joined || '', 'Joined date', { required: false, max: 120 }),
      platform: normalizeString(profile.platform || 'Roblox', 'Platform', { required: false, max: 80 }),
      image: normalizeString(profile.image || profile.profileImage || '', 'Profile image', { required: false, max: 2000 }),
      profileImage: normalizeString(profile.profileImage || profile.image || '', 'Profile image', { required: false, max: 2000 })
    },
    socials: normalizeArray(input.socials || [], 'Social links').map((item, index) => ({
      id: item && item.id ? String(item.id) : `social-${index + 1}`,
      title: normalizeString(item.title, 'Social title', { required: true, max: 100 }),
      icon: normalizeString(item.icon || '◉', 'Social icon', { required: false, max: 20 }),
      url: validUrl(item.url, 'Social URL', false),
      enabled: yesNo(item.enabled, true)
    })),
    stats: normalizeArray(input.stats || [], 'Stats').map((item, index) => ({
      id: item && item.id ? String(item.id) : `stat-${index + 1}`,
      label: normalizeString(item.label, 'Stat label', { required: true, max: 80 }),
      value: normalizeString(String(item.value ?? ''), 'Stat value', { required: true, max: 80 }),
      icon: normalizeString(item.icon || '★', 'Stat icon', { required: false, max: 20 }),
      enabled: yesNo(item.enabled, true)
    })),
    scripts: normalizeArray(input.scripts || [], 'Scripts').map((item, index) => ({
      id: item && item.id ? String(item.id) : `script-${index + 1}`,
      name: normalizeString(item.name, 'Script name', { required: true, max: 160 }),
      description: normalizeString(item.description || '', 'Script description', { required: false, max: 2000 }),
      url: validUrl(item.url, 'Script URL', true),
      tags: normalizeArray(item.tags || [], 'Script tags').map(tag => normalizeString(tag, 'Script tag', { required: true, max: 40 })),
      thumbnail: normalizeString(item.thumbnail || '', 'Thumbnail', { required: false, max: 2000 }),
      enabled: yesNo(item.enabled, true)
    })),
    sections: input.sections && typeof input.sections === 'object' && !Array.isArray(input.sections)
      ? Object.entries(input.sections).reduce((acc, [key, item]) => {
          if (!item || typeof item !== 'object') {
            throw new Error('Each section must be an object.');
          }
          acc[key] = {
            id: key,
            title: normalizeString(item.title, 'Section title', { required: true, max: 120 }),
            enabled: yesNo(item.enabled, true),
            type: normalizeString(item.type || key, 'Section type', { required: false, max: 60 }),
            content: normalizeString(item.content || '', 'Section content', { required: false, max: 10000 })
          };
          return acc;
        }, {})
      : {
          about: { id: 'about', title: 'About Me', enabled: true, type: 'about', content: '' },
          projects: { id: 'projects', title: 'Projects', enabled: true, type: 'projects', content: '' },
          scripts: { id: 'scripts', title: 'Featured Scripts', enabled: true, type: 'scripts', content: '' },
          support: { id: 'support', title: 'Support Me', enabled: true, type: 'support', content: '' },
          contact: { id: 'contact', title: 'Quick Links', enabled: true, type: 'contact', content: '' }
        },
    ui: {
      title: normalizeString(input.ui?.title || 'YU🔵 — Roblox Scripts & Tools', 'Site title', { required: true, max: 180 }),
      accent: validHexColor(input.ui?.accent || input.ui?.accentColor || '#14a8ff', 'Accent color'),
      accentColor: validHexColor(input.ui?.accentColor || input.ui?.accent || '#14a8ff', 'Accent color'),
      background: normalizeString(input.ui?.background || '#030812', 'Background', { required: false, max: 40 }),
      theme: ['dark', 'light'].includes(input.ui?.theme) ? input.ui.theme : 'dark',
      footer: normalizeString(input.ui?.footer || input.ui?.footerText || '', 'Footer text', { required: false, max: 500 }),
      footerText: normalizeString(input.ui?.footerText || input.ui?.footer || '', 'Footer text', { required: false, max: 500 })
    },
    quickLinks: normalizeArray(input.quickLinks || [], 'Quick links').map((item, index) => ({
      id: item && item.id ? String(item.id) : `quick-${index + 1}`,
      title: normalizeString(item.title, 'Quick link title', { required: true, max: 100 }),
      icon: normalizeString(item.icon || '◉', 'Quick link icon', { required: false, max: 20 }),
      url: validUrl(item.url, 'Quick link URL', true),
      enabled: yesNo(item.enabled, true)
    }))
  };

  return canonical;
}

async function ensureAdminUser() {
  const existing = findAdmin(adminUsername);
  if (!existing) {
    const hash = await bcrypt.hash(adminPassword, 12);
    createAdmin(adminUsername, hash);
  }
}

app.get('/api/site-config', (req, res) => {
  try {
    return res.json(getConfig());
  } catch (error) {
    console.error('Public config read failed:', error);
    return sendError(res, 500, 'Unable to load site configuration.');
  }
});

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const username = normalizeString(req.body && req.body.username, 'Username', { required: true, max: 120 });
    const password = String(req.body && req.body.password || '');

    const user = findAdmin(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return sendError(res, 401, 'Invalid username or password.');
    }

    req.session.admin = { id: user.id, username: user.username };
    return res.json({ authenticated: true, username: user.username });
  } catch (error) {
    return sendError(res, 400, error.message || 'Invalid login request.');
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return sendError(res, 500, 'Unable to log out.');
    }
    res.clearCookie('yu_admin_session');
    return res.json({ authenticated: false });
  });
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session && req.session.admin && req.session.admin.id), username: req.session?.admin?.username || null });
});

app.get('/api/admin/site-config', requireAdmin, (req, res) => {
  try {
    return res.json(getConfig());
  } catch (error) {
    console.error('Admin config read failed:', error);
    return sendError(res, 500, 'Unable to load site configuration.');
  }
});

app.put('/api/admin/site-config', requireAdmin, (req, res) => {
  try {
    const config = normalizeConfig(req.body);
    const saved = saveConfig(config);
    return res.json(saved);
  } catch (error) {
    return sendError(res, 400, error.message || 'Invalid configuration.');
  }
});

app.use(express.static(path.join(__dirname), { dotfiles: 'deny', index: 'index.html' }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return sendError(res, 404, 'Not found.');
  }
  return res.status(404).send('Not found.');
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400) {
    return sendError(res, 400, 'Invalid JSON.');
  }
  console.error('Unhandled server error:', error);
  return sendError(res, 500, 'Internal server error.');
});

(async () => {
  try {
    await ensureAdminUser();
    app.listen(PORT, () => {
      console.log(`YU server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
})();
