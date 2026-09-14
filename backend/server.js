/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website (Backend/API)
 *
 * server.js — Entry point backend ExpertGym
 *
 * Menyediakan:
 *   - API JSON Login Admin di /api/admin/*
 *   - API JSON Registrasi & Login User di /api/user/*
 *   - File statis frontend (index.html, css/, js/) TANPA mengubah strukturnya
 *
 * Menjalankan frontend & backend dari satu proses agar tidak perlu
 * konfigurasi CORS tambahan, namun kode tetap dipisah rapi:
 *   backend/   → seluruh logika server (routes, db, middleware)
 *   ../ (root) → frontend murni (html, css, js) — tidak disentuh strukturnya
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

const { initDb } = require('./db');
const authRoutes = require('./routes/auth');       // jembatan lama: GET /api/auth/me
const adminRoutes = require('./routes/admin');      // Login/Logout/Status Admin
const userRoutes = require('./routes/user');        // Register/Login/Logout/Status User
const trainerRoutes = require('./routes/trainers');
const exerciseRoutes = require('./routes/exercises');
const favoriteRoutes = require('./routes/favorites'); // Favorit
const riwayatRoutes = require('./routes/riwayat');     // Riwayat Rekomendasi
const wlogRoutes = require('./routes/wlog');            // Workout Log

const app = express();
const PORT = process.env.PORT || 3000;

// Struktur frontend sebenarnya:
//   frontend/src/index.html  + frontend/src/js/*.js  (referensi relatif: "js/...")
//   frontend/public/css/*.css                        (referensi relatif: "../public/css/...")
const FRONTEND_SRC_DIR = path.join(__dirname, '..', 'frontend', 'src');
const FRONTEND_PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');

app.use(cors());
// Limit dinaikkan (default express.json() hanya 100kb) karena foto & file
// sertifikat trainer dikirim sebagai base64 data URI yang ukurannya bisa
// jauh lebih besar dari teks biasa.
app.use(express.json({ limit: '15mb' }));

// ── API ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);   // jembatan lama (GET /me) — untuk js/auth.js
app.use('/api/admin', adminRoutes); // Login/Logout/Cek Status Admin
app.use('/api/user', userRoutes);   // Register/Login/Logout/Cek Session User
app.use('/api/trainers', trainerRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/favorites', favoriteRoutes); // Favorit
app.use('/api/riwayat', riwayatRoutes);     // Riwayat Rekomendasi
app.use('/api/wlog', wlogRoutes);           // Workout Log

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'ExpertGym API berjalan.' });
});

// ── FRONTEND (statis, tidak diubah) ────────────────────────
// index.html + js/*.js di-serve dari root ("/"), sesuai referensi <script src="js/...">
app.use(express.static(FRONTEND_SRC_DIR));
// css/*.css di-serve di "/public", sesuai referensi <link href="../public/css/...">
// (relatif terhadap index.html yang di-load di "/", "../public/..." resolve ke "/public/...")
app.use('/public', express.static(FRONTEND_PUBLIC_DIR));

// Fallback: arahkan rute non-API ke index.html (single page app)
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_SRC_DIR, 'index.html'));
});

// ── ERROR HANDLER ───────────────────────────────────────────
// Menangkap error body-parser (mis. JSON tidak valid / body terlalu besar)
// agar respons tetap JSON dan pesannya jelas, bukan halaman HTML default.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      ok: false,
      message: 'Ukuran foto/sertifikat terlalu besar. Gunakan file yang lebih kecil (maks. sekitar 10MB).',
    });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, message: 'Data yang dikirim tidak valid.' });
  }
  console.error('[Unhandled error]', err);
  return res.status(500).json({ ok: false, message: 'Terjadi kesalahan pada server.' });
});

// ── START ───────────────────────────────────────────────────
// Pastikan koneksi MySQL + skema + seed akun default siap sebelum menerima request.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n[ExpertGym] Terhubung ke MySQL database "${process.env.DB_NAME || 'expertgym'}"`);
      console.log(`[ExpertGym] Server berjalan di http://localhost:${PORT}`);
      console.log(`[ExpertGym] API Admin  di http://localhost:${PORT}/api/admin`);
      console.log(`[ExpertGym] API User   di http://localhost:${PORT}/api/user\n`);
    });
  })
  .catch((e) => {
    console.error('\n[ExpertGym] Server TIDAK dijalankan — gagal terhubung/menyiapkan database.');
    console.error('[ExpertGym] Pesan error asli:', e && e.message ? e.message : e);
    if (e && e.code) console.error('[ExpertGym] Kode error MySQL:', e.code);
    console.error('\n[ExpertGym] Kemungkinan penyebab & solusi:');
    console.error('  1. MySQL/XAMPP belum dinyalakan          → nyalakan service MySQL di XAMPP/laragon.');
    console.error('  2. Database belum dibuat di phpMyAdmin    → buat database dengan nama sesuai DB_NAME di .env.');
    console.error('  3. Kredensial di file .env salah          → cek DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.');
    console.error('  4. File .env belum dibuat sama sekali     → copy .env.example menjadi .env lalu sesuaikan.\n');
    process.exit(1);
  });
