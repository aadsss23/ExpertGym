/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/trainers.js — Endpoint API Kelola Personal Trainer (MySQL)
 *
 * Endpoint publik (tidak perlu login) — dipakai untuk menampilkan section
 * "Divalidasi oleh Personal Trainer" di halaman utama:
 *   GET  /api/trainers        → daftar trainer
 *   GET  /api/trainers/:id    → detail satu trainer
 *
 * Endpoint khusus admin — dipakai oleh panel "Kelola Profil Personal Trainer":
 *   POST   /api/trainers      → tambah trainer
 *   PUT    /api/trainers/:id  → edit trainer
 *   DELETE /api/trainers/:id  → hapus trainer
 *
 * Semua endpoint mengembalikan JSON dengan bentuk:
 *   { ok: true, ... }             untuk sukses
 *   { ok: false, message: '...' } untuk gagal
 */

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function safeParseArray(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

/**
 * Bentuk objek trainer yang dikirim ke frontend — sesuai struktur yang
 * dipakai js/app.js. Kolom database memakai Bahasa Indonesia (nama,
 * spesialisasi, pengalaman, kontak, sertifikasi, kontribusi, foto,
 * file_sertifikat) supaya konsisten dengan tabel lain, tapi bentuk JSON ke
 * frontend tetap dipertahankan (name, title, experience, ...) supaya tidak
 * perlu mengubah kode frontend.
 */
function publicTrainer(t) {
  return {
    id: t.id_trainers,
    name: t.nama,
    title: t.spesialisasi,
    experience: t.pengalaman || '',
    contact: t.kontak || '',
    certs: safeParseArray(t.sertifikasi),
    contrib: safeParseArray(t.kontribusi),
    hasCert: !!t.file_sertifikat,
    photo: t.foto || null,
    cert: t.file_sertifikat || null,
  };
}

/* ────────────────────────────────────────────────────────────
 * GET /api/trainers — Daftar trainer (publik)
 * ──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM trainers ORDER BY id_trainers ASC`);
    return res.json({ ok: true, trainers: rows.map(publicTrainer) });
  } catch (e) {
    console.error('[GET /api/trainers]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET /api/trainers/:id — Detail trainer (publik)
 * ──────────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT * FROM trainers WHERE id_trainers = ?`, [id]);
    const t = rows[0];
    if (!t) return res.status(404).json({ ok: false, message: 'Trainer tidak ditemukan.' });
    return res.json({ ok: true, trainer: publicTrainer(t) });
  } catch (e) {
    console.error('[GET /api/trainers/:id]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * POST /api/trainers — Tambah trainer (khusus admin)
 * body: { name, title, experience?, contact?, certs?, contrib?, photo?, cert? }
 * ──────────────────────────────────────────────────────────── */
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const title = String(req.body?.title || '').trim();
    const experience = String(req.body?.experience || '').trim();
    const contact = String(req.body?.contact || '').trim();
    const certs = Array.isArray(req.body?.certs) ? req.body.certs : [];
    const contrib = Array.isArray(req.body?.contrib) ? req.body.contrib : [];
    const photo = req.body?.photo || null;
    const certFile = req.body?.cert || null;

    if (!name || !title) {
      return res.status(400).json({ ok: false, message: 'Nama dan Spesialisasi wajib diisi.' });
    }

    const [result] = await pool.query(
      `INSERT INTO trainers (nama, spesialisasi, pengalaman, kontak, sertifikasi, kontribusi, foto, file_sertifikat, id_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, title, experience, contact, JSON.stringify(certs), JSON.stringify(contrib), photo, certFile, req.user.id]
    );

    const [rows] = await pool.query(`SELECT * FROM trainers WHERE id_trainers = ?`, [result.insertId]);
    return res.status(201).json({
      ok: true,
      message: `Trainer "${name}" berhasil ditambahkan.`,
      trainer: publicTrainer(rows[0]),
    });
  } catch (e) {
    console.error('[POST /api/trainers]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * PUT /api/trainers/:id — Edit trainer (khusus admin)
 * body: { name, title, experience?, contact?, certs?, contrib?, photo?, cert? }
 * Catatan: field photo/cert yang tidak dikirim (undefined) berarti "biarkan
 * foto/sertifikat lama". Kirim null secara eksplisit untuk menghapusnya.
 * ──────────────────────────────────────────────────────────── */
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT * FROM trainers WHERE id_trainers = ?`, [id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ ok: false, message: 'Trainer tidak ditemukan.' });

    const name = String(req.body?.name || '').trim();
    const title = String(req.body?.title || '').trim();
    const experience = String(req.body?.experience || '').trim();
    const contact = String(req.body?.contact || '').trim();
    const certs = Array.isArray(req.body?.certs) ? req.body.certs : [];
    const contrib = Array.isArray(req.body?.contrib) ? req.body.contrib : [];

    if (!name || !title) {
      return res.status(400).json({ ok: false, message: 'Nama dan Spesialisasi wajib diisi.' });
    }

    const photo = req.body?.photo !== undefined ? req.body.photo : existing.foto;
    const certFile = req.body?.cert !== undefined ? req.body.cert : existing.file_sertifikat;

    await pool.query(
      `UPDATE trainers
       SET nama = ?, spesialisasi = ?, pengalaman = ?, kontak = ?, sertifikasi = ?, kontribusi = ?, foto = ?, file_sertifikat = ?
       WHERE id_trainers = ?`,
      [name, title, experience, contact, JSON.stringify(certs), JSON.stringify(contrib), photo, certFile, id]
    );

    const [rows2] = await pool.query(`SELECT * FROM trainers WHERE id_trainers = ?`, [id]);
    return res.json({
      ok: true,
      message: `Profil "${name}" berhasil diperbarui.`,
      trainer: publicTrainer(rows2[0]),
    });
  } catch (e) {
    console.error('[PUT /api/trainers/:id]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * DELETE /api/trainers/:id — Hapus trainer (khusus admin)
 * ──────────────────────────────────────────────────────────── */
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT * FROM trainers WHERE id_trainers = ?`, [id]);
    const t = rows[0];
    if (!t) return res.status(404).json({ ok: false, message: 'Trainer tidak ditemukan.' });

    await pool.query(`DELETE FROM trainers WHERE id_trainers = ?`, [id]);
    return res.json({ ok: true, message: `Trainer "${t.nama}" berhasil dihapus.` });
  } catch (e) {
    console.error('[DELETE /api/trainers/:id]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
});

module.exports = router;
