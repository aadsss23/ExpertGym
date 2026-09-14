/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/exercises.js — Endpoint API Kelola Data Latihan (MySQL)
 *
 * Tabel database: `data_latihan` (sesuai ERD), kolom:
 *   id_latihan, title, `desc`, type, bodyPart, equipment, level
 *
 * Tabel ini menyimpan data latihan yang dikelola ADMIN (tambahan di luar
 * dataset bawaan js/dataset.js). Data digabung di sisi frontend dengan
 * dataset bawaan lewat getAllExercises(), lalu ditampilkan sebagai kartu
 * latihan di halaman rekomendasi — TANPA perlu mengubah HTML/CSS/struktur
 * JS yang sudah ada (lihat js/exercise.js).
 *
 * Endpoint publik (tidak perlu login) — dipakai untuk menyusun & menampilkan
 * kartu latihan:
 *   GET  /api/exercises            → Menampilkan seluruh latihan (mendukung search & filter)
 *   GET  /api/exercises/:id        → Detail latihan
 *
 * Endpoint khusus admin — dipakai oleh panel "Kelola Data Latihan":
 *   POST   /api/exercises          → Tambah latihan
 *   PUT    /api/exercises/:id      → Edit latihan
 *   DELETE /api/exercises/:id      → Hapus latihan
 *
 * Query params untuk GET /api/exercises (semua opsional, bisa dikombinasikan):
 *   ?search=squat        → Search berdasarkan nama latihan (title)
 *   ?level=Beginner       → Filter berdasarkan level (Beginner | Intermediate | Expert)
 *   ?bodyPart=Chest        → Filter berdasarkan bodyPart
 *   ?equipment=Dumbbell    → Filter berdasarkan equipment
 *   ?type=Strength          → Filter berdasarkan type
 *
 * Semua endpoint mengembalikan JSON dengan bentuk:
 *   { ok: true, ... }             untuk sukses
 *   { ok: false, message: '...' } untuk gagal
 */

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const LEVELS = ['Beginner', 'Intermediate', 'Expert'];

/**
 * Bentuk objek latihan yang dikirim ke frontend. Nama field sengaja memakai
 * PascalCase (Title, Level, Equipment, BodyPart, Type, Desc) agar 100% cocok
 * dengan struktur objek dataset bawaan (js/dataset.js) yang sudah dipakai
 * di seluruh mesin rekomendasi (getAllExercises, forward chaining, dsb) —
 * sehingga tidak ada satu baris pun kode JS lama yang perlu diubah, meski
 * nama tabel & kolom di database (data_latihan / id_latihan / bodyPart /
 * `desc`) mengikuti ERD.
 */
function publicExercise(e) {
  return {
    id: e.id_latihan,
    Title: e.title,
    Desc: e.desc || '',
    Type: e.type || '',
    BodyPart: e.bodyPart || '',
    Equipment: e.equipment,
    Level: e.level,
    CreatedAt: e.created_at || null,
    // Relasi ERD "Admin — Mengelola (1:N) — Data Latihan": admin yang
    // menambahkan latihan ini. Null untuk data lama sebelum kolom
    // id_admin ada, atau bila akun admin pembuatnya sudah dihapus.
    IdAdmin: e.id_admin ?? null,
    AdminUsername: e.admin_username || null,
  };
}

/** Query dasar dengan LEFT JOIN ke admin supaya AdminUsername ikut terisi. */
const SELECT_BASE = `
  SELECT dl.*, a.username AS admin_username
  FROM data_latihan dl
  LEFT JOIN admin a ON a.id_admin = dl.id_admin
`;

/* ────────────────────────────────────────────────────────────
 * GET /api/exercises — Menampilkan seluruh latihan (publik),
 * dengan dukungan search & filter lewat query params.
 * ──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { search, level, bodyPart, equipment, type } = req.query;

    const where = [];
    const params = [];

    // Search latihan berdasarkan nama
    if (search) {
      where.push('dl.title LIKE ?');
      params.push(`%${search}%`);
    }
    // Filter berdasarkan level
    if (level) {
      where.push('dl.level = ?');
      params.push(level);
    }
    // Filter berdasarkan bodyPart
    if (bodyPart) {
      where.push('dl.bodyPart LIKE ?');
      params.push(`%${bodyPart}%`);
    }
    // Filter berdasarkan equipment
    if (equipment) {
      where.push('dl.equipment = ?');
      params.push(equipment);
    }
    // Filter berdasarkan type
    if (type) {
      where.push('dl.type = ?');
      params.push(type);
    }

    const sql = SELECT_BASE +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ` ORDER BY dl.title ASC`;

    const [rows] = await pool.query(sql, params);
    return res.json({ ok: true, exercises: rows.map(publicExercise) });
  } catch (e) {
    console.error('[GET /api/exercises]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/exercises/:id — Detail latihan (publik)
 * ──────────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`${SELECT_BASE} WHERE dl.id_latihan = ?`, [id]);
    const e = rows[0];
    if (!e) return res.status(404).json({ ok: false, message: 'Data latihan tidak ditemukan.' });
    return res.json({ ok: true, exercise: publicExercise(e) });
  } catch (err) {
    console.error('[GET /api/exercises/:id]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * POST /api/exercises — Tambah latihan (khusus admin)
 * body: { Title, Desc?, Type?, BodyPart?, Equipment?, Level? }
 * ──────────────────────────────────────────────────────────── */
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const title = String(req.body?.Title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'Nama latihan wajib diisi.' });
    }

    const desc = String(req.body?.Desc || '').trim();
    const type = String(req.body?.Type || '').trim();
    const bodyPart = String(req.body?.BodyPart || '').trim();
    const equipment = String(req.body?.Equipment || 'Body Only').trim();
    const level = LEVELS.includes(req.body?.Level) ? req.body.Level : 'Beginner';

    // Cegah duplikasi nama latihan (case-insensitive).
    const [dupRows] = await pool.query(
      `SELECT id_latihan FROM data_latihan WHERE LOWER(title) = LOWER(?)`,
      [title]
    );
    if (dupRows.length) {
      return res.status(409).json({ ok: false, message: 'Nama latihan sudah ada.' });
    }

    // req.user.id = id_admin dari sesi login admin yang sedang aktif
    // (lihat middleware/auth.js + routes/admin.js) — mencatat relasi ERD
    // "Admin — Mengelola (1:N) — Data Latihan" pada saat pembuatan.
    const [result] = await pool.query(
      `INSERT INTO data_latihan (title, \`desc\`, type, bodyPart, equipment, level, id_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, desc, type, bodyPart, equipment, level, req.user.id]
    );

    const [rows] = await pool.query(`${SELECT_BASE} WHERE dl.id_latihan = ?`, [result.insertId]);
    return res.status(201).json({
      ok: true,
      message: `"${title}" berhasil ditambahkan!`,
      exercise: publicExercise(rows[0]),
    });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, message: 'Nama latihan sudah ada.' });
    }
    console.error('[POST /api/exercises]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * PUT /api/exercises/:id — Edit latihan (khusus admin)
 * body sama seperti POST. Field yang tidak dikirim (undefined) akan
 * mempertahankan nilai lama.
 * ──────────────────────────────────────────────────────────── */
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT * FROM data_latihan WHERE id_latihan = ?`, [id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ ok: false, message: 'Data latihan tidak ditemukan.' });

    const title = req.body?.Title !== undefined ? String(req.body.Title).trim() : existing.title;
    if (!title) {
      return res.status(400).json({ ok: false, message: 'Nama latihan wajib diisi.' });
    }

    const desc = req.body?.Desc !== undefined ? String(req.body.Desc).trim() : existing.desc;
    const type = req.body?.Type !== undefined ? String(req.body.Type).trim() : existing.type;
    const bodyPart = req.body?.BodyPart !== undefined ? String(req.body.BodyPart).trim() : existing.bodyPart;
    const equipment = req.body?.Equipment !== undefined ? String(req.body.Equipment).trim() : existing.equipment;
    const level = req.body?.Level !== undefined
      ? (LEVELS.includes(req.body.Level) ? req.body.Level : existing.level)
      : existing.level;

    // Cegah duplikasi nama latihan pada baris LAIN (case-insensitive).
    const [dupRows] = await pool.query(
      `SELECT id_latihan FROM data_latihan WHERE LOWER(title) = LOWER(?) AND id_latihan != ?`,
      [title, id]
    );
    if (dupRows.length) {
      return res.status(409).json({ ok: false, message: 'Nama latihan sudah ada.' });
    }

    // Catatan: id_admin (admin yang MENAMBAHKAN latihan) sengaja TIDAK
    // diubah saat edit, supaya kolom ini tetap mencatat pembuat asli —
    // bukan admin terakhir yang mengedit.
    await pool.query(
      `UPDATE data_latihan
       SET title = ?, \`desc\` = ?, type = ?, bodyPart = ?, equipment = ?, level = ?
       WHERE id_latihan = ?`,
      [title, desc, type, bodyPart, equipment, level, id]
    );

    const [rows2] = await pool.query(`${SELECT_BASE} WHERE dl.id_latihan = ?`, [id]);
    return res.json({
      ok: true,
      message: `"${title}" diperbarui!`,
      exercise: publicExercise(rows2[0]),
    });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, message: 'Nama latihan sudah ada.' });
    }
    console.error('[PUT /api/exercises/:id]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * DELETE /api/exercises/:id — Hapus latihan (khusus admin)
 * ──────────────────────────────────────────────────────────── */
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT * FROM data_latihan WHERE id_latihan = ?`, [id]);
    const e = rows[0];
    if (!e) return res.status(404).json({ ok: false, message: 'Data latihan tidak ditemukan.' });

    await pool.query(`DELETE FROM data_latihan WHERE id_latihan = ?`, [id]);
    return res.json({ ok: true, message: `"${e.title}" dihapus.` });
  } catch (err) {
    console.error('[DELETE /api/exercises/:id]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;
