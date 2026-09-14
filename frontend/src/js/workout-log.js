/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * workout-log.js — ExpertGym Workout Log (backend API mode)
 *
 * File ini TIDAK mengubah wlog.js, app.js, maupun index.html.
 *
 * wlog.js menyimpan getDayStatus()/saveDayStatus() sebagai fungsi PRIVATE
 * (closure, tidak ada di window) — jadi tidak bisa di-override langsung
 * seperti fitur lain. Sebagai gantinya, file ini MEMBUNGKUS fungsi-fungsi
 * publik yang sudah ada (window.startWorkoutSession, wlogToggleEx,
 * wlogFinishDay, wlogResetProgram, wlogDeleteProgram):
 *
 *   1. Panggil fungsi asli apa adanya (termasuk dialog konfirmasi kustom
 *      egConfirm — bukan confirm() bawaan browser, jadi di-await — logika
 *      toggle, dsb — semua tetap seperti sebelumnya).
 *   2. Setelah itu, baca localStorage pada key yang SAMA PERSIS dipakai
 *      wlog.js (`eg_wlogStatus_{uid}_{rekoId}` — formatnya diketahui &
 *      stabil, jadi bisa dibaca dari luar tanpa perlu wlog.js
 *      mengeksposnya) dan kirim isinya ke backend lewat Fetch API —
 *      HANYA kalau isinya benar-benar berubah (menghindari kirim data
 *      percuma saat user membatalkan dialog konfirmasi).
 *
 * Begitu sesi user dimulai (login baru / sesi dipulihkan saat refresh),
 * seluruh progres Workout Log diambil sekaligus dari backend lewat
 * GET /api/wlog dan dipakai untuk mengisi localStorage — supaya progres
 * tetap ada meski dibuka dari perangkat/browser lain.
 */

(function () {
  'use strict';

  const API_BASE = '/api/wlog';
  const TOKEN_KEY = 'eg_token'; // sama dengan key auth.js/secure-auth.js/favorite.js/riwayat.js

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

  function uid() {
    return (typeof state !== 'undefined' && state.currentUser) ? String(state.currentUser.id) : null;
  }
  function getRekoId() {
    return (typeof state !== 'undefined') ? state._currentRekoId || null : null;
  }
  // Key ini harus identik dengan statusKey() di wlog.js.
  function statusKey(rekoId) {
    return 'eg_wlogStatus_' + uid() + '_' + rekoId;
  }

  /** Bungkus satu fungsi window: panggil asli, lalu sinkron ke backend
   *  hanya kalau isi localStorage untuk rekoId aktif benar-benar berubah. */
  function wrapAndSync(fnName) {
    const orig = window[fnName];
    if (typeof orig !== 'function') return;
    window[fnName] = async function (...args) {
      const rekoId = getRekoId();
      const key = rekoId ? statusKey(rekoId) : null;
      const before = key ? localStorage.getItem(key) : null;

      // await: fungsi asli sekarang bisa async (memakai dialog konfirmasi
      // kustom egConfirm yang menunggu interaksi user) — kalau tidak
      // di-await, localStorage akan dibaca SEBELUM user sempat menjawab
      // dialognya.
      const result = await orig.apply(this, args);

      const after = key ? localStorage.getItem(key) : null;
      if (rekoId && after && after !== before) {
        apiFetch('/' + encodeURIComponent(rekoId), { method: 'PUT', body: after }).catch(() => {});
      }
      return result;
    };
  }

  ['startWorkoutSession', 'wlogToggleEx', 'wlogFinishDay', 'wlogResetProgram'].forEach(wrapAndSync);

  /* ── SINKRON "SELESAI PAKSA" KE BACKEND ───────────────────
   * Dipanggil oleh window.markRecommendationFinished (wlog.js) setiap
   * kali sebuah riwayat_rekomendasi ditandai forceFinished — dipakai
   * bersama oleh "Hapus Program" DAN "Ulangi Asesmen/Rekomendasi"
   * (restartApp di app.js). Memakai endpoint upsert POST /api/riwayat
   * yang sudah ada (dipakai riwayat.js untuk menyimpan riwayat baru)
   * supaya barisnya di database TIDAK dihapus, hanya field forceFinished
   * di snapshot-nya yang diperbarui — riwayat tetap tersimpan tapi
   * statusnya konsisten "Sudah Selesai" di semua sesi/perangkat. ─── */
  window._egSyncRiwayatForceFinished = function (rec) {
    if (!rec) return;
    try {
      fetch('/api/riwayat', {
        method: 'POST',
        headers: (function () {
          const h = { 'Content-Type': 'application/json' };
          const t = getToken();
          if (t) h['Authorization'] = 'Bearer ' + t;
          return h;
        })(),
        body: JSON.stringify(rec),
      }).catch(() => {});
    } catch (_) {}
  };

  /* ── OVERRIDE: wlogDeleteProgram — dibungkus terpisah karena aksinya
   *    MENGHAPUS key localStorage, bukan mengubah isinya.
   *
   *    "Hapus Program" menghapus progres/workout_log program ini di
   *    backend & localStorage, TAPI TIDAK menghapus record
   *    riwayat_rekomendasi-nya — riwayat tetap tersimpan (penandaan
   *    forceFinished & sinkronisasinya sudah ditangani oleh
   *    window.markRecommendationFinished di wlog.js lewat helper di
   *    atas). Di sini kita hanya perlu menghapus workout_log-nya. ─── */
  const _origDeleteProgram = window.wlogDeleteProgram;
  if (typeof _origDeleteProgram === 'function') {
    window.wlogDeleteProgram = async function (...args) {
      const rekoId = getRekoId();
      const key = rekoId ? statusKey(rekoId) : null;
      const before = key ? localStorage.getItem(key) : null;

      // await: wlogDeleteProgram sekarang async (menunggu dialog
      // konfirmasi kustom egConfirm sampai user menjawab).
      const result = await _origDeleteProgram.apply(this, args);

      const after = key ? localStorage.getItem(key) : null;
      if (rekoId && before && !after) {
        // Hapus progres workout_log milik program ini di backend.
        apiFetch('/' + encodeURIComponent(rekoId), { method: 'DELETE' }).catch(() => {});
      }
      return result;
    };
  }

  /** Ambil seluruh progres Workout Log milik user dari backend, isi ke
   *  localStorage (satu key per riwayat) supaya wlog.js membacanya seperti biasa. */
  async function loadAllFromServer() {
    const id = uid();
    if (!id) return;

    const result = await apiFetch('', { method: 'GET' });
    if (!result.ok || !result.wlog || typeof result.wlog !== 'object') return;

    Object.entries(result.wlog).forEach(([rekoId, dayStatus]) => {
      try {
        localStorage.setItem('eg_wlogStatus_' + id + '_' + rekoId, JSON.stringify(dayStatus));
      } catch (_) {}
    });
  }

  /* ── Muat progres otomatis begitu sesi user dimulai (login baru ATAU
   *    sesi dipulihkan saat refresh halaman). ─── */
  const _origStartSession = window._startSessionLocal;
  window._startSessionLocal = function (user) {
    if (typeof _origStartSession === 'function') _origStartSession(user);
    if (user && user.role === 'user') {
      loadAllFromServer().catch(() => {});
    }
  };
  window.startSession = window._startSessionLocal;

  console.log('[workout-log.js] ExpertGym Workout Log (backend API mode) dimuat.');
})();
