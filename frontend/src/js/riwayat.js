/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * riwayat.js — ExpertGym Riwayat Rekomendasi (backend API mode)
 *
 * File ini TIDAK mengubah app.js, auth.js, maupun index.html.
 *
 * Berbeda dari favorite.js, di sini strateginya adalah MEMBUNGKUS
 * (wrap) fungsi yang sudah ada — bukan menggantinya total — karena ada
 * satu baris kode di app.js (di dalam alur "asesmen selesai") yang
 * membaca localStorage `eg_allHistory` SECARA LANGSUNG (bukan lewat
 * loadHistory()/getUserHistory()) untuk menentukan id riwayat yang baru
 * saja dibuat, dipakai fitur Workout Log. Supaya baris itu tetap berfungsi
 * tanpa diubah, cache lokal `eg_allHistory` di localStorage TETAP dipakai
 * persis seperti sebelumnya sebagai "cermin" sinkron — backend hanyalah
 * sumber kebenaran tambahan yang disinkronkan ke/dari cermin ini:
 *
 *   window.saveHistory(poolSize)
 *     → panggil versi asli (auth.js) apa adanya — tetap menulis ke
 *       localStorage seperti biasa — lalu kirim record yang baru saja
 *       dibuat ke backend lewat Fetch API (POST /api/riwayat).
 *
 *   window.deleteHistory(id) / window.clearHistory()
 *     → panggil versi asli apa adanya (termasuk dialog konfirmasi kustom
 *       egConfirm — bukan confirm() bawaan browser — sehingga di-await).
 *       Kalau localStorage terbukti berkurang (artinya user benar-benar
 *       mengonfirmasi), baru kirim DELETE ke backend untuk baris yang sama.
 *
 *   loadHistory() / getUserHistory()
 *     → TIDAK di-override sama sekali — tetap baca dari localStorage
 *       seperti sebelumnya (sudah otomatis sinkron lewat mekanisme di atas
 *       + pemuatan awal saat sesi login dimulai, lihat di bawah).
 *
 * Begitu sesi user dimulai (login baru ATAU sesi dipulihkan saat refresh
 * halaman), seluruh riwayat milik user diambil dari backend lewat
 * GET /api/riwayat dan dipakai untuk MENIMPA cache lokal miliknya —
 * backend adalah sumber kebenaran, localStorage hanya cermin cepat untuk
 * pembacaan sinkron.
 */

(function () {
  'use strict';

  const API_BASE = '/api/riwayat';
  const TOKEN_KEY = 'eg_token'; // sama dengan key yang dipakai auth.js/secure-auth.js/favorite.js
  const CACHE_KEY = 'eg_allHistory'; // key localStorage yang sudah dipakai app.js/auth.js

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

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }
  function writeCache(arr) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(arr));
    } catch (_) {}
  }

  /** Ambil seluruh riwayat user dari backend, timpa cache lokal miliknya. */
  async function loadHistoryFromServer() {
    const uid = state?.currentUser?.id;
    if (uid === undefined || uid === null) return;

    const result = await apiFetch('', { method: 'GET' });
    if (!result.ok || !Array.isArray(result.history)) return;

    const others = readCache().filter((h) => String(h.userId) !== String(uid));
    writeCache([...result.history, ...others]);
  }

  /* ── OVERRIDE: saveHistory — simpan lokal (perilaku asli tidak diubah)
   *    lalu kirim record yang baru dibuat ke backend lewat Fetch API. ─── */
  const _origSaveHistory = window.saveHistory;
  window.saveHistory = function (poolSize) {
    if (typeof _origSaveHistory === 'function') _origSaveHistory(poolSize);

    try {
      const uid = state?.currentUser?.id;
      const mine = readCache().find((h) => String(h.userId) === String(uid));
      if (mine) {
        apiFetch('', { method: 'POST', body: JSON.stringify(mine) }).catch(() => {});
      }
    } catch (e) {
      console.warn('[riwayat.js] gagal mengirim riwayat baru ke server.', e);
    }
  };

  /* ── OVERRIDE: deleteHistory — panggil versi asli (termasuk dialog
   *    konfirmasi bawaan), lalu kirim DELETE ke backend HANYA kalau
   *    localStorage terbukti berkurang (artinya user benar-benar
   *    mengonfirmasi penghapusan). ─── */
  const _origDeleteHistory = window.deleteHistory;
  window.deleteHistory = async function (id) {
    const before = readCache().length;
    // await: deleteHistory sekarang async (menunggu dialog konfirmasi
    // kustom egConfirm sampai user menjawab) — tanpa await, localStorage
    // akan dibaca sebelum user sempat mengonfirmasi.
    if (typeof _origDeleteHistory === 'function') await _origDeleteHistory(id);
    const after = readCache().length;

    if (after < before) {
      apiFetch('/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
    }
  };

  /* ── OVERRIDE: clearHistory — sama seperti di atas, tapi untuk hapus
   *    semua riwayat milik user yang sedang login. ─── */
  const _origClearHistory = window.clearHistory;
  window.clearHistory = async function () {
    const uid = state?.currentUser?.id;
    const beforeIds = readCache()
      .filter((h) => String(h.userId) === String(uid))
      .map((h) => h.id);

    // await: clearHistory sekarang async (menunggu dialog konfirmasi
    // kustom egConfirm sampai user menjawab).
    if (typeof _origClearHistory === 'function') await _origClearHistory();

    const afterCount = readCache().filter((h) => String(h.userId) === String(uid)).length;
    if (afterCount === 0 && beforeIds.length) {
      beforeIds.forEach((id) => {
        apiFetch('/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
      });
    }
  };

  /* ── Muat riwayat otomatis begitu sesi user dimulai (login baru ATAU
   *    sesi dipulihkan saat refresh halaman). ─── */
  const _origStartSession = window._startSessionLocal;
  window._startSessionLocal = function (user) {
    if (typeof _origStartSession === 'function') _origStartSession(user);
    if (user && user.role === 'user') {
      loadHistoryFromServer().catch(() => {});
    }
  };
  window.startSession = window._startSessionLocal;

  console.log('[riwayat.js] ExpertGym Riwayat Rekomendasi (backend API mode) dimuat.');
})();
