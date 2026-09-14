/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * favorite.js — ExpertGym Favorit (backend API mode)
 *
 * File ini TIDAK mengubah app.js, auth.js, exercise.js, maupun index.html.
 * Mengikuti pola override yang sudah dipakai proyek ini: script ini dimuat
 * SETELAH app.js & auth.js, sehingga meng-override dua fungsi global yang
 * sudah ada — `getUserFavs()` dan `setUserFavs()` — yang dipakai oleh
 * SELURUH kode favorit yang sudah ada di app.js (tombol ikon hati di kartu
 * latihan, tombol hati di modal detail, panel "Favorit Saya", counter
 * favorit) TANPA perlu mengubah satu baris pun kode itu:
 *
 *   handleFavClick → toggleFav → getUserFavs()/setUserFavs()   (tombol hati di kartu)
 *   handleModalFavClick → toggleFavFromModal → getUserFavs()/setUserFavs()  (tombol hati di modal)
 *   removeFavFromPanel → setUserFavs()                          (panel Favorit Saya)
 *   updateFavCount → getUserFavs()                              (badge jumlah favorit)
 *
 * Karena semua jalur di atas SUDAH memanggil getUserFavs()/setUserFavs(),
 * meng-override dua fungsi ini saja sudah cukup untuk menghubungkan tombol
 * ikon hati ke backend lewat Fetch API — tidak perlu menyentuh app.js sama
 * sekali.
 *
 * Endpoint backend yang dipakai:
 *   GET    /api/favorites            → Menampilkan seluruh favorit milik user
 *   POST   /api/favorites            → { Title } → Menambahkan ke favorit
 *   DELETE /api/favorites/:title     → Menghapus dari favorit
 *   GET    /api/favorites/check      → Mengecek status favorit satu latihan
 *
 * Strategi sinkronisasi:
 *   getUserFavs() bersifat SINKRON (dipanggil di banyak tempat tanpa await
 *   di app.js), jadi favorit disimpan di cache memori (_favCache) yang
 *   dimuat dari server sekali setiap kali sesi user dimulai (login atau
 *   sesi dipulihkan saat refresh halaman). setUserFavs() membandingkan
 *   cache lama vs array baru untuk tahu latihan mana yang ditambah/dihapus,
 *   lalu mengirim request Fetch API yang sesuai ke backend.
 */

(function () {
  'use strict';

  const API_BASE = '/api/favorites';
  const TOKEN_KEY = 'eg_token'; // sama dengan key yang dipakai auth.js/secure-auth.js

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  async function apiFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res, data;
    try {
      res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
      data = await res.json().catch(() => ({}));
    } catch (e) {
      return { ok: false, status: 0, message: 'Tidak dapat menghubungi server. Periksa koneksi Anda.' };
    }
    return Object.assign({ status: res.status }, data);
  }

  /** Cache lokal (sinkron) berisi objek latihan lengkap milik user yang sedang login. */
  let _favCache = [];

  /** Cari objek latihan lengkap (Title/Desc/Type/BodyPart/Equipment/Level)
   *  berdasarkan judul, dari gabungan dataset bawaan + data_latihan admin. */
  function findExerciseByTitle(title) {
    const all = (typeof window.getAllExercises === 'function') ? window.getAllExercises() : [];
    return all.find((e) => e.Title === title) || null;
  }

  /** Ambil daftar favorit dari server lalu resolve ke objek latihan lengkap. */
  async function loadFavoritesFromServer() {
    const result = await apiFetch('', { method: 'GET' });
    if (!result.ok || !Array.isArray(result.favorites)) {
      _favCache = [];
      return;
    }
    const resolved = [];
    for (const f of result.favorites) {
      const ex = findExerciseByTitle(f.title);
      // Kalau latihan sudah dihapus admin dari data_latihan, favoritnya
      // tetap tersimpan di server tapi diabaikan dari tampilan (tidak ada
      // data latihan untuk ditampilkan lagi).
      if (ex) resolved.push(ex);
    }
    _favCache = resolved;
  }

  /* ── OVERRIDE: getUserFavs — sinkron, baca dari cache ─── */
  window.getUserFavs = function () {
    if (!state?.currentUser || state.currentUser.role !== 'user') return [];
    return _favCache;
  };

  /* ── OVERRIDE: setUserFavs — sinkronkan selisih ke backend lewat Fetch API ─── */
  window.setUserFavs = function (newFavs) {
    if (!state?.currentUser || state.currentUser.role !== 'user') return;

    const oldTitles = new Set(_favCache.map((f) => f.Title));
    const newTitles = new Set((newFavs || []).map((f) => f.Title));

    // Latihan yang hilang dari array baru → hapus dari favorit di server.
    for (const title of oldTitles) {
      if (!newTitles.has(title)) {
        apiFetch('/' + encodeURIComponent(title), { method: 'DELETE' }).catch(() => {});
      }
    }
    // Latihan baru yang belum ada di cache lama → tambahkan ke favorit di server.
    for (const title of newTitles) {
      if (!oldTitles.has(title)) {
        apiFetch('', { method: 'POST', body: JSON.stringify({ Title: title }) }).catch(() => {});
      }
    }

    // Update cache secara optimistis supaya UI (badge, tombol) langsung sinkron.
    _favCache = (newFavs || []).slice();
  };

  /* ── Mengecek apakah satu latihan sudah menjadi favorit (langsung ke
   *    server, dipakai kalau butuh status yang benar-benar terbaru,
   *    di luar cache). Diekspos untuk pemakaian lain jika diperlukan. ─── */
  window.checkIsFavorite = async function (title) {
    if (!state?.currentUser || state.currentUser.role !== 'user') return false;
    const result = await apiFetch('/check?title=' + encodeURIComponent(title), { method: 'GET' });
    return !!(result.ok && result.isFavorite);
  };

  /* ── Muat favorit otomatis begitu sesi user dimulai (login baru ATAU
   *    sesi dipulihkan saat refresh halaman) — hook ke _startSessionLocal
   *    yang sudah dipakai oleh auth.js & secure-auth.js. ─── */
  const _origStartSession = window._startSessionLocal;
  window._startSessionLocal = function (user) {
    if (typeof _origStartSession === 'function') _origStartSession(user);

    _favCache = [];
    if (user && user.role === 'user') {
      loadFavoritesFromServer().then(() => {
        if (typeof window.updateFavCount === 'function') window.updateFavCount();
      });
    }
  };
  window.startSession = window._startSessionLocal;

  /* ── Kosongkan cache favorit saat logout ─── */
  const _origDoLogout = window.doLogout;
  window.doLogout = async function () {
    _favCache = [];
    if (typeof _origDoLogout === 'function') return _origDoLogout();
  };

  console.log('[favorite.js] ExpertGym Favorit (backend API mode) dimuat.');
})();
