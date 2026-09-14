/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * secure-auth.js — ExpertGym (Login Admin & Login/Registrasi User — backend
 * MySQL dengan tabel terpisah sesuai ERD: `admin` dan `user`)
 *
 * File ini TIDAK mengubah js/auth.js, admin.js, app.js, maupun index.html.
 * Mengikuti pola override yang sudah dipakai proyek ini (seperti
 * trainer.js/exercise.js meng-override admin.js): script ini dimuat SETELAH
 * js/auth.js sehingga fungsi global doLogin / doRegister / doLogout otomatis
 * memakai versi baru di bawah ini (menimpa versi lama), sedangkan
 * elemen HTML, id, dan onclick="" yang sudah ada tetap dipakai apa adanya.
 *
 * Endpoint backend yang dipanggil:
 *   POST /api/admin/login    → { username, password }
 *   POST /api/admin/logout
 *   GET  /api/admin/status
 *   POST /api/user/register  → { nama, username, password }
 *   POST /api/user/login     → { username, password }
 *   POST /api/user/logout
 *   GET  /api/user/status
 *
 * Token sesi tetap disimpan di localStorage dengan key `eg_token` — sama
 * seperti sebelumnya — supaya js/trainer.js dan js/exercise.js (fitur admin
 * lain yang memakai key yang sama untuk header Authorization) tetap
 * berfungsi tanpa perlu disentuh.
 *
 * Pemulihan sesi otomatis saat halaman di-refresh tetap berjalan lewat
 * checkActiveSession() bawaan js/auth.js (memanggil GET /api/auth/me),
 * yang sudah dijembatani oleh backend ke sistem sesi admin/user yang baru
 * — lihat backend/routes/auth.js.
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'eg_token'; // sama dengan key yang dipakai auth.js/trainer.js/exercise.js

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function showAuthError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 4000);
  }

  function setBtnLoading(btn, loading, originalText) {
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Memproses…' : originalText;
  }

  /** Wrapper fetch generik, otomatis parsing JSON & melampirkan token bila ada. */
  async function apiFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res, data;
    try {
      res = await fetch(path, Object.assign({}, options, { headers }));
      data = await res.json().catch(() => ({}));
    } catch (e) {
      return { ok: false, status: 0, message: 'Tidak dapat menghubungi server. Periksa koneksi Anda.' };
    }
    return Object.assign({ status: res.status }, data);
  }

  /* ── OVERRIDE: doLogin ───────────────────────────────────
   * Satu form login dipakai untuk Admin maupun User (sesuai UI yang sudah
   * ada). Karena kredensial admin & user disimpan di dua tabel terpisah,
   * backend dicoba sebagai ADMIN terlebih dahulu; kalau gagal, dicoba
   * sebagai USER. Login berhasil pada salah satunya sudah cukup.
   * ────────────────────────────────────────────────────── */
  window.doLogin = async function () {
    const uEl = document.getElementById('loginUsername');
    const pEl = document.getElementById('loginPassword');
    const err = document.getElementById('loginError');
    const btn = document.getElementById('btnLogin');

    const u = (uEl?.value || '').trim();
    const p = pEl?.value || '';

    if (!u || !p) {
      showAuthError(err, 'Harap isi username dan password.');
      return;
    }

    setBtnLoading(btn, true, 'Masuk');
    err?.classList.remove('show');

    try {
      const body = JSON.stringify({ username: u, password: p });

      let result = await apiFetch('/api/admin/login', { method: 'POST', body });
      if (!result.ok) {
        result = await apiFetch('/api/user/login', { method: 'POST', body });
      }

      if (!result.ok) {
        showAuthError(err, result.message || 'Username atau password salah.');
        return;
      }

      setToken(result.token);
      if (pEl) pEl.value = '';

      if (typeof window._startSessionLocal === 'function') {
        window._startSessionLocal(result.user);
      }
    } catch (e) {
      console.error('[doLogin]', e);
      showAuthError(err, 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setBtnLoading(btn, false, 'Masuk');
    }
  };

  /* ── OVERRIDE: doRegister — hanya untuk User ───────────── */
  window.doRegister = async function () {
    const nameEl = document.getElementById('regName');
    const uEl = document.getElementById('regUsername');
    const pEl = document.getElementById('regPassword');
    const err = document.getElementById('regError');
    const btn = document.getElementById('btnRegister');

    const name = (nameEl?.value || '').trim();
    const u = (uEl?.value || '').trim();
    const p = pEl?.value || '';

    if (!name || !u || !p) {
      showAuthError(err, 'Harap lengkapi semua kolom.');
      return;
    }
    if (u.length < 3) {
      showAuthError(err, 'Username minimal 3 karakter.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      showAuthError(err, 'Username hanya boleh huruf, angka, dan underscore.');
      return;
    }
    if (p.length < 6) {
      showAuthError(err, 'Password minimal 6 karakter.');
      return;
    }

    setBtnLoading(btn, true, 'Daftar');
    err?.classList.remove('show');

    try {
      const result = await apiFetch('/api/user/register', {
        method: 'POST',
        body: JSON.stringify({ nama: name, username: u, password: p }),
      });

      if (!result.ok) {
        showAuthError(err, result.message || 'Registrasi gagal. Coba lagi.');
        return;
      }

      if (pEl) pEl.value = '';
      if (nameEl) nameEl.value = '';
      if (uEl) uEl.value = '';

      if (typeof showToast === 'function') showToast('✅ Registrasi berhasil! Silakan login.');
      if (typeof switchAuthTab === 'function') switchAuthTab('login');

      const loginU = document.getElementById('loginUsername');
      if (loginU) loginU.value = u;
    } catch (e) {
      console.error('[doRegister]', e);
      showAuthError(err, 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setBtnLoading(btn, false, 'Daftar');
    }
  };

  /* ── OVERRIDE: doLogout ──────────────────────────────────
   * Tidak tahu di sisi klien apakah sesi aktif adalah admin atau user, jadi
   * dicoba logout sebagai admin dulu; kalau tidak berlaku (403/401), dicoba
   * sebagai user. Salah satu pasti cocok dengan tipe token yang aktif.
   * ────────────────────────────────────────────────────── */
  window.doLogout = async function () {
    const token = getToken();
    if (token) {
      try {
        const r = await apiFetch('/api/admin/logout', { method: 'POST' });
        if (!r.ok) await apiFetch('/api/user/logout', { method: 'POST' });
      } catch (e) {
        console.warn('[doLogout] gagal menghubungi server, lanjut logout lokal.', e);
      }
    }
    clearToken();

    if (typeof resetAllState === 'function') resetAllState();

    document.getElementById('appScreen')?.classList.remove('active');
    document.getElementById('adminScreen')?.classList.remove('active');
    const auth = document.getElementById('authScreen');
    if (auth) auth.style.display = 'flex';

    const lu = document.getElementById('loginUsername');
    const lp = document.getElementById('loginPassword');
    if (lu) lu.value = '';
    if (lp) lp.value = '';

    if (typeof switchAuthTab === 'function') switchAuthTab('login');
  };

  console.log('[secure-auth.js] ExpertGym Login Admin & Login/Registrasi User (tabel terpisah) dimuat.');
})();
