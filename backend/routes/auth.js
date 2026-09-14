/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * routes/auth.js — Jembatan kompatibilitas untuk js/auth.js (frontend lama)
 *
 * File js/auth.js (frontend) TIDAK diubah sama sekali. Di dalamnya ada
 * logika bawaan `checkActiveSession()` yang otomatis memanggil
 * GET /api/auth/me saat halaman dimuat ulang, untuk memulihkan sesi login
 * yang tersimpan di localStorage (key `eg_token`).
 *
 * Endpoint di bawah ini HANYA menjembatani pemanggilan lama tsb ke sistem
 * sesi baru (store/sessions.js) yang membedakan admin & user — supaya
 * pemulihan sesi otomatis saat refresh halaman tetap berfungsi, baik untuk
 * admin maupun user, TANPA perlu mengubah js/auth.js.
 *
 * Proses login/register/logout yang sesungguhnya ada di:
 *   - routes/admin.js  → POST /api/admin/login, /logout, GET /api/admin/status
 *   - routes/user.js   → POST /api/user/register, /login, /logout, GET /api/user/status
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/auth/me — dipanggil otomatis oleh js/auth.js saat halaman dimuat ulang
router.get('/me', requireAuth, (req, res) => {
  return res.json({ ok: true, user: req.user });
});

module.exports = router;
