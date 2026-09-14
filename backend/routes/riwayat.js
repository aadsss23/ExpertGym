/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/riwayat.js — Endpoint API Riwayat Rekomendasi (MySQL)
 *
 * Tabel database: `riwayat_rekomendasi` (sesuai ERD), kolom:
 *   id_riwayat, id_user, tingkat_kemampuan, alat_dipilih, label, tanggal
 *
 * (+ kolom tambahan `snapshot` — lihat catatan panjang di backend/db.js:
 *  satu sesi rekomendasi sebenarnya berisi program latihan 7 hari penuh +
 *  jawaban asesmen, dipakai untuk menampilkan ulang detail riwayat & fitur
 *  "Muat Program dari Riwayat" tanpa asesmen ulang. `snapshot` menyimpan
 *  seluruh data itu dalam JSON; 5 kolom ERD tetap ada sebagai ringkasan.)
 *
 * Semua endpoint KHUSUS akun bertipe `user`. id_user SELALU diambil dari
 * sesi login (token) — TIDAK PERNAH dipercaya dari body/parameter request —
 * sehingga data riwayat pasti sesuai user yang sedang login.
 *
 * Endpoint:
 *   POST   /api/riwayat         → Menyimpan hasil rekomendasi setelah asesmen selesai
 *   GET    /api/riwayat         → Menampilkan seluruh riwayat rekomendasi milik user
 *   GET    /api/riwayat/:id     → Detail riwayat rekomendasi
 *   DELETE /api/riwayat/:id     → Menghapus riwayat rekomendasi tertentu
 *
 * Semua endpoint mengembalikan JSON dengan bentuk:
 *   { ok: true, ... }             untuk sukses
 *   { ok: false, message: '...' } untuk gagal
 */

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Semua endpoint riwayat wajib login sebagai user.
router.use(requireAuth, requireRole('user'));

/** Rekonstruksi record riwayat lengkap (bentuk asli yang dipakai app.js)
 *  dari baris tabel, dengan mengutamakan isi `snapshot` (JSON lengkap). */
function toRecord(row) {
  let snap = {};
  try {
    snap = JSON.parse(row.snapshot) || {};
  } catch (_) {
    snap = {};
  }
  return {
    ...snap,
    id: Number(row.id_riwayat),
    userId: row.id_user,
    // Kolom ERD (tetap disertakan eksplisit, walau biasanya sudah ada di snapshot juga)
    tingkat_kemampuan: row.tingkat_kemampuan,
    alat_dipilih: row.alat_dipilih,
    label: row.label,
    tanggal: row.tanggal,
  };
}

/* ────────────────────────────────────────────────────────────
 * POST /api/riwayat — Menyimpan hasil rekomendasi setelah asesmen selesai.
 * body: record rekomendasi lengkap dari frontend (id, level, matchedRule,
 *        equipments, weekPlan, assessmentAnswers, dst — lihat saveHistory
 *        di js/auth.js / js/riwayat.js).
 * ──────────────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const idRiwayat = Number(body.id);
    if (!Number.isFinite(idRiwayat) || idRiwayat <= 0) {
      return res.status(400).json({ ok: false, message: 'ID riwayat tidak valid.' });
    }

    const idUser = req.user.id; // dari token, bukan dari body
    const tingkatKemampuan = String(body.level || body.levelBase || '-').trim();
    const alatDipilih = Array.isArray(body.equipments) ? body.equipments.join(', ') : '';
    const label = String(body.matchedRule || '-').trim();
    const tanggal = body.createdAt ? new Date(body.createdAt) : new Date();
    const snapshot = JSON.stringify({ ...body, userId: idUser });

    await pool.query(
      `INSERT INTO riwayat_rekomendasi
         (id_riwayat, id_user, tingkat_kemampuan, alat_dipilih, label, tanggal, snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tingkat_kemampuan = VALUES(tingkat_kemampuan),
         alat_dipilih = VALUES(alat_dipilih),
         label = VALUES(label),
         tanggal = VALUES(tanggal),
         snapshot = VALUES(snapshot)`,
      [idRiwayat, idUser, tingkatKemampuan, alatDipilih, label, tanggal, snapshot]
    );

    const [rows] = await pool.query(
      `SELECT * FROM riwayat_rekomendasi WHERE id_riwayat = ? AND id_user = ?`,
      [idRiwayat, idUser]
    );
    if (!rows.length) {
      return res.status(500).json({ ok: false, message: 'Gagal menyimpan riwayat.' });
    }

    return res.status(201).json({ ok: true, message: 'Riwayat rekomendasi disimpan.', riwayat: toRecord(rows[0]) });
  } catch (e) {
    console.error('[POST /api/riwayat]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/riwayat — Menampilkan seluruh riwayat rekomendasi milik user
 * yang sedang login, terbaru lebih dulu.
 * ──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const idUser = req.user.id;
    const [rows] = await pool.query(
      `SELECT * FROM riwayat_rekomendasi WHERE id_user = ? ORDER BY tanggal DESC`,
      [idUser]
    );
    return res.json({ ok: true, history: rows.map(toRecord) });
  } catch (err) {
    console.error('[GET /api/riwayat]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/riwayat/:id — Detail satu riwayat rekomendasi milik user yang
 * sedang login.
 * ──────────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const idUser = req.user.id;
    const idRiwayat = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT * FROM riwayat_rekomendasi WHERE id_riwayat = ? AND id_user = ?`,
      [idRiwayat, idUser]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Riwayat tidak ditemukan.' });
    }
    return res.json({ ok: true, riwayat: toRecord(rows[0]) });
  } catch (err) {
    console.error('[GET /api/riwayat/:id]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * DELETE /api/riwayat/:id — Menghapus riwayat rekomendasi tertentu milik
 * user yang sedang login.
 * ──────────────────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const idUser = req.user.id;
    const idRiwayat = Number(req.params.id);
    await pool.query(
      `DELETE FROM riwayat_rekomendasi WHERE id_riwayat = ? AND id_user = ?`,
      [idRiwayat, idUser]
    );
    // Idempotent: sukses meski baris tidak ditemukan (sudah terhapus sebelumnya).
    return res.json({ ok: true, message: 'Riwayat rekomendasi dihapus.' });
  } catch (err) {
    console.error('[DELETE /api/riwayat/:id]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;
