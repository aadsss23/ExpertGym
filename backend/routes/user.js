/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/user.js — Endpoint API khusus Registrasi & Login User
 *
 * Tabel yang dipakai (sesuai ERD, TIDAK ada tabel baru):
 *   user(id_user, nama, username, password)
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

function publicUser(row) {
  return { id: row.id_user, nama: row.nama, username: row.username, role: 'user' };
}

/* ────────────────────────────────────────────────────────────
 * POST /api/user/register
 * body: { nama, username, password }
 * Validasi: username tidak boleh sama (unik), password disimpan ter-hash.
 * ──────────────────────────────────────────────────────────── */
router.post('/register', async (req, res) => {
  try {
    const nama = String(req.body?.nama || '').trim();
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!nama || !username || !password) {
      return res.status(400).json({ ok: false, message: 'Harap lengkapi semua kolom.' });
    }
    if (nama.length < 3) {
      return res.status(400).json({ ok: false, message: 'Nama lengkap minimal 3 karakter.' });
    }
    if (username.length < 3) {
      return res.status(400).json({ ok: false, message: 'Username minimal 3 karakter.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ ok: false, message: 'Username hanya boleh huruf, angka, dan underscore.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, message: 'Password minimal 6 karakter.' });
    }

    // Username tidak boleh sama — dicek di tabel user, dan juga di tabel
    // admin supaya tidak ada dua akun berbeda dengan username identik.
    const [existingUser] = await pool.query(`SELECT id_user FROM user WHERE username = ?`, [username]);
    if (existingUser.length > 0) {
      return res.status(409).json({ ok: false, message: 'Username sudah digunakan. Pilih yang lain.' });
    }
    const [existingAdmin] = await pool.query(`SELECT id_admin FROM admin WHERE username = ?`, [username]);
    if (existingAdmin.length > 0) {
      return res.status(409).json({ ok: false, message: 'Username sudah digunakan. Pilih yang lain.' });
    }

    // Password disimpan secara aman (hash bcrypt), tidak pernah plain text.
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO user (nama, username, password) VALUES (?, ?, ?)`,
      [nama, username, passwordHash]
    );

    const [rows] = await pool.query(`SELECT * FROM user WHERE id_user = ?`, [result.insertId]);

    return res.status(201).json({ ok: true, message: 'Registrasi berhasil! Silakan login.', user: publicUser(rows[0]) });
  } catch (e) {
    console.error('[POST /api/user/register]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server. Coba lagi.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * POST /api/user/login
 * body: { username, password }
 * ──────────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Harap isi username dan password.' });
    }

    const [rows] = await pool.query(`SELECT * FROM user WHERE username = ?`, [username]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ ok: false, message: 'Username atau password salah.' });
    }

    const { token, expiresAt } = sessionStore.create('user', {
      id: user.id_user,
      username: user.username,
      nama: user.nama,
    });

    return res.json({ ok: true, token, expiresAt, user: publicUser(user) });
  } catch (e) {
    console.error('[POST /api/user/login]', e);
    return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server. Coba lagi.' });
  }
});

/* ────────────────────────────────────────────────────────────
 * POST /api/user/logout
 * header: Authorization: Bearer <token>
 * ──────────────────────────────────────────────────────────── */
router.post('/logout', requireAuth, requireRole('user'), (req, res) => {
  sessionStore.destroy(req.token);
  return res.json({ ok: true, message: 'Berhasil logout.' });
});

/* ────────────────────────────────────────────────────────────
 * GET /api/user/status — cek session login user (dipakai saat halaman
 * dimuat ulang untuk memulihkan sesi yang masih aktif, dan untuk
 * memastikan user boleh mengakses seluruh fitur user)
 * header: Authorization: Bearer <token>
 * ──────────────────────────────────────────────────────────── */
router.get('/status', requireAuth, requireRole('user'), (req, res) => {
  return res.json({ ok: true, loggedIn: true, user: req.user });
});

module.exports = router;
