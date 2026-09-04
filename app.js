require('dotenv').config({ path: '.env', override: false });

const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const db       = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

const APP_USERNAME   = process.env.APP_USERNAME   || 'admin';
const APP_PASSWORD   = process.env.APP_PASSWORD   || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

// ── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
}));

// ── Auth ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorised' });
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === APP_USERNAME && password === APP_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Protected static files ───────────────────────────────────────
app.use(requireAuth, express.static(path.join(__dirname, 'public')));

// ── API ──────────────────────────────────────────────────────────
app.use('/api', requireAuth);

app.get('/api/items', (req, res) => {
  try { res.json(db.getAllItems()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/items', (req, res) => {
  try {
    const num  = db.consumeNextNum();
    const id   = 'item-' + String(num).padStart(3, '0');
    const item = db.createItem({ ...req.body, id, num });
    res.json(item);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/items/:id', (req, res) => {
  try { res.json(db.updateItem(req.params.id, req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/items/:id', (req, res) => {
  try { db.deleteItem(req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Start ────────────────────────────────────────────────────────
// ── Jobs API ─────────────────────────────────────────────
app.get('/api/jobs', (req, res) => {
  res.json(db.getAllJobs());
});

app.post('/api/jobs', (req, res) => {
  const job = db.createJob(req.body);
  res.json(job);
});

app.put('/api/jobs/:id', (req, res) => {
  const job = db.updateJob(req.params.id, req.body);
  res.json(job);
});

app.delete('/api/jobs/:id', (req, res) => {
  db.deleteJob(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Repair tracker running on http://127.0.0.1:${PORT}`);
});
