const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
// Permite puerto por argumento CLI: --port=3215 o --port 3215
function getPortFromArgs() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (!Number.isNaN(n)) return n;
    }
    if (a.startsWith('--port=')) {
      const v = a.split('=')[1];
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}
const PORT = getPortFromArgs() || process.env.PORT || 3201;
// NUEVO: configuración por variables de entorno (con valores por defecto seguros)
const PREFIX = process.env.BARCODE_PREFIX || 'KIOSCO-922-';
const DIGITS = Number(process.env.BARCODE_DIGITS || 5);
const API_KEY = process.env.API_KEY || null; // Opcional: establece una API_KEY en Dockploy para proteger el acceso
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Utilidades de persistencia en archivo JSON
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = { labels: [] }; // Ya no persistimos "state"
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}
function loadDB() {
  ensureDataFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  if (!Array.isArray(parsed.labels)) parsed.labels = [];
  return parsed;
}
function saveDB(db) {
  // Garantiza que sólo se guarden las etiquetas (no "state").
  const toSave = { labels: Array.isArray(db.labels) ? db.labels : [] };
  fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
}
function pad(num, width) {
  const s = String(num);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}
// Derivar el siguiente correlativo a partir de los códigos existentes
function getDerivedNext(labels) {
  let max = 0;
  for (const r of labels || []) {
    if (!r || typeof r.code !== 'string') continue;
    const m = r.code.match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}
// Derivar el siguiente número para nombres automáticos (simple: cantidad+1)
function getDerivedNameSeq(labels) {
  return (Array.isArray(labels) ? labels.length : 0) + 1;
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
  const db = loadDB();
  const next = getDerivedNext(db.labels);
  const nameSeq = getDerivedNameSeq(db.labels);
  res.json({ prefix: PREFIX, digits: DIGITS, next, nameSeq });
});

app.patch('/api/state', (req, res) => {
  // Estado controlado por variables de entorno. Ignoramos modificaciones para evitar riesgos.
  const db = loadDB();
  const next = getDerivedNext(db.labels);
  const nameSeq = getDerivedNameSeq(db.labels);
  res.json({ prefix: PREFIX, digits: DIGITS, next, nameSeq });
});

app.get('/api/labels', (req, res) => {
  const db = loadDB();
  res.json(db.labels);
});

app.post('/api/labels/generate', (req, res) => {
  const { count, item } = req.body || {};
  const c = Number(count) || 1;
  if (c < 1 || c > 999) return res.status(400).json({ error: 'count debe estar entre 1 y 999' });
  const providedArt = typeof item === 'string' ? item.trim() : '';

  const db = loadDB();
  const nextStart = getDerivedNext(db.labels);
  const nameSeqStart = getDerivedNameSeq(db.labels);

  const added = [];
  const now = new Date().toISOString();
  // calcular siguiente id incremental
  const nextIdStart = (db.labels.reduce((max, r) => Math.max(max, r.id || 0), 0) || 0) + 1;

  for (let i = 0; i < c; i++) {
    const code = `${PREFIX}${pad(nextStart + i, DIGITS)}`;
    const id = nextIdStart + i;
    const title = providedArt || `Articulo ${pad(nameSeqStart + i, 2)}`;
    added.push({ id, code, art: title, createdAt: now });
  }
  // persistir sólo etiquetas
  db.labels.push(...added);
  saveDB(db);

  // responder con estado derivado actual
  const next = getDerivedNext(db.labels);
  const nameSeq = getDerivedNameSeq(db.labels);
  res.json({ added, state: { prefix: PREFIX, digits: DIGITS, next, nameSeq } });
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

// Servir frontend estático
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});