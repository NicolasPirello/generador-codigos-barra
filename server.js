const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3201;
const API_KEY = process.env.API_KEY || null; // Opcional: establece una API_KEY en Dockploy para proteger el acceso
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Utilidades de persistencia en archivo JSON
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      state: { prefix: 'KIOSCO-922-', digits: 5, next: 1 },
      labels: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}
function loadDB() {
  ensureDataFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}
function pad(num, width) {
  const s = String(num);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

// Middleware
app.use(express.json({ limit: '1mb' }));

// Autenticación simple por API Key (opcional)
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const provided = req.header('x-api-key');
  if (provided && provided === API_KEY) return next();
  res.status(401).json({ error: 'No autorizado: falta o es inválida la x-api-key' });
});

// Endpoints API
app.get('/api/state', (req, res) => {
  const { state } = loadDB();
  res.json(state);
});

app.patch('/api/state', (req, res) => {
  const db = loadDB();
  const allowed = ['prefix', 'digits', 'next'];
  for (const k of allowed) {
    if (k in req.body) {
      if (k === 'digits' || k === 'next') {
        const v = Number(req.body[k]);
        if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: `Valor inválido para ${k}` });
        db.state[k] = v;
      } else if (k === 'prefix') {
        db.state[k] = String(req.body[k]).trim();
      }
    }
  }
  saveDB(db);
  res.json(db.state);
});

app.get('/api/labels', (req, res) => {
  const db = loadDB();
  res.json(db.labels);
});

app.post('/api/labels/generate', (req, res) => {
  const { count, item } = req.body || {};
  const c = Number(count) || 1;
  if (c < 1 || c > 999) return res.status(400).json({ error: 'count debe estar entre 1 y 999' });
  const art = String(item || '').trim();
  if (!art) art = 'Artículo sin nombre'; // Valor por defecto si no se proporciona nombre

  const db = loadDB();
  const { prefix, digits } = db.state;
  let { next } = db.state;

  const added = [];
  const now = new Date().toISOString();
  // calcular siguiente id incremental
  const nextIdStart = (db.labels.reduce((max, r) => Math.max(max, r.id || 0), 0) || 0) + 1;

  for (let i = 0; i < c; i++) {
    const code = `${prefix}${pad(next + i, digits)}`;
    const id = nextIdStart + i;
    added.push({ id, code, art, createdAt: now });
  }
  // persistir
  db.labels.push(...added);
  db.state.next = next + c;
  saveDB(db);

  res.json({ added, state: db.state });
});

app.put('/api/labels/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });
  const db = loadDB();
  const idx = db.labels.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Etiqueta no encontrada' });

  const { art, code } = req.body || {};
  if (typeof art === 'string') db.labels[idx].art = art.trim();
  if (typeof code === 'string') {
    const newCode = code.trim();
    if (!newCode) return res.status(400).json({ error: 'code no puede estar vacío' });
    if (db.labels.some(r => r.code === newCode && r.id !== id)) return res.status(409).json({ error: 'code duplicado' });
    db.labels[idx].code = newCode;
  }
  saveDB(db);
  res.json(db.labels[idx]);
});

app.delete('/api/labels/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = loadDB();
  const before = db.labels.length;
  db.labels = db.labels.filter(r => r.id !== id);
  if (db.labels.length === before) return res.status(404).json({ error: 'Etiqueta no encontrada' });
  saveDB(db);
  res.json({ ok: true });
});

app.delete('/api/labels', (req, res) => {
  const db = loadDB();
  db.labels = [];
  db.state.next = 1; // reinicia correlativo
  saveDB(db);
  res.json({ ok: true, state: db.state });
});

// Servir frontend estático
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});