'use strict';

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fsSync = require('fs');
const fs = require('fs/promises');
const crypto = require('crypto');

function loadDotEnvFile() {
  const envPath = path.join(__dirname, '.env');

  if (!fsSync.existsSync(envPath)) {
    return;
  }

  const raw = fsSync.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile();

const ROOT = __dirname;
const STORAGE_ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : ROOT;
const DATA_DIR = process.env.CMS_DATA_DIR
  ? path.resolve(process.env.CMS_DATA_DIR)
  : path.join(STORAGE_ROOT, 'data');
const CMS_FILE = path.join(DATA_DIR, 'cms.json');
const UPLOADS_DIR = process.env.CMS_UPLOADS_DIR
  ? path.resolve(process.env.CMS_UPLOADS_DIR)
  : path.join(STORAGE_ROOT, 'uploads');
const TEAM_UPLOAD_DIR = path.join(UPLOADS_DIR, 'team');
const EVENTS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'events');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const TEAM_CARD_OPTIONS = [
  { id: 'team-patron', label: 'Dr. Nagendra Parashar (Patron)' },
  { id: 'team-cio', label: 'Dr. Rohini Nagapadma (Patron)' },
  { id: 'team-chief-advisor-me', label: 'Dr. H N Divakar (Chief Advisor)' },
  { id: 'team-chief-advisor-ec', label: 'Dr. Rajalekshmi Kishore (Chief Advisor)' },
  { id: 'team-advisor-ashok', label: 'Dr. Ashok K (Faculty Advisor)' },
  { id: 'team-advisor-anand', label: 'Dr. Anand A (Faculty Advisor)' },
  { id: 'team-student-president', label: 'Student President' },
  { id: 'team-president-elect', label: 'President-Elect' },
  { id: 'team-head-technical', label: 'Head - Technical Core' },
  { id: 'team-head-operations', label: 'Head - Operations & Safety' },
  { id: 'team-head-training', label: 'Head - Training, Events & Outreach' },
  { id: 'team-head-documentation', label: 'Head - Documentation & Media' },
  { id: 'team-exec-1', label: 'Executive Member 01' },
  { id: 'team-exec-2', label: 'Executive Member 02' },
  { id: 'team-exec-3', label: 'Executive Member 03' },
  { id: 'team-exec-4', label: 'Executive Member 04' }
];

const TEAM_CARD_SET = new Set(TEAM_CARD_OPTIONS.map((card) => card.id));

function defaultCmsState() {
  return {
    updatedAt: null,
    teamPhotos: {},
    events: []
  };
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(TEAM_UPLOAD_DIR, { recursive: true });
  await fs.mkdir(EVENTS_UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(CMS_FILE);
  } catch {
    await fs.writeFile(CMS_FILE, JSON.stringify(defaultCmsState(), null, 2), 'utf8');
  }
}

async function loadCms() {
  try {
    const raw = await fs.readFile(CMS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      updatedAt: parsed.updatedAt || null,
      teamPhotos: parsed.teamPhotos && typeof parsed.teamPhotos === 'object' ? parsed.teamPhotos : {},
      events: Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch {
    return defaultCmsState();
  }
}

async function saveCms(data) {
  const normalized = {
    updatedAt: new Date().toISOString(),
    teamPhotos: data.teamPhotos && typeof data.teamPhotos === 'object' ? data.teamPhotos : {},
    events: Array.isArray(data.events) ? data.events : []
  };

  await fs.writeFile(CMS_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function sanitizeEvent(input) {
  return {
    id: String(input.id || crypto.randomUUID()),
    title: String(input.title || '').trim(),
    type: String(input.type || '').trim(),
    date: String(input.date || '').trim(),
    description: String(input.description || '').trim(),
    photoUrl: String(input.photoUrl || '').trim()
  };
}

function buildStorage(targetDir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, targetDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
  });
}

function imageOnly(_req, file, cb) {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    cb(new Error('Only image files are allowed.'));
    return;
  }
  cb(null, true);
}

const uploadTeamPhoto = multer({
  storage: buildStorage(TEAM_UPLOAD_DIR),
  fileFilter: imageOnly,
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

const uploadEventPhoto = multer({
  storage: buildStorage(EVENTS_UPLOAD_DIR),
  fileFilter: imageOnly,
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

async function removeFileByPublicPath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') return;
  if (!publicPath.startsWith('/uploads/')) return;

  const normalized = publicPath.replace(/^\/+/, '');
  const relativeUploadPath = normalized.replace(/^uploads[\\/]/, '');
  const absolutePath = path.resolve(UPLOADS_DIR, relativeUploadPath);
  const uploadsRoot = path.resolve(UPLOADS_DIR);

  if (!absolutePath.startsWith(uploadsRoot)) return;

  try {
    await fs.unlink(absolutePath);
  } catch {
    // Ignore if file is already missing.
  }
}

function authRequired(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
    return;
  }
  res.status(401).json({ ok: false, message: 'Unauthorized' });
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
  }

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-this-now';

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      name: 'raptor.admin.sid',
      secret: process.env.SESSION_SECRET || 'change-this-session-secret',
      proxy: IS_PRODUCTION,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PRODUCTION,
        maxAge: 8 * 60 * 60 * 1000
      }
    })
  );

  app.get('/api/public/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/public/content', async (_req, res) => {
    const cms = await loadCms();
    res.json(cms);
  });

  app.get('/api/public/team-cards', (_req, res) => {
    res.json({ teamCards: TEAM_CARD_OPTIONS });
  });

  app.get('/api/admin/me', (req, res) => {
    const authenticated = Boolean(req.session && req.session.isAdmin);
    res.json({
      authenticated,
      username: authenticated ? req.session.username : null
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();

    if (username === adminUsername && password === adminPassword) {
      req.session.isAdmin = true;
      req.session.username = username;
      res.json({ ok: true, username });
      return;
    }

    res.status(401).json({ ok: false, message: 'Invalid username or password.' });
  });

  app.post('/api/admin/logout', (req, res) => {
    if (!req.session) {
      res.json({ ok: true });
      return;
    }

    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get('/api/admin/content', authRequired, async (_req, res) => {
    const cms = await loadCms();
    res.json(cms);
  });

  app.post('/api/admin/team/photo', authRequired, uploadTeamPhoto.single('photo'), async (req, res) => {
    const teamId = String(req.body.teamId || '').trim();

    if (!TEAM_CARD_SET.has(teamId)) {
      res.status(400).json({ ok: false, message: 'Invalid team card id.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ ok: false, message: 'Please attach a photo.' });
      return;
    }

    const cms = await loadCms();
    const previousPath = cms.teamPhotos[teamId] || '';
    const nextPath = `/uploads/team/${req.file.filename}`;
    cms.teamPhotos[teamId] = nextPath;

    const saved = await saveCms(cms);
    await removeFileByPublicPath(previousPath);

    res.json({ ok: true, teamId, photoUrl: nextPath, content: saved });
  });

  app.post('/api/admin/events', authRequired, uploadEventPhoto.single('photo'), async (req, res) => {
    const title = String(req.body.title || '').trim();
    if (!title) {
      res.status(400).json({ ok: false, message: 'Event title is required.' });
      return;
    }

    const cms = await loadCms();

    const event = sanitizeEvent({
      id: crypto.randomUUID(),
      title,
      type: req.body.type,
      date: req.body.date,
      description: req.body.description,
      photoUrl: req.file ? `/uploads/events/${req.file.filename}` : ''
    });

    cms.events.unshift(event);
    const saved = await saveCms(cms);

    res.status(201).json({ ok: true, event, content: saved });
  });

  app.put('/api/admin/events/:eventId', authRequired, uploadEventPhoto.single('photo'), async (req, res) => {
    const eventId = String(req.params.eventId || '').trim();
    const cms = await loadCms();

    const index = cms.events.findIndex((event) => String(event.id) === eventId);
    if (index < 0) {
      res.status(404).json({ ok: false, message: 'Event not found.' });
      return;
    }

    const current = sanitizeEvent(cms.events[index]);
    const removePhoto = String(req.body.removePhoto || '').trim() === 'true';

    const nextEvent = sanitizeEvent({
      ...current,
      title: String(req.body.title || current.title).trim(),
      type: String(req.body.type || current.type).trim(),
      date: String(req.body.date || current.date).trim(),
      description: String(req.body.description || current.description).trim(),
      photoUrl: current.photoUrl
    });

    if (!nextEvent.title) {
      res.status(400).json({ ok: false, message: 'Event title is required.' });
      return;
    }

    if (removePhoto) {
      await removeFileByPublicPath(current.photoUrl);
      nextEvent.photoUrl = '';
    }

    if (req.file) {
      await removeFileByPublicPath(current.photoUrl);
      nextEvent.photoUrl = `/uploads/events/${req.file.filename}`;
    }

    cms.events[index] = nextEvent;
    const saved = await saveCms(cms);

    res.json({ ok: true, event: nextEvent, content: saved });
  });

  app.delete('/api/admin/events/:eventId', authRequired, async (req, res) => {
    const eventId = String(req.params.eventId || '').trim();
    const cms = await loadCms();

    const index = cms.events.findIndex((event) => String(event.id) === eventId);
    if (index < 0) {
      res.status(404).json({ ok: false, message: 'Event not found.' });
      return;
    }

    const [removed] = cms.events.splice(index, 1);
    const saved = await saveCms(cms);

    await removeFileByPublicPath(removed.photoUrl);

    res.json({ ok: true, content: saved });
  });

  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(ROOT, 'admin.html'));
  });

  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/assets', express.static(path.join(ROOT, 'assets')));
  app.use('/docs', express.static(path.join(ROOT, 'docs')));
  app.use(express.static(ROOT));

  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ ok: false, message: 'Image exceeds 8MB limit.' });
        return;
      }
      res.status(400).json({ ok: false, message: err.message });
      return;
    }

    if (err && err.message) {
      res.status(400).json({ ok: false, message: err.message });
      return;
    }

    res.status(500).json({ ok: false, message: 'Unexpected server error.' });
  });

  return app;
}

async function startServer() {
  await ensureStorage();
  const app = createApp();
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Raptor admin backend running on http://localhost:${port}`);
    console.log('Admin panel: http://localhost:' + port + '/admin');
    console.log('Storage root: ' + STORAGE_ROOT);
    console.log('CMS file: ' + CMS_FILE);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
