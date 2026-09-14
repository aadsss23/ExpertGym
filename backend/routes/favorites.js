/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/favorites.js — Endpoint API Favorit (MySQL)
 *
 * Tabel database: `favorit` (sesuai ERD), kolom:
 *   id_favorit, id_user, id_latihan
 *
 * (+ kolom tambahan `title` — lihat catatan panjang di backend/db.js:
 *  2.611 latihan bawaan js/dataset.js tidak tersimpan di tabel manapun,
 *  jadi tidak semua latihan punya id_latihan yang valid. `title` dipakai
 *  sebagai kunci pencocokan yang selalu ada untuk SEMUA latihan.)
 *
 * Semua endpoint di file ini KHUSUS untuk akun bertipe `user` (bukan admin),
 * karena favorit adalah fitur milik user, dan id_user diambil otomatis dari
 * sesi login (token), tidak perlu dikirim dari frontend.
 *
 * Endpoint:
 *   POST   /api/favorites            → Menambahkan latihan ke favorit
 *   DELETE /api/favorites/:title     → Menghapus latihan dari favorit
 *   GET    /api/favorites            → Menampilkan seluruh daftar favorit milik user
 *   GET    /api/favorites/check      → Mengecek apakah latihan sudah menjadi favorit
 *
 * Semua endpoint mengembalikan JSON dengan bentuk:
 *   { ok: true, ... }             untuk sukses
 *   { ok: false, message: '...' } untuk gagal
 */

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Semua endpoint favorit wajib login sebagai user.
router.use(requireAuth, requireRole('user'));

function publicFavorite(f) {
  return {
    id_favorit: f.id_favorit,
    title: f.title,
    id_latihan: f.id_latihan,
  };
}

/* ────────────────────────────────────────────────────────────
 * POST /api/favorites — Menambahkan latihan ke favorit
 * body: { Title }
 * ──────────────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const title = String(req.body?.Title || req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'Judul latihan wajib diisi.' });
    }
    const idUser = req.user.id;

    // Cari id_latihan kalau latihan ini berasal dari tabel data_latihan
    // (latihan kelolaan admin). Kalau tidak ditemukan (mis. latihan dari
    // dataset bawaan), id_latihan disimpan NULL — tetap valid, dicocokkan
    // lewat title.
    const [dl] = await pool.query(
      `SELECT id_latihan FROM data_latihan WHERE title = ? LIMIT 1`,
      [title]
    );
    const idLatihan = dl[0]?.id_latihan ?? null;

    // Sudah difavoritkan sebelumnya → anggap sukses (idempotent), bukan error.
    const [existing] = await pool.query(
      `SELECT * FROM favorit WHERE id_user = ? AND title = ?`,
      [idUser, title]
    );
    if (existing.length) {
      return res.json({ ok: true, message: 'Sudah ada di favorit.', favorite: publicFavorite(existing[0]) });
    }

    const [result] = await pool.query(
      `INSERT INTO favorit (id_user, id_latihan, title) VALUES (?, ?, ?)`,
      [idUser, idLatihan, title]
    );

    return res.status(201).json({
      ok: true,
      message: `"${title}" disimpan ke favorit.`,
      favorite: { id_favorit: result.insertId, title, id_latihan: idLatihan },
    });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.json({ ok: true, message: 'Sudah ada di favorit.' });
    }
    console.error('[POST /api/favorites]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * DELETE /api/favorites/:title — Menghapus latihan dari favorit
 * ──────────────────────────────────────────────────────────── */
router.delete('/:title', async (req, res) => {
  try {
    const title = decodeURIComponent(req.params.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'Judul latihan wajib diisi.' });
    }
    const idUser = req.user.id;

    await pool.query(`DELETE FROM favorit WHERE id_user = ? AND title = ?`, [idUser, title]);
    // Idempotent: sukses meski baris tidak ditemukan (sudah terhapus sebelumnya).
    return res.json({ ok: true, message: `"${title}" dihapus dari favorit.` });
  } catch (err) {
    console.error('[DELETE /api/favorites/:title]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/favorites — Menampilkan seluruh daftar favorit milik user
 * ──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const idUser = req.user.id;
    const [rows] = await pool.query(
      `SELECT * FROM favorit WHERE id_user = ? ORDER BY id_favorit DESC`,
      [idUser]
    );
    return res.json({ ok: true, favorites: rows.map(publicFavorite) });
  } catch (err) {
    console.error('[GET /api/favorites]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/favorites/check?title=... — Mengecek apakah latihan sudah
 * menjadi favorit milik user yang sedang login.
 * ──────────────────────────────────────────────────────────── */
router.get('/check', async (req, res) => {
  try {
    const title = String(req.query?.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'Judul latihan wajib diisi.' });
    }
    const idUser = req.user.id;
    const [rows] = await pool.query(
      `SELECT id_favorit FROM favorit WHERE id_user = ? AND title = ?`,
      [idUser, title]
    );
    return res.json({ ok: true, isFavorite: rows.length > 0 });
  } catch (err) {
    console.error('[GET /api/favorites/check]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;
