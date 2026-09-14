/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/admin.js — Endpoint API khusus Login Admin
 *
 * Tabel yang dipakai (sesuai ERD, TIDAK ada tabel baru):
 *   admin(id_admin, username, password)
 *
 * Backend ini HANYA menangani proses login/logout/cek status login admin.
 * Tidak ada endpoint lain (mis. kelola data admin) di file ini.
 *
 * Semua endpoint mengembalikan JSON dengan bentuk:
 *   { ok: true, ... }             untuk sukses
 *   { ok: false, message: '...' } untuk gagal
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const sessionStore = require('../store/sessions');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function publicAdmin(row) {
  return { id: row.id_admin, username: row.username, role: 'admin' };
}

/* ────────────────────────────────────────────────────────────
 * POST /api/admin/login
 * body: { username, password }
 * ──────────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Harap isi username dan password.' });
    }

    const [rows] = await pool.query(`SELECT * FROM admin WHERE username = ?`, [username]);
    const admin = rows[0];

    // Password divalidasi secara aman lewat bcrypt.compare (tidak pernah
    // membandingkan plain text), dan pesan error dibuat generik supaya
    // tidak membocorkan apakah username terdaftar atau tidak.
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ ok: false, message: 'Username atau password admin salah.' });
    }

    const { token, expiresAt } = sessionStore.create('admin', {
      id: admin.id_admin,
      username: admin.username,
    });

    return res.json({ ok: true, token, expiresAt, user: publicAdmin(admin) });
  } catch (e) {
    console.error('[POST /api/admin/login]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server. Coba lagi.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * POST /api/admin/logout
 * header: Authorization: Bearer <token>
 * ──────────────────────────────────────────────────────────── */
router.post('/logout', requireAuth, requireRole('admin'), (req, res) => {
  sessionStore.destroy(req.token);
  return res.json({ ok: true, message: 'Berhasil logout admin.' });
});

/* ────────────────────────────────────────────────────────────
 * GET /api/admin/status — cek status login admin (dipakai saat halaman
 * dimuat ulang untuk memulihkan sesi yang masih aktif)
 * header: Authorization: Bearer <token>
 * ──────────────────────────────────────────────────────────── */
router.get('/status', requireAuth, requireRole('admin'), (req, res) => {
  return res.json({ ok: true, loggedIn: true, user: req.user });
});

module.exports = router;
