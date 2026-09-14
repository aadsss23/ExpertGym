/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * middleware/auth.js — Verifikasi token sesi login & pembatasan akses per-role
 *
 * Sesi login (admin maupun user) diverifikasi lewat in-memory session store
 * (lihat store/sessions.js), BUKAN lewat tabel database — sesuai ketentuan
 * "jangan membuat tabel baru" (hanya tabel `admin` dan `user` yang ada di ERD).
 *
 * req.user diisi dengan { id, username, nama?, role } di mana role bernilai
 * 'admin' atau 'user', supaya kompatibel dengan middleware requireRole('admin')
 * yang sudah dipakai lebih dulu oleh routes/trainers.js dan routes/exercises.js
 * (fitur Kelola Personal Trainer & Kelola Data Latihan) — kedua file itu TIDAK
 * perlu diubah sama sekali.
 */

const sessionStore = require('../store/sessions');

/** Ambil token dari header Authorization: Bearer <token> */
function extractToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/** Wajib login (admin ATAU user). Melampirkan req.user jika token valid. */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token tidak ditemukan. Silakan login.' });
  }

  const session = sessionStore.get(token);
  if (!session) {
    return res.status(401).json({ ok: false, message: 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.' });
  }

  req.user = {
    id: session.id,
    username: session.username,
    nama: session.nama,
    role: session.type, // 'admin' | 'user'
  };
  req.token = token;
  next();
}

/** Wajib salah satu dari role yang diizinkan (panggil setelah requireAuth). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, message: 'Anda tidak memiliki akses untuk aksi ini.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, extractToken };
