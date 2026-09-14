/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * auth.js — ExpertGym (Backend API mode)
 *
 * Menghubungkan form Login, Register, dan Logout yang SUDAH ADA di index.html
 * ke backend Express (lihat folder /backend). Tidak ada perubahan pada HTML/CSS.
 *
 * Sesi disimpan sebagai token di localStorage (key: eg_token) — hanya token,
 * BUKAN data user/password. Setiap request ke endpoint privat mengirim
 * header Authorization: Bearer <token>. Sumber kebenaran data user sepenuhnya
 * ada di server (SQLite), bukan lagi di localStorage.
 */

(function () {
  'use strict';

  const API_BASE = '/api/auth';
  const TOKEN_KEY = 'eg_token';

  /* ── UTIL ───────────────────────────────────────────── */
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

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  /** Wrapper fetch ke API auth, otomatis melampirkan token & parsing JSON. */
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

  /* ── CEK SESI AKTIF SAAT HALAMAN DIMUAT ─────────────── */
  async function checkActiveSession() {
    const token = getToken();
    if (!token) return false;

    const result = await apiFetch('/me', { method: 'GET' });
    if (result.ok && result.user) {
      // PENTING: panggil lewat window._startSessionLocal, BUKAN referensi
      // lokal `_startSessionLocal` di closure ini. favorite.js, riwayat.js,
      // dan workout-log.js masing-masing membungkus ulang
      // window._startSessionLocal supaya cache favorit/riwayat/workout log
      // ikut dimuat dari server setiap kali sesi dimulai (login BARU atau
      // sesi DIPULIHKAN saat refresh). Kalau dipanggil lewat referensi
      // lokal, pembungkusan itu terlewati saat refresh — sesi login tetap
      // valid, tapi favorit/riwayat/workout log jadi terlihat kosong/reset
      // karena tidak pernah dimuat ulang.
      const start = (typeof window._startSessionLocal === 'function')
        ? window._startSessionLocal
        : _startSessionLocal;
      start(result.user);
      return true;
    }
    // Token tidak valid / kedaluwarsa → bersihkan
    clearToken();
    return false;
  }

  /* ── OVERRIDE: doLogin ───────────────────────────────── */
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
      const result = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p }),
      });

      if (!result.ok) {
        showAuthError(err, result.message || 'Username atau password salah.');
        return;
      }

      setToken(result.token);
      if (pEl) pEl.value = '';
      _startSessionLocal(result.user);
    } catch (e) {
      console.error('[doLogin]', e);
      showAuthError(err, 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setBtnLoading(btn, false, 'Masuk');
    }
  };

  /* ── OVERRIDE: doRegister ────────────────────────────── */
  window.doRegister = async function () {
    const nameEl = document.getElementById('regName');
    const uEl    = document.getElementById('regUsername');
    const pEl    = document.getElementById('regPassword');
    const err    = document.getElementById('regError');
    const btn    = document.getElementById('btnRegister');

    const name = (nameEl?.value || '').trim();
    const u    = (uEl?.value || '').trim();
    const p    = pEl?.value || '';
    const role = 'user'; // Registrasi publik hanya untuk role Pengguna

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
      const result = await apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify({ nama: name, username: u, password: p, role }),
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

  /* ── OVERRIDE: doGuest ───────────────────────────────── */
  window.doGuest = function () {
    const start = (typeof window._startSessionLocal === 'function') ? window._startSessionLocal : _startSessionLocal;
    start({ id: 0, name: 'Tamu', nama: 'Tamu', username: 'guest', role: 'guest' });
  };

  /* ── OVERRIDE: doLogout ──────────────────────────────── */
  window.doLogout = async function () {
    const token = getToken();
    if (token) {
      try { await apiFetch('/logout', { method: 'POST' }); }
      catch (e) { console.warn('[doLogout] gagal menghubungi server, lanjut logout lokal.', e); }
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

  /* ── INTERNAL: _startSessionLocal ────────────────────── */
  function _startSessionLocal(user) {
    // Normalisasi bentuk objek user agar kompatibel dengan app.js/admin.js yang sudah ada
    const normalized = {
      id: user.id,
      nama: user.nama || user.name,
      name: user.nama || user.name,
      username: user.username,
      role: user.role,
    };

    if (typeof state !== 'undefined') {
      state.currentUser = normalized;
    }

    const auth = document.getElementById('authScreen');
    if (auth) auth.style.display = 'none';

    if (normalized.role === 'admin') {
      if (typeof showAdminScreen === 'function') showAdminScreen();
    } else {
      if (typeof showAppScreen === 'function') {
        showAppScreen();
        setTimeout(() => {
          if (typeof restoreStateAfterAuth === 'function') restoreStateAfterAuth();
        }, 150);
      }
    }
  }

  window._startSessionLocal = _startSessionLocal;
  window.startSession = _startSessionLocal;

  /* ── RIWAYAT & FAVORIT (tetap di localStorage, per perangkat) ──
   * Di luar cakupan backend Login/Register/Logout: riwayat sesi latihan dan
   * daftar favorit tetap disimpan lokal di browser seperti sebelumnya, hanya
   * dikelompokkan berdasarkan id user yang sekarang berasal dari server.
   */
  window.saveHistory = function (poolSize) {
    if (!state?.currentUser || state.currentUser.role === 'guest') return;

    const trainingDays = (state.weekPlan || []).filter(d => !d.isRest);
    const totalEx = trainingDays.reduce((a, d) => a + (d.exercises?.length || 0), 0);
    const record = {
      id: Date.now(),
      userId: state.currentUser?.id || 0,
      createdAt: Date.now(),
      time: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      score: state.score,
      matchedRule: state.matchedRule,
      levelBase: state.f17,
      level: state.f18,
      safetyFlag: state.f19,
      f19Warnings: [...(state.f19Warnings || [])],
      f20: state.f5 ? { a: 'Circuit Style', b: 'Compound-First', c: 'Compound-Only' }[state.f5] : '',
      goal: state.f5 ? { a: 'Fat Loss', b: 'Hypertrophy', c: 'Strength' }[state.f5] : '',
      split: (typeof SPLIT_SCHEMA !== 'undefined' ? SPLIT_SCHEMA[state.f6]?.name : '') || '',
      splitKey: state.f6,
      equipments: [...(state.selectedEquipments || [])],
      days: trainingDays.length,
      totalEx,
      poolSize,
      setRepKey: state.f5,
      weekPlan: JSON.parse(JSON.stringify(state.weekPlan || [])),
      assessmentAnswers: {
        f1: state.f1, f2: state.f2, f3: state.f3, f4: state.f4,
        f5: state.f5, f6: state.f6, f6freq: state.f6freq, f7: state.f7,
        f8: state.f8, f9: state.f9, f10: state.f10, f11: state.f11,
        f12: state.f12, f13: state.f13, f14: state.f14, f15: state.f15,
      },
    };

    try {
      const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
      all.unshift(record);
      if (all.length > 100) all.splice(100);
      localStorage.setItem('eg_allHistory', JSON.stringify(all));
    } catch (_) {}
  };

  window.loadHistory = function () {
    if (!state?.currentUser || state.currentUser.role === 'guest') return [];
    const uid = state.currentUser?.id;
    try {
      const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
      return all.filter(h => String(h.userId) === String(uid));
    } catch (_) {
      return [];
    }
  };

  window.getUserHistory = function () {
    return window.loadHistory().slice(0, 20);
  };

  window.deleteHistory = async function (id) {
    const ok = await egConfirm('Hapus riwayat ini?', { title: 'Hapus Riwayat', confirmText: 'Ya, Hapus' });
    if (!ok) return;
    try {
      const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
      localStorage.setItem('eg_allHistory', JSON.stringify(all.filter(h => h.id !== id)));
    } catch (_) {}
    if (typeof openPanel === 'function') openPanel('history');
    if (typeof showToast === 'function') showToast('Riwayat dihapus.');
  };

  window.clearHistory = async function () {
    const ok = await egConfirm('Hapus SEMUA riwayat sesi Anda? Tindakan ini tidak dapat dibatalkan.', {
      title: 'Hapus Semua Riwayat', confirmText: 'Ya, Hapus Semua'
    });
    if (!ok) return;
    const uid = state?.currentUser?.id;
    try {
      const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
      localStorage.setItem('eg_allHistory', JSON.stringify(
        all.filter(h => String(h.userId) !== String(uid))
      ));
    } catch (_) {}
    if (typeof openPanel === 'function') openPanel('history');
    if (typeof showToast === 'function') showToast('Semua riwayat dihapus.');
  };

  window.getUserFavs = function () {
    if (!state?.currentUser || state.currentUser.role === 'guest') return [];
    const uid = state.currentUser?.id;
    try {
      const all = JSON.parse(localStorage.getItem('eg_allFavorites') || '{}');
      return all[uid] || [];
    } catch (_) {
      return [];
    }
  };

  window.setUserFavs = function (favs) {
    const uid = state?.currentUser?.id;
    try {
      const all = JSON.parse(localStorage.getItem('eg_allFavorites') || '{}');
      all[uid] = favs;
      localStorage.setItem('eg_allFavorites', JSON.stringify(all));
    } catch (_) {}
  };

  /* ── INIT ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    _patchAuthButtons();
    checkActiveSession();
  });

  function _patchAuthButtons() {
    document.querySelectorAll('button').forEach(btn => {
      const txt = btn.textContent.trim();
      const oc  = btn.getAttribute('onclick') || '';
      if (!btn.id) {
        if (oc.includes('doLogin') || (txt === 'Masuk' && !oc.includes('Register'))) {
          btn.id = 'btnLogin';
        } else if (oc.includes('doRegister') || txt === 'Daftar') {
          btn.id = 'btnRegister';
        }
      }
    });
  }

  /**
   * Toggle tampil/sembunyi isi input password (ikon mata).
   * inputId  : id elemen <input type="password">
   * btnEl    : elemen <button> yang diklik (berisi 2 svg: .icon-eye & .icon-eye-off)
   */
  window.togglePasswordVisibility = function (inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    if (btnEl) {
      const eye = btnEl.querySelector('.icon-eye');
      const eyeOff = btnEl.querySelector('.icon-eye-off');
      if (eye) eye.classList.toggle('hidden', !showing);
      if (eyeOff) eyeOff.classList.toggle('hidden', showing);
      const label = showing ? 'Tampilkan password' : 'Sembunyikan password';
      btnEl.setAttribute('aria-label', label);
      btnEl.setAttribute('title', label);
    }
  };

  console.log('[auth.js] ExpertGym Auth (backend API mode) dimuat.');
})();
