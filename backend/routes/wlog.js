/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/wlog.js — Endpoint API Workout Log (MySQL)
 *
 * Tabel database: `workout_log`. Kolom inti mengikuti kebutuhan ERD:
 *   id_log, id_riwayat, hari_ke, status_selesai, tanggal_selesai
 *
 * (+ kolom tambahan `detail_latihan` — JSON berisi status centang per
 *  latihan dalam satu hari, mis. [{title, bodyPart, equipment, level,
 *  desc, done}]. Ini dibutuhkan supaya checklist latihan per-hari di UI
 *  Workout Log (js/wlog.js) tetap berfungsi persis seperti versi
 *  localStorage sebelumnya, bukan cuma status selesai/belum per hari.)
 *
 * Satu "progres" = satu id_riwayat, berisi beberapa baris (satu per
 * hari_ke yang sudah disentuh/dicentang). Endpoint PUT selalu mengganti
 * SELURUH baris hari untuk satu id_riwayat sekaligus (upsert penuh) —
 * mengikuti cara frontend menyimpan (selalu menulis ulang seluruh
 * dayStatus, bukan per-field).
 *
 * Semua endpoint KHUSUS akun bertipe `user`. id_user SELALU diambil dari
 * sesi login (token), tidak pernah dipercaya dari body/parameter.
 *
 * Endpoint:
 *   PUT    /api/wlog/:idRiwayat  → Menyimpan/memperbarui progres satu riwayat
 *   GET    /api/wlog             → Menampilkan seluruh progres milik user (semua riwayat)
 *   GET    /api/wlog/:idRiwayat  → Detail progres satu riwayat
 *   DELETE /api/wlog/:idRiwayat  → Menghapus progres satu riwayat (reset/hapus program aktif)
 *
 * Semua endpoint mengembalikan JSON dengan bentuk:
 *   { ok: true, ... }             untuk sukses
 *   { ok: false, message: '...' } untuk gagal
 */

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Semua endpoint workout log wajib login sebagai user.
router.use(requireAuth, requireRole('user'));

function toDayStatus(row) {
  let exercises = [];
  try {
    exercises = JSON.parse(row.detail_latihan) || [];
  } catch (_) {
    exercises = [];
  }
  return {
    done: !!row.status_selesai,
    finishedAt: row.tanggal_selesai ? new Date(row.tanggal_selesai).getTime() : null,
    exercises,
  };
}

/* ────────────────────────────────────────────────────────────
 * PUT /api/wlog/:idRiwayat — Menyimpan/memperbarui progres satu riwayat.
 * body: dayStatus lengkap, bentuk { [hari_ke]: { done, finishedAt, exercises } }
 * (persis bentuk `eg_wlogStatus_*` di localStorage, lihat js/wlog.js)
 * ──────────────────────────────────────────────────────────── */
router.put('/:idRiwayat', async (req, res) => {
  try {
    const idUser = req.user.id;
    const idRiwayat = Number(req.params.idRiwayat);
    if (!Number.isFinite(idRiwayat) || idRiwayat <= 0) {
      return res.status(400).json({ ok: false, message: 'ID riwayat tidak valid.' });
    }

    const dayStatus = req.body && typeof req.body === 'object' ? req.body : {};
    const entries = Object.entries(dayStatus).filter(([hariKe]) => Number.isFinite(Number(hariKe)));

    // Ganti seluruh baris hari untuk riwayat ini (upsert penuh).
    await pool.query(`DELETE FROM workout_log WHERE id_riwayat = ? AND id_user = ?`, [idRiwayat, idUser]);

    for (const [hariKe, d] of entries) {
      const statusSelesai = d && d.done ? 1 : 0;
      const tanggalSelesai = d && d.finishedAt ? new Date(d.finishedAt) : null;
      const detailLatihan = JSON.stringify((d && d.exercises) || []);
      await pool.query(
        `INSERT INTO workout_log (id_riwayat, id_user, hari_ke, status_selesai, tanggal_selesai, detail_latihan)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idRiwayat, idUser, Number(hariKe), statusSelesai, tanggalSelesai, detailLatihan]
      );
    }

    return res.json({ ok: true, message: 'Progres workout log disimpan.' });
  } catch (e) {
    console.error('[PUT /api/wlog/:idRiwayat]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/wlog — Menampilkan seluruh progres milik user (semua riwayat
 * sekaligus), dikelompokkan per id_riwayat.
 * ──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const idUser = req.user.id;
    const [rows] = await pool.query(
      `SELECT * FROM workout_log WHERE id_user = ? ORDER BY id_riwayat, hari_ke`,
      [idUser]
    );

    const grouped = {};
    for (const row of rows) {
      const key = String(row.id_riwayat);
      if (!grouped[key]) grouped[key] = {};
      grouped[key][String(row.hari_ke)] = toDayStatus(row);
    }

    return res.json({ ok: true, wlog: grouped });
  } catch (err) {
    console.error('[GET /api/wlog]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/wlog/:idRiwayat — Detail progres satu riwayat (dayStatus).
 * ──────────────────────────────────────────────────────────── */
router.get('/:idRiwayat', async (req, res) => {
  try {
    const idUser = req.user.id;
    const idRiwayat = Number(req.params.idRiwayat);
    const [rows] = await pool.query(
      `SELECT * FROM workout_log WHERE id_riwayat = ? AND id_user = ? ORDER BY hari_ke`,
      [idRiwayat, idUser]
    );

    const dayStatus = {};
    rows.forEach((row) => {
      dayStatus[String(row.hari_ke)] = toDayStatus(row);
    });

    return res.json({ ok: true, dayStatus });
  } catch (err) {
    console.error('[GET /api/wlog/:idRiwayat]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * DELETE /api/wlog/:idRiwayat — Menghapus seluruh progres satu riwayat
 * (dipakai fitur "Hapus Program Aktif" / reset penuh).
 * ──────────────────────────────────────────────────────────── */
router.delete('/:idRiwayat', async (req, res) => {
  try {
    const idUser = req.user.id;
    const idRiwayat = Number(req.params.idRiwayat);
    await pool.query(`DELETE FROM workout_log WHERE id_riwayat = ? AND id_user = ?`, [idRiwayat, idUser]);
    // Idempotent: sukses meski baris tidak ditemukan (sudah terhapus sebelumnya).
    return res.json({ ok: true, message: 'Progres workout log dihapus.' });
  } catch (err) {
    console.error('[DELETE /api/wlog/:idRiwayat]', err);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;
