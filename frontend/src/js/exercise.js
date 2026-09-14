/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * exercise.js — ExpertGym (Backend API mode) — Fitur Kelola Data Latihan
 *
 * Menghubungkan panel admin "Kelola Data Latihan" (form Tambah/Edit + tabel)
 * dan kartu latihan di halaman rekomendasi ke backend Express (lihat
 * /backend/routes/exercises.js), TANPA mengubah HTML/CSS.
 *
 * PENTING — urutan pemuatan script:
 *   app.js   → definisi asli (getAllExercises, renderExCard, dst)
 *   admin.js → meng-override ke versi localStorage ("customExercises")
 *   exercise.js (file ini) → override LAGI ke versi backend API
 * File ini HARUS dimuat setelah admin.js di index.html supaya versi
 * backend yang benar-benar aktif dipakai (lihat komentar di admin.js).
 *
 * Data latihan "custom" (yang dikelola admin) sepenuhnya berasal dari server
 * (MySQL) — bukan lagi localStorage eg_customExercises. Dataset bawaan
 * (js/dataset.js, ribuan entri dari Kaggle) TETAP dipakai apa adanya dan
 * digabung di sisi client, persis seperti perilaku getAllExercises() asli —
 * hanya sumber bagian "custom"-nya yang berubah dari localStorage ke API.
 *
 * Sebuah cache in-memory (_exercisesCache) dipakai supaya fungsi yang
 * dipanggil secara sinkron (renderExCard, getAllExercises, dst di app.js)
 * tetap bisa membaca data terbaru tanpa perlu diubah jadi async.
 */

(function () {
  'use strict';

  const API_BASE = '/api/exercises';
  const TOKEN_KEY = 'eg_token'; // sama dengan key yang dipakai auth.js

  let _exercisesCache = []; // data latihan kelolaan admin (dari backend)

  /* ── UTIL ───────────────────────────────────────────── */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  /** Wrapper fetch ke API exercises, otomatis melampirkan token & parsing JSON. */
  async function apiFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
    } catch (e) {
      return { ok: false, status: 0, message: 'Tidak dapat menghubungi server. Periksa koneksi Anda.' };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = { ok: false, message: `Server mengembalikan respons tidak valid (status ${res.status}).` };
    }
    return Object.assign({ status: res.status }, data);
  }

  /**
   * fetchExercisesData — MENAMPILKAN SELURUH DATA LATIHAN: ambil daftar
   * latihan kelolaan admin terbaru dari server, simpan ke cache lokal, lalu
   * render ulang tabel admin (jika sedang ditampilkan) supaya UI langsung
   * ter-update. Dipanggil saat halaman dimuat dan setiap kali ada perubahan
   * data (tambah/edit/hapus).
   */
  async function fetchExercisesData() {
    const result = await apiFetch('', { method: 'GET' });
    if (result.ok && Array.isArray(result.exercises)) {
      _exercisesCache = result.exercises;
    }
    if (typeof renderAdminExTable === 'function' && document.getElementById('adminExBody')) {
      renderAdminExTable();
    }
    if (typeof renderAdminHome === 'function') renderAdminHome();
    return _exercisesCache;
  }
  window.fetchExercisesData = fetchExercisesData;

  /**
   * getAllExercises — gabungkan dataset bawaan hasil pra-pemrosesan dengan
   * data latihan dari backend tanpa duplikasi judul.
   *
   * Jika judul yang sama ada di kedua sumber, atribut inti latihan
   * (Title, Desc, Type, BodyPart, Equipment, Level) mengikuti dataset.js
   * terbaru. Metadata backend seperti id, CreatedAt, AdminUsername, dan
   * VideoUrl tetap dipertahankan. Dengan demikian, deskripsi hasil
   * pra-pemrosesan/terjemahan di dataset.js benar-benar tampil di aplikasi.
   */
  window.getAllExercises = function () {
    const base = (typeof exercisesData !== 'undefined' && Array.isArray(exercisesData))
      ? exercisesData
      : [];

    const normalizeTitle = value => String(value || '').trim().toLowerCase();
    const backendByTitle = new Map(
      _exercisesCache.map(ex => [normalizeTitle(ex.Title), ex])
    );

    // Dataset bawaan menjadi sumber utama untuk enam atribut hasil
    // pra-pemrosesan. Bila judul juga ada di backend, metadata backend tetap
    // dibawa agar fungsi edit/hapus dan atribut tambahan tetap bekerja.
    const merged = base.map(ex => {
      const backend = backendByTitle.get(normalizeTitle(ex.Title));
      if (!backend) return { ...ex };

      backendByTitle.delete(normalizeTitle(ex.Title));
      return {
        ...backend,
        ...ex,
      };
    });

    // Data yang hanya ada di backend (latihan tambahan admin) tetap ikut.
    for (const ex of backendByTitle.values()) {
      merged.push({ ...ex });
    }

    return merged;
  };

  /** Validasi format URL: hanya menerima URL http/https yang valid (bukan teks bebas). */
  function isValidUrl(str) {
    try {
      const u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  /* ══════════════════════════════════════════════════════════
   * ADMIN — KELOLA DATA LATIHAN
   * ══════════════════════════════════════════════════════════ */

  window.adminExPage = window.adminExPage || 1;
  window.adminExPerPage = window.adminExPerPage || 10;

  /**
   * renderAdminExTable — OVERRIDE: DAFTAR + PENCARIAN & FILTER data latihan
   * di panel admin. Pencarian/filter (nama, level, alat) tetap dilakukan di
   * client seperti versi asli, tapi kini beroperasi atas gabungan dataset
   * bawaan + data dari backend. "isCustom" (boleh dihapus) kini ditentukan
   * dari cache backend, bukan localStorage.
   */
  window.renderAdminExTable = function () {
    const s = (document.getElementById('adminExSearch')?.value || '').toLowerCase();
    const fl = document.getElementById('adminExFilter')?.value || '';
    const fe = document.getElementById('adminEqFilter')?.value || '';
    const sortOrder = document.getElementById('adminExSort')?.value || 'newest';

    let data = getAllExercises();
    if (s) data = data.filter(e => e.Title?.toLowerCase().includes(s) || e.BodyPart?.toLowerCase().includes(s));
    if (fl) data = data.filter(e => e.Level === fl);
    if (fe) data = data.filter(e => e.Equipment === fe);

    // Urutkan berdasarkan tanggal ditambahkan (CreatedAt). Data dataset bawaan
    // (tanpa CreatedAt) dianggap paling lama sehingga selalu berada di ujung
    // urutan "Terbaru → Terlama" dan di awal urutan "Terlama → Terbaru".
    // Jika CreatedAt dua baris sama persis (mis. beberapa latihan ditambahkan
    // pada detik yang sama — kolom DATETIME hanya presisi ke detik), pakai
    // "id" (auto-increment, sudah tersedia dari backend) sebagai penentu
    // urutan kedua, karena id yang lebih besar selalu berarti ditambahkan
    // lebih belakangan.
    data = data.slice().sort((a, b) => {
      const ta = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
      const tb = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
      if (ta !== tb) return sortOrder === 'oldest' ? ta - tb : tb - ta;
      const ia = a.id || 0;
      const ib = b.id || 0;
      return sortOrder === 'oldest' ? ia - ib : ib - ia;
    });

    const badge = document.getElementById('exCountBadge');
    if (badge) badge.textContent = data.length;

    const perPg = window.adminExPerPage || 10;
    const pages = Math.ceil(data.length / perPg) || 1;
    if (window.adminExPage > pages) window.adminExPage = 1;

    const slice = data.slice((window.adminExPage - 1) * perPg, window.adminExPage * perPg);

    // Data dari backend = data "custom" yang boleh diedit/dihapus.
    const customTitles = new Set(_exercisesCache.map(e => e.Title));

    const tbody = document.getElementById('adminExBody');
    if (tbody) {
      tbody.innerHTML = slice.length
        ? slice.map((ex, i) => {
            const isCustom = customTitles.has(ex.Title);
            return `<tr>
              <td data-label="No" style="color:var(--text-muted)">${(window.adminExPage - 1) * perPg + i + 1}</td>
              <td data-label="Nama Latihan" style="font-weight:500;max-width:180px">${escAttr(ex.Title)}</td>
              <td data-label="Level"><span class="admin-pill ${(ex.Level || '').toLowerCase()}">${escAttr(ex.Level || '-')}</span></td>
              <td data-label="Alat">${escAttr(ex.Equipment || '-')}</td>
              <td data-label="Body Part">${escAttr(ex.BodyPart || '-')}</td>
              <td data-label="Tipe">${escAttr(ex.Type || '-')}</td>
              <td data-label="Admin" style="color:var(--text-muted)">${escAttr(ex.AdminUsername || '-')}</td>
              <td data-label="Aksi" style="text-align:center">
                <div style="display:flex;gap:5px;justify-content:center">
                  <button class="admin-action-btn edit" onclick='adminStartEdit(${JSON.stringify(ex).replace(/'/g, "&#39;")})'>Edit</button>
                  ${isCustom
                    ? `<button class="admin-action-btn del" onclick="adminDeleteExercise('${escAttr(ex.Title)}')">Hapus</button>`
                    : `<button class="admin-action-btn del" disabled style="opacity:.35;cursor:not-allowed">Hapus</button>`}
                </div>
              </td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:28px">Tidak ada data latihan</td></tr>`;
    }

    const pager = document.getElementById('adminExPager');
    if (pager) {
      pager.innerHTML = `
        Hal.${window.adminExPage}/${pages} · <strong style="color:var(--accent)">${data.length}</strong> latihan
        ${window.adminExPage > 1
          ? `<button onclick="window.adminExPage--;renderAdminExTable()" style="background:transparent;border:1px solid var(--border2);color:var(--text-muted);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:.74rem;margin-left:8px">&lt;</button>` : ''}
        ${window.adminExPage < pages
          ? `<button onclick="window.adminExPage++;renderAdminExTable()" style="margin-left:4px;background:transparent;border:1px solid var(--border2);color:var(--text-muted);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:.74rem">></button>` : ''}
      `;
    }
  };

  /**
   * adminSaveExercise — OVERRIDE: TAMBAH LATIHAN / EDIT LATIHAN.
   * Mode Tambah → POST /api/exercises. Mode Edit → PUT /api/exercises/:id
   * (id dicari dari judul lama yang tersimpan di field tersembunyi
   * "editingTitle" — mendukung penggantian nama latihan sekalipun).
   * Field yang belum ada input-nya di form saat ini (Sets/Reps/Rest/
   * VideoUrl/Order) otomatis memakai nilai default di backend.
   */
  window.adminSaveExercise = async function () {
    const title = (document.getElementById('addTitle')?.value || '').trim();
    if (!title) { showToast('⚠️ Nama latihan wajib diisi.'); return; }

    const bodyPartInput = (document.getElementById('addBodyPart')?.value || '').trim();
    if (!bodyPartInput) { showToast('⚠️ Body Part wajib dipilih.'); return; }

    const typeInput = (document.getElementById('addType')?.value || '').trim();
    if (!typeInput) { showToast('⚠️ Tipe wajib dipilih.'); return; }

    const videoUrlInput = (document.getElementById('addVideoUrl')?.value || '').trim();
    if (videoUrlInput && !isValidUrl(videoUrlInput)) {
      showToast('⚠️ URL Tutorial/Video tidak valid. Masukkan URL yang benar (contoh: https://youtube.com/...).');
      document.getElementById('addVideoUrl')?.focus();
      return;
    }

    const editingTitle = document.getElementById('editingTitle')?.value || '';

    const payload = {
      Title: title,
      Equipment: document.getElementById('addEquipment')?.value || 'Body Only',
      Level: document.getElementById('addLevel')?.value || 'Beginner',
      BodyPart: bodyPartInput,
      Type: typeInput,
      Desc: (document.getElementById('addDesc')?.value || '').trim(),
      VideoUrl: videoUrlInput || null,
    };

    const saveBtn = document.getElementById('btnAdminSave');
    if (saveBtn) saveBtn.disabled = true;

    try {
      if (editingTitle) {
        const existing = _exercisesCache.find(e => e.Title === editingTitle);
        if (!existing) {
          // Latihan yang diedit bukan data kelolaan admin (mis. dari dataset
          // bawaan) — tidak bisa diedit lewat backend, sesuai perilaku lama
          // di mana hanya data custom yang bisa diubah/dihapus.
          showToast('⚠️ Hanya data latihan kelolaan admin yang dapat diedit.');
          return;
        }
        const result = await apiFetch('/' + encodeURIComponent(existing.id), {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (!result.ok) { showToast(result.message || 'Gagal memperbarui data latihan.'); return; }
        showToast(result.message || `"${title}" diperbarui!`);
        adminCancelEdit();
      } else {
        const result = await apiFetch('', { method: 'POST', body: JSON.stringify(payload) });
        if (!result.ok) { showToast(result.message || 'Gagal menambahkan data latihan.'); return; }
        showToast(result.message || `✅ "${title}" ditambahkan!`);
        adminResetForm();
      }
      await fetchExercisesData();
    } catch (e) {
      console.error('[adminSaveExercise]', e);
      showToast('Terjadi kesalahan pada server. Coba lagi.');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  /**
   * adminDeleteExercise — OVERRIDE: HAPUS LATIHAN via DELETE /api/exercises/:id.
   * Hanya berlaku untuk data kelolaan admin (ada di cache backend) — data
   * dataset bawaan tetap tidak bisa dihapus, sama seperti sebelumnya.
   */
  window.adminDeleteExercise = async function (title) {
    const existing = _exercisesCache.find(e => e.Title === title);
    if (!existing) { showToast('⚠️ Hanya latihan custom yang dapat dihapus.'); return; }
    const ok = await egConfirm(`Hapus latihan "${title}"? Tindakan ini tidak dapat dibatalkan.`, {
      title: 'Hapus Data Latihan', confirmText: 'Ya, Hapus'
    });
    if (!ok) return;

    try {
      const result = await apiFetch('/' + encodeURIComponent(existing.id), { method: 'DELETE' });
      if (!result.ok) { showToast(result.message || 'Gagal menghapus data latihan.'); return; }
      showToast(result.message || `"${title}" dihapus.`);
      await fetchExercisesData();
    } catch (e) {
      console.error('[adminDeleteExercise]', e);
      showToast('Terjadi kesalahan pada server. Coba lagi.');
    }
  };

  /**
   * adminStartEdit — OVERRIDE: sama seperti versi admin.js, ditambah
   * pengisian field baru "URL Tutorial/Video" (addVideoUrl).
   */
  window.adminStartEdit = function (ex) {
    const hf = document.getElementById('editingTitle');
    if (hf) hf.value = ex.Title || '';

    if (document.getElementById('addTitle'))     document.getElementById('addTitle').value     = ex.Title     || '';
    if (document.getElementById('addEquipment')) document.getElementById('addEquipment').value = ex.Equipment || 'Body Only';
    if (document.getElementById('addLevel'))     document.getElementById('addLevel').value     = ex.Level     || 'Beginner';
    if (document.getElementById('addBodyPart'))  document.getElementById('addBodyPart').value  = ex.BodyPart  || '';
    if (document.getElementById('addType'))      document.getElementById('addType').value      = ex.Type      || '';
    if (document.getElementById('addDesc'))      document.getElementById('addDesc').value      = ex.Desc      || '';
    if (document.getElementById('addVideoUrl'))  document.getElementById('addVideoUrl').value  = ex.VideoUrl  || '';

    const formTitle = document.getElementById('adminFormTitle');
    if (formTitle) formTitle.textContent = `Edit: ${ex.Title}`;

    const btnSave = document.getElementById('btnAdminSave');
    if (btnSave) { btnSave.textContent = 'Simpan'; btnSave.classList.add('editing'); }

    const btnCancel = document.getElementById('btnAdminCancel');
    if (btnCancel) btnCancel.classList.remove('hidden');

    formTitle?.scrollIntoView({ behavior: 'smooth' });
    renderAdminExTable();
  };

  /**
   * adminResetForm — OVERRIDE: sama seperti versi admin.js, ditambah
   * pengosongan field baru "URL Tutorial/Video" (addVideoUrl).
   */
  window.adminResetForm = function () {
    ['addTitle', 'addBodyPart', 'addType', 'addDesc', 'addVideoUrl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const eq = document.getElementById('addEquipment');
    if (eq) eq.value = 'Body Only';
    const lv = document.getElementById('addLevel');
    if (lv) lv.value = 'Beginner';
  };

  /* ══════════════════════════════════════════════════════════
   * KARTU LATIHAN — HALAMAN REKOMENDASI
   * (menampilkan atribut Set/Repetisi/Waktu Istirahat/URL Tutorial milik
   *  masing-masing latihan bila diisi oleh admin, tanpa mengubah markup)
   * ══════════════════════════════════════════════════════════ */

  /** Gabungkan sr (hasil kalkulasi berbasis tujuan/goal) dengan atribut milik latihan itu sendiri (jika ada). */
  function effectiveSr(ex, sr) {
    return {
      ...sr,
      sets: (ex.Sets !== undefined && ex.Sets !== null && ex.Sets !== '') ? ex.Sets : sr.sets,
      reps: ex.Reps ? ex.Reps : sr.reps,
      restLabel: ex.Rest ? ex.Rest : sr.restLabel,
    };
  }

  function tutorialUrl(ex) {
    if (ex.VideoUrl) return ex.VideoUrl;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.Title + ' tutorial gym exercise')}`;
  }

  /** renderExCard — OVERRIDE: kartu latihan di halaman rekomendasi, memakai Set/Rep/Rest/VideoUrl dari data latihan bila tersedia. */
  window.renderExCard = function (ex, i, sr, isGuest, isSubstituted) {
    if (!window._exCardMap) window._exCardMap = {};
    const isFav = getUserFavs().some(f => f.Title === ex.Title);
    const eff = effectiveSr(ex, sr);
    const ytUrl = tutorialUrl(ex);
    const cardId = `card_${ex.Title.replace(/\s+/g, '_')}_${i}`;
    window._exCardMap[cardId] = ex;
    const subBadge = isSubstituted
      ? `<span class="ex-sub-badge" title="Latihan ini menggantikan latihan yang tidak aman untuk kondisi Anda">Diganti</span>`
      : '';

    // ── LEVEL BADGE ──────────────────────────────────────────
    const LEVEL_RANK = { Beginner: 0, Intermediate: 1, Expert: 2 };
    const userLevel = state._recoUserLevel || state.f18 || 'Beginner';
    const exLevel = ex.Level || '';
    const isComplement = ex._isComplement === true
      || (exLevel !== '' && exLevel !== userLevel
          && (LEVEL_RANK[exLevel] ?? 99) < (LEVEL_RANK[userLevel] ?? 99));

    const lvCls = exLevel === 'Beginner' ? 'level-b' : exLevel === 'Intermediate' ? 'level-i' : 'level-e';
    const lvLabel = exLevel || '—';
    const lvIcon = exLevel === 'Beginner' ? '🟢' : exLevel === 'Intermediate' ? '🟡' : exLevel === 'Expert' ? '🔴' : '';
    const tooltipPrimary = `Latihan utama, level ${exLevel} sesuai tingkat Anda (${userLevel})`;
    const tooltipComplement = `Pelengkap, level ${exLevel}, mengisi slot kosong dari level ${userLevel}`;
    const levelBadge = exLevel
      ? `<span class="ex-level-badge ${lvCls}${isComplement ? ' ex-level-complement' : ''}"
           title="${isComplement ? tooltipComplement : tooltipPrimary}">
          ${lvIcon} ${lvLabel}${isComplement ? ' <span class="complement-mark">↓</span>' : ''}
        </span>${isComplement ? ' <span class="ex-complement-label">Pelengkap</span>' : ''}`
      : '';

    return `
    <div class="exercise-card animate-in${isSubstituted ? ' ex-card-substituted' : ''}" id="${cardId}" style="animation-delay:${i * .05}s">
      <div class="ex-top">
        <div>
          <div class="ex-title">${ex.Title} ${subBadge}</div>
          <div class="ex-tags">
            ${levelBadge}
            <span class="ex-tag eq">${ex.Equipment}</span>
            ${ex.BodyPart ? `<span class="ex-tag">${ex.BodyPart}</span>` : ''}
            ${ex.Type ? `<span class="ex-tag tp">${ex.Type}</span>` : ''}
          </div>
        </div>
        <div class="ex-num">#${String(i + 1).padStart(2, '0')}</div>
      </div>

      <!-- SET/REP BADGES -->
      <div class="set-rep-row">
        <div class="set-rep-badge"><span class="sr-label">Set</span><span class="sr-val">${eff.sets}</span></div>
        <div class="set-rep-badge"><span class="sr-label">Rep</span><span class="sr-val">${eff.reps}</span></div>
        <div class="rest-badge">⏱ Istirahat ${eff.restLabel}</div>
      </div>

      ${ex.Desc ? `<div style="font-size:.78rem;color:var(--text-muted);line-height:1.55;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${ex.Desc}</div>` : ''}

      <div class="card-actions">
        <button class="btn-detail" onclick='openModal(${JSON.stringify(ex).replace(/'/g, "&#39;")},${JSON.stringify(sr).replace(/'/g, "&#39;")})'>Detail</button>
        <a class="btn-yt" href="${ytUrl}" target="_blank" rel="noopener">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          Tutorial
        </a>

        <button class="btn-fav ${isFav ? 'active' : ''} ${isGuest ? 'disabled' : ''}"
          data-cardid="${cardId}"
          ${isGuest ? 'title="Login untuk menyimpan favorit"' : ''}
          onclick="handleFavClick(this)">
          ${isFav ? '\u2665' : '\u2661'}
        </button>
      </div>
    </div>`;
  };

  /** openModal — OVERRIDE: modal detail latihan, memakai Set/Rep/Rest/VideoUrl dari data latihan bila tersedia. */
  window.openModal = function (ex, sr) {
    if (!sr) sr = SET_REP[state.f5] || SET_REP.b;
    const eff = effectiveSr(ex, sr);
    const isGuest = !state.currentUser || state.currentUser.role === 'guest';
    const isFav = getUserFavs().some(f => f.Title === ex.Title);
    const ytUrl = tutorialUrl(ex);
    const lvCls = ex.Level === 'Beginner' ? 'level-b' : ex.Level === 'Intermediate' ? 'level-i' : 'level-e';
    const loadGuideHtml = loadGuidanceHtml(state._recoUserLevel || state.f18 || 'Beginner', derive());
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay'; overlay.id = 'modalOverlay';
    overlay.onclick = e => { if (e.target === overlay) closeModal(); };
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${ex.Title}</div>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="modal-tags">
            ${ex.Level ? `<span class="modal-tag ${lvCls}">${ex.Level}</span>` : ''}
            ${ex.Equipment ? `<span class="modal-tag equipment">${ex.Equipment}</span>` : ''}
            ${ex.BodyPart ? `<span class="modal-tag bodypart">${ex.BodyPart}</span>` : ''}
            ${ex.Type ? `<span class="modal-tag type">${ex.Type}</span>` : ''}
          </div>

          <!-- Program Box -->
          <div class="modal-section-label">Program Latihan</div>
          <div class="modal-program-box">
            <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px;">Berdasarkan tujuan: <strong style="color:var(--white)">${sr.goal}</strong></div>
            <div class="modal-program-grid">
              <div class="modal-program-item"><div class="mp-val">${eff.sets}</div><div class="mp-label">Set</div></div>
              <div class="modal-program-item"><div class="mp-val">${eff.reps}</div><div class="mp-label">Repetisi</div></div>
              <div class="modal-program-item"><div class="mp-val">${eff.restLabel}</div><div class="mp-label">Istirahat</div></div>
            </div>
          </div>

          <div class="modal-section-label">Panduan Beban</div>
          ${loadGuideHtml}

          ${ex.Desc ? `<div class="modal-section-label">Deskripsi Gerakan</div><div class="modal-desc">${ex.Desc}</div>` : ''}
          ${(ex.Rating && ex.Rating > 0) ? `<div style="margin-top:10px;display:flex;align-items:center;gap:7px;font-size:.78rem;color:var(--text-muted);">
            <span style="color:var(--yellow);">★</span>
            <span>Rating: <strong style="color:var(--white);">${ex.Rating}/10</strong></span>
          </div>` : ''}
          <div class="modal-actions">
            <a class="modal-btn-yt" href="${ytUrl}" target="_blank" rel="noopener">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              Tonton Tutorial
            </a>
            <button class="modal-btn-fav ${isFav ? 'active' : ''} ${isGuest ? 'disabled' : ''}" id="modalFavBtn"
              onclick="handleModalFavClick()">
              ${isFav ? '\u2665 Hapus dari Favorit' : '\u2661 Simpan ke Favorit'}
            </button>
          </div>
        </div>
      </div>`;
    window._modalEx = ex;
    document.body.appendChild(overlay); document.body.style.overflow = 'hidden';
  };

  /* ── INIT ────────────────────────────────────────────── */
  // Muat data latihan kelolaan admin dari server begitu halaman siap, supaya
  // kartu latihan di halaman rekomendasi & tabel admin memakai data terbaru.
  document.addEventListener('DOMContentLoaded', () => {
    fetchExercisesData();
  });

  console.log('[exercise.js] ExpertGym Kelola Data Latihan (backend API mode) dimuat.');
})();
