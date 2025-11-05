// server.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

/* ========== Middlewares ========== */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Async wrapper to forward errors to error handler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ========== DB Pool (Postgres / Supabase) ========== */
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("[CONFIG] Missing DATABASE_URL in fkik-backend/.env. Get it from Supabase › Settings › Database (use the Node.js connection string, pooling port 6543).");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }, // penting untuk Supabase
});

const q = (text, params = []) => pool.query(text, params);
const getById = async (id) => {
  const { rows } = await q("SELECT * FROM jadwal WHERE id = $1", [id]);
  return rows[0] || null;
};

/* ========== Nama gedung: HARUS salah satu dari 3 ini ========== */
const ALLOWED_BUILDINGS = new Set(["Gedung B", "Gedung AB", "Gedung C", "Kampus 1"]);
function assertAllowedBuilding(v) {
  const s = String(v ?? "").trim();
  if (!s) return; // boleh kosong (biar kompatibel jika data ruangan belum diisi)
  if (!ALLOWED_BUILDINGS.has(s)) {
    const err = new Error(
      `Nama gedung tidak valid: "${v}". Hanya boleh: Gedung B, Gedung AB, Gedung C.`
    );
    err.statusCode = 400;
    throw err;
  }
}

/* ========== DIAG / HEALTH ========== */
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get("/api/jadwal/count", wrap(async (_req, res) => {
  const { rows } = await q("SELECT COUNT(*) AS n FROM jadwal");
  res.json(rows[0]); // { n: number }
}));

app.get("/api/debug/info", wrap(async (_req, res) => {
  const { rows } = await q("SELECT current_database() AS db");
  res.json({
    pid: process.pid,
    db: rows[0]?.db,
    env: {
      url: process.env.DATABASE_URL ? "set" : "",
    },
  });
}));

/* ========== ROUTES ========== */

// helper kecil
const dateOnly = v => (v ? String(v).slice(0, 10) : null);

// GET semua jadwal (no-cache)
app.get("/api/jadwal", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  const { rows } = await q("SELECT * FROM jadwal ORDER BY id ASC");
  res.json(rows);
});

// POST satu jadwal
app.post("/api/jadwal", wrap(async (req, res) => {
  const b = req.body || {};
  const tipe = (b.tipe || "mingguan").toLowerCase() === "blok" ? "blok" : "mingguan";

  if (!b.prodi || !b.mata_kuliah || !b.kelas || !b.jam_mulai || !b.jam_selesai) {
    return res.status(400).json({ error: "prodi, mata_kuliah, kelas, jam_mulai, jam_selesai wajib diisi" });
  }
  if (tipe === "mingguan" && !b.hari) {
    return res.status(400).json({ error: "hari wajib diisi untuk jadwal mingguan" });
  }
  if (tipe === "blok" && (!b.tgl_mulai || !b.tgl_selesai)) {
    return res.status(400).json({ error: "tgl_mulai & tgl_selesai wajib diisi untuk jadwal blok" });
  }

  // VALIDASI GEDUNG: hanya 3 nama resmi
  assertAllowedBuilding(b.gedung);

  const sql = `
    INSERT INTO jadwal
    (prodi, mata_kuliah, kelas, semester, hari, jam_mulai, jam_selesai,
     gedung, ruangan, dosen, nip, sks, tipe, tgl_mulai, tgl_selesai, hari_aktif, fase)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *;
  `;
  const params = [
    b.prodi || null,
    b.mata_kuliah || null,
    b.kelas || null,
    b.semester ?? null,
    b.hari || null,
    b.jam_mulai || null,
    b.jam_selesai || null,
    b.gedung || null,
    b.ruangan || null,
    b.dosen || null,
    b.nip || null,
    b.sks ?? null,
    tipe,
    b.tgl_mulai || null,
    b.tgl_selesai || null,
    b.hari_aktif || null,
    b.fase || null,
  ];

  console.log("insert-one:", b.mata_kuliah, b.prodi);
  const { rows } = await q(sql, params);
  res.status(201).json(rows[0]);
}));

// PUT update by id
app.put("/api/jadwal/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const b = req.body || {};
  const tipe = (b.tipe || "mingguan").toLowerCase() === "blok" ? "blok" : "mingguan";

  if (!b.prodi || !b.mata_kuliah || !b.kelas || !b.jam_mulai || !b.jam_selesai) {
    return res.status(400).json({ error: "prodi, mata_kuliah, kelas, jam_mulai, jam_selesai wajib diisi" });
  }
  if (tipe === "mingguan" && !b.hari) {
    return res.status(400).json({ error: "hari wajib diisi untuk jadwal mingguan" });
  }
  if (tipe === "blok" && (!b.tgl_mulai || !b.tgl_selesai)) {
    return res.status(400).json({ error: "tgl_mulai & tgl_selesai wajib diisi untuk jadwal blok" });
  }

  // VALIDASI GEDUNG
  assertAllowedBuilding(b.gedung);

  const sql = `
    UPDATE jadwal SET
      prodi=$1, mata_kuliah=$2, kelas=$3, semester=$4, hari=$5,
      jam_mulai=$6, jam_selesai=$7, gedung=$8, ruangan=$9, dosen=$10, nip=$11, sks=$12,
      tipe=$13, tgl_mulai=$14, tgl_selesai=$15, hari_aktif=$16, fase=$17
    WHERE id=$18
    RETURNING *;
  `;
  const params = [
    b.prodi || null,
    b.mata_kuliah || null,
    b.kelas || null,
    b.semester ?? null,
    b.hari || null,
    b.jam_mulai || null,
    b.jam_selesai || null,
    b.gedung || null,
    b.ruangan || null,
    b.dosen || null,
    b.nip || null,
    b.sks ?? null,
    tipe,
    b.tgl_mulai || null,
    b.tgl_selesai || null,
    b.hari_aktif || null,
    b.fase || null,
    id,
  ];

  console.log("update-id:", id);
  const { rows } = await q(sql, params);
  res.json(rows[0]);
}));

// DELETE all (robust, single-connection + TRUNCATE fallback)
app.delete("/api/jadwal/all", wrap(async (_req, res) => {
  try {
    await q("TRUNCATE TABLE jadwal RESTART IDENTITY");
    res.json({ ok: true, deleted: 0, method: "TRUNCATE" });
  } catch (err) {
    console.error("delete-all error:", err.message);
    res.status(500).json({ error: err.message });
  }
}));

// DELETE by id
app.delete("/api/jadwal/:id", wrap(async (req, res) => {
  const { id } = req.params;
  console.log("delete-one:", id);
  await q("DELETE FROM jadwal WHERE id = $1", [id]);
  res.json({ ok: true });
}));

// BULK insert (Excel/CSV) — dukung mingguan & blok
app.post("/api/jadwal/bulk", wrap(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  console.log("bulk-incoming-size:", items.length);
  if (!items.length) return res.status(400).json({ error: "Empty payload" });

  // VALIDASI GEDUNG untuk setiap baris (hentikan jika ada yang tidak valid)
  for (let i = 0; i < items.length; i++) {
    try {
      assertAllowedBuilding(items[i].gedung);
    } catch (e) {
      return res.status(400).json({ error: `Baris ${i + 1}: ${e.message}` });
    }
  }

  const values = [];
  for (const x of items) {
    const tipe = (x.tipe || "mingguan").toLowerCase() === "blok" ? "blok" : "mingguan";
    if (!x.prodi || !x.mata_kuliah || !x.kelas || !x.jam_mulai || !x.jam_selesai) continue;
    if (tipe === "mingguan" && !x.hari) continue;
    if (tipe === "blok" && (!x.tgl_mulai || !x.tgl_selesai)) continue;

    values.push([
      x.prodi || null,
      x.mata_kuliah || null,
      x.kelas || null,
      x.semester ?? null,
      x.hari || null,
      x.jam_mulai || null,
      x.jam_selesai || null,
      x.gedung || null,
      x.ruangan || null,
      x.dosen || null,
      x.nip || null,
      x.sks ?? null,
      tipe,
      x.tgl_mulai || null,
      x.tgl_selesai || null,
      x.hari_aktif || null,
      x.fase || null,
    ]);
  }
  if (!values.length) return res.status(400).json({ error: "Tidak ada baris valid" });

  // Optimized: single connection + batched multi-row INSERT to reduce round-trips
  const client = await pool.connect();
  const CHUNK_SIZE = 250; // tune if needed
  try {
    await client.query('BEGIN');
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      // Build placeholders ($1..$17), ($18..$34), ...
      const cols = 17;
      const placeholders = chunk
        .map((_, rowIdx) => {
          const base = rowIdx * cols;
          const slots = Array.from({ length: cols }, (_, j) => `$${base + j + 1}`);
          return `(${slots.join(',')})`;
        })
        .join(',');
      const flatParams = chunk.flat();
      const sql = `INSERT INTO jadwal
        (prodi, mata_kuliah, kelas, semester, hari, jam_mulai, jam_selesai,
         gedung, ruangan, dosen, nip, sks, tipe, tgl_mulai, tgl_selesai, hari_aktif, fase)
        VALUES ${placeholders}`;
      await client.query(sql, flatParams);
    }
    await client.query('COMMIT');
    console.log("bulk-import size:", values.length);
    res.json({ inserted: values.length });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}));

/* ========== 404 & Error Handler ========== */
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: err?.message || "Internal Server Error" });
});

/* ========== Start Server ========== */
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
