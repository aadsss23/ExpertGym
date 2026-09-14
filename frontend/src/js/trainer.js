/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * trainer.js — ExpertGym (Backend API mode) — Fitur Kelola Personal Trainer
 *
 * Menghubungkan section Personal Trainer (publik) dan panel admin "Kelola
 * Profil Personal Trainer" yang SUDAH ADA di index.html ke backend Express
 * (lihat /backend/routes/trainers.js). Tidak ada perubahan pada HTML/CSS.
 *
 * Fungsi ini meng-override function bernama sama yang didefinisikan di
 * js/app.js (pola yang sama dipakai js/auth.js untuk Login/Register), agar
 * seluruh tombol onclick di index.html tetap bekerja tanpa perlu mengubah
 * struktur HTML.
 *
 * Data trainer sepenuhnya berasal dari server (MySQL) — bukan lagi
 * localStorage. Sebuah cache in-memory (_trainersCache) dipakai supaya
 * fungsi render yang dipanggil secara sinkron (mis. dari app.js) tetap bisa
 * membaca data terbaru tanpa perlu diubah jadi async.
 */

(function () {
  'use strict';

  const API_BASE = '/api/trainers';
  const TOKEN_KEY = 'eg_token'; // sama dengan key yang dipakai auth.js

  let _trainersCache = [];

  /* ── UTIL ───────────────────────────────────────────── */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  /** Wrapper fetch ke API trainers, otomatis melampirkan token & parsing JSON. */
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
      // Server mengembalikan respons non-JSON (mis. error 413/500 tanpa body JSON)
      data = { ok: false, message: `Server mengembalikan respons tidak valid (status ${res.status}).` };
    }
    return Object.assign({ status: res.status }, data);
  }

  /**
   * fetchTrainersData — DAFTAR TRAINER: ambil daftar trainer terbaru dari
   * server, simpan ke cache lokal, lalu render ulang halaman publik & admin
   * (jika sedang ditampilkan). Dipanggil saat halaman dimuat dan setiap kali
   * ada perubahan data (tambah/edit/hapus) agar UI langsung ter-update.
   */
  async function fetchTrainersData() {
    const result = await apiFetch('', { method: 'GET' });
    if (result.ok && Array.isArray(result.trainers)) {
      _trainersCache = result.trainers;
    }
    if (typeof renderTrainerSection === 'function') renderTrainerSection();
    if (typeof renderAdminTrainerSection === 'function') renderAdminTrainerSection();
    if (typeof renderAdminHome === 'function') renderAdminHome();
    return _trainersCache;
  }
  window.fetchTrainersData = fetchTrainersData;

  /**
   * getTrainersData — OVERRIDE: kembalikan data trainer dari cache in-memory
   * (bukan lagi localStorage). Dipakai secara sinkron oleh banyak fungsi
   * lain di app.js/admin.js, sehingga tetap disediakan sebagai fungsi sync.
   */
  window.getTrainersData = function () {
    return _trainersCache.slice();
  };

  /* ══════════════════════════════════════════════════════════
   * HALAMAN PUBLIK — DAFTAR TRAINER
   * ══════════════════════════════════════════════════════════ */
  window.renderTrainerSection = function () {
    const grid = document.getElementById('trainerGrid');
    if (!grid) return;

    const trainers = getTrainersData();
    if (!trainers.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);font-size:.85rem;">Belum ada data personal trainer.</div>`;
      return;
    }

    grid.innerHTML = trainers.map(t => {
      const photoHtml = t.photo
        ? `<img class="trainer-photo" src="${t.photo}" alt="${escAttr(t.name)}">`
        : `<div class="trainer-photo-placeholder">${TRAINER_PHOTO_PLACEHOLDER_SVG}</div>`;

      return `
      <div class="trainer-card reveal">
        <div class="trainer-photo-wrap">
          ${photoHtml}
          <div class="trainer-verified-dot"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1,6 4,9 11,2"/></svg></div>
        </div>
        <div class="trainer-name">${t.name}</div>
        <div class="trainer-title">${t.title}</div>

        <div class="trainer-certs">
          ${t.certs.length ? t.certs.map(c => `<div class="trainer-cert-item">${c}</div>`).join('') : `<div class="trainer-cert-item" style="color:var(--text-dim);">Belum ada sertifikasi ditambahkan</div>`}
        </div>

        <div style="font-family:'Inter',sans-serif;font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Kontribusi Validasi</div>
        <div class="trainer-contrib">
          ${t.contrib.length ? t.contrib.map(c => `<div class="trainer-contrib-item">${c}</div>`).join('') : `<div class="trainer-contrib-item" style="color:var(--text-dim);">Belum ada kontribusi ditambahkan</div>`}
        </div>

        <button class="btn-view-cert" onclick="openCertificateModal(${t.id})">Lihat Sertifikat</button>
      </div>`;
    }).join('');
    if(typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal();
  };

  /** openCertificateModal — OVERRIDE: modal sertifikat halaman publik, memakai t.cert dari server. */
  window.openCertificateModal = function (trainerId) {
    const trainer = getTrainersData().find(t => t.id === trainerId);
    if (!trainer) return;

    let certContent;
    if (trainer.cert) {
      certContent = `<img src="${trainer.cert}" alt="Sertifikat ${escAttr(trainer.name)}" style="width:100%;border-radius:12px;">`;
    } else {
      certContent = trainer.certs.length ? `
        <div class="cert-placeholder">
          <div class="cert-placeholder-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
          <div class="cert-placeholder-title">${trainer.certs[0]}</div>
          <div class="cert-placeholder-sub">
            Sertifikat asli tersedia dan telah diverifikasi.
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px;">
            ${trainer.certs.map(c => `
              <div style="background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);color:var(--green);padding:5px 12px;border-radius:20px;font-size:.7rem;">
                ${c}
              </div>`).join('')}
          </div>
        </div>` : `
        <div class="cert-placeholder">
          <div class="cert-placeholder-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div class="cert-placeholder-title">Belum ada sertifikat</div>
          <div class="cert-placeholder-sub">Admin belum mengunggah/menambahkan data sertifikasi untuk trainer ini.</div>
        </div>`;
    }

    const existing = document.getElementById('certModalOverlay');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'certModalOverlay';
    modal.onclick = (e) => { if (e.target === modal) closeCertificateModal(); };
    modal.innerHTML = `
      <div class="modal" style="max-width:440px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">Sertifikat ${escAttr(trainer.name)}</div>
          <button class="modal-close" onclick="closeCertificateModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px 26px;">
          ${certContent}
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  };

  /* ══════════════════════════════════════════════════════════
   * ADMIN — KELOLA PROFIL PERSONAL TRAINER
   * ══════════════════════════════════════════════════════════ */

  /** renderAdminTrainerSection — OVERRIDE: grid kartu trainer di admin panel, sumber data dari server. */
  window.renderAdminTrainerSection = function () {
    const container = document.getElementById('adminTrainerSection');
    if (!container) return;

    const countEl = document.getElementById('trainerAdminCount');
    const searchInput = document.getElementById('trainerSearchInput');
    const searchRaw = searchInput ? searchInput.value : '';
    const search = searchRaw.trim().toLowerCase();

    const all = getTrainersData();
    const trainers = search ? all.filter(t => t.name.toLowerCase().includes(search)) : all;

    if (countEl) {
      countEl.textContent = all.length ? `${trainers.length} dari ${all.length} trainer` : '';
    }

    if (!all.length) {
      container.innerHTML = `<div class="trainer-admin-empty">Belum ada trainer. Klik "+ Tambah Trainer" untuk menambahkan.</div>`;
      return;
    }
    if (!trainers.length) {
      container.innerHTML = `<div class="trainer-admin-empty">Tidak ditemukan trainer dengan nama "${escAttr(searchRaw.trim())}".</div>`;
      return;
    }

    container.innerHTML = trainers.map(t => {
      const photoHtml = t.photo
        ? `<img class="trainer-admin-photo" src="${t.photo}" alt="${escAttr(t.name)}">`
        : `<div class="trainer-admin-photo-placeholder">${TRAINER_PHOTO_PLACEHOLDER_SVG}</div>`;

      return `
      <div class="trainer-admin-card" id="trainerCard_${t.id}">
        <div class="trainer-admin-header">
          ${photoHtml}
          <div class="trainer-admin-header-info">
            <div class="trainer-admin-name">${t.name}</div>
            <div class="trainer-admin-title">${t.title}</div>
          </div>
        </div>
        <div class="trainer-admin-meta">
          <div class="trainer-admin-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${t.experience ? escAttr(t.experience) : 'Pengalaman belum diisi'}</span>
          </div>
          <div class="trainer-admin-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            <span>${t.contact ? escAttr(t.contact) : 'Kontak belum diisi'}</span>
          </div>
        </div>
        <div class="trainer-admin-actions">
          <button type="button" class="trainer-icon-btn detail" onclick="openTrainerDetailModal(${t.id})" title="Lihat Detail">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button type="button" class="trainer-icon-btn edit" onclick="openTrainerFormModal(${t.id})" title="Edit Trainer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="trainer-icon-btn delete" onclick="openTrainerDeleteConfirm(${t.id})" title="Hapus Trainer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  };

  /** openTrainerFormModal — OVERRIDE: isi form Tambah/Edit dari data server (cache). */
  window.openTrainerFormModal = function (trainerId) {
    _trainerFormPendingPhoto = null;
    _trainerFormPendingCert = null;

    const idInput = document.getElementById('trainerFormId');
    const nameInput = document.getElementById('trainerFormName');
    const titleInput = document.getElementById('trainerFormTitleInput');
    const expInput = document.getElementById('trainerFormExperience');
    const contactInput = document.getElementById('trainerFormContact');
    const certsInput = document.getElementById('trainerFormCerts');
    const contribInput = document.getElementById('trainerFormContrib');
    const modalTitle = document.getElementById('trainerFormModalTitle');
    const photoPreview = document.getElementById('trainerFormPhotoPreview');
    const certPreview = document.getElementById('trainerFormCertPreview');

    if (trainerId) {
      const t = getTrainersData().find(x => x.id === trainerId);
      if (!t) return;
      idInput.value = t.id;
      nameInput.value = t.name;
      titleInput.value = t.title;
      expInput.value = t.experience;
      contactInput.value = t.contact;
      certsInput.value = t.certs.join('\n');
      contribInput.value = t.contrib.join('\n');
      modalTitle.textContent = 'Edit Trainer';

      photoPreview.innerHTML = t.photo
        ? `<img src="${t.photo}" alt="${escAttr(t.name)}">`
        : TRAINER_PHOTO_PLACEHOLDER_SVG;
      certPreview.innerHTML = t.cert
        ? `<img src="${t.cert}" alt="Sertifikat">`
        : TRAINER_CERT_PLACEHOLDER_SVG;
    } else {
      idInput.value = '';
      nameInput.value = '';
      titleInput.value = '';
      expInput.value = '';
      contactInput.value = '';
      certsInput.value = '';
      contribInput.value = '';
      modalTitle.textContent = 'Tambah Trainer';
      photoPreview.innerHTML = TRAINER_PHOTO_PLACEHOLDER_SVG;
      certPreview.innerHTML = TRAINER_CERT_PLACEHOLDER_SVG;
    }

    document.getElementById('trainerFormModal').classList.remove('hidden');
    setTimeout(() => nameInput.focus(), 50);
  };

  /**
   * MAX_UPLOAD_BYTES — batas ukuran file foto/sertifikat yang diizinkan
   * sebelum dikonversi ke base64 dan dikirim ke server. Base64 menambah
   * ukuran data ±33%, jadi batas ini dijaga cukup kecil supaya payload
   * (dan penyimpanan di MySQL) tetap aman.
   */
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB

  /** handleTrainerFormPhotoChange — OVERRIDE: tambahkan validasi ukuran file. */
  window.handleTrainerFormPhotoChange = function (inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast('Ukuran foto terlalu besar. Gunakan foto maksimal 4MB.');
      inputEl.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      _trainerFormPendingPhoto = e.target.result;
      const preview = document.getElementById('trainerFormPhotoPreview');
      if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  };

  /** handleTrainerFormCertChange — OVERRIDE: tambahkan validasi ukuran file. */
  window.handleTrainerFormCertChange = function (inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast('Ukuran file sertifikat terlalu besar. Gunakan file maksimal 4MB.');
      inputEl.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      _trainerFormPendingCert = e.target.result;
      const preview = document.getElementById('trainerFormCertPreview');
      if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  };

  /**
   * submitTrainerForm — OVERRIDE: SATU-SATUNYA tempat data trainer ditulis
   * ke server. Mode Tambah → POST /api/trainers. Mode Edit → PUT
   * /api/trainers/:id. Setelah sukses, cache disegarkan (fetchTrainersData)
   * sehingga halaman publik & admin langsung menampilkan data terbaru.
   */
  window.submitTrainerForm = async function () {
    const idVal = document.getElementById('trainerFormId').value;
    const name = document.getElementById('trainerFormName').value.trim();
    const title = document.getElementById('trainerFormTitleInput').value.trim();
    const experience = document.getElementById('trainerFormExperience').value.trim();
    const contact = document.getElementById('trainerFormContact').value.trim();
    const certs = linesToArray(document.getElementById('trainerFormCerts').value);
    const contrib = linesToArray(document.getElementById('trainerFormContrib').value);

    if (!name || !title) {
      showToast('Nama dan Spesialisasi wajib diisi.');
      return;
    }

    const payload = { name, title, experience, contact, certs, contrib };
    if (_trainerFormPendingPhoto) payload.photo = _trainerFormPendingPhoto;
    if (_trainerFormPendingCert) payload.cert = _trainerFormPendingCert;

    const saveBtn = document.querySelector('#trainerFormModal .btn-save-photo');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const result = idVal
        ? await apiFetch('/' + encodeURIComponent(idVal), { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch('', { method: 'POST', body: JSON.stringify(payload) });

      if (!result.ok) {
        showToast(result.message || 'Gagal menyimpan data trainer. Coba lagi.');
        return;
      }

      closeTrainerFormModal();
      showToast(result.message || (idVal ? `Profil "${name}" berhasil diperbarui.` : `Trainer "${name}" berhasil ditambahkan.`));
      await fetchTrainersData();
    } catch (e) {
      console.error('[submitTrainerForm]', e);
      showToast('Terjadi kesalahan pada server. Coba lagi.');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  /** openTrainerDetailModal — OVERRIDE: tampilkan detail trainer dari data server. */
  window.openTrainerDetailModal = function (trainerId) {
    const t = getTrainersData().find(x => x.id === trainerId);
    if (!t) return;

    const nameEsc = t.name.replace(/'/g, "\\'");
    const photoHtml = t.photo
      ? `<img id="trainerDetailPhotoImg" class="trainer-detail-photo trainer-detail-photo-clickable" src="${t.photo}" alt="${escAttr(t.name)}" title="Klik untuk memperbesar foto" onclick="openImagePreviewModal('trainerDetailPhotoImg', 'Foto ${nameEsc}')">`
      : `<div class="trainer-detail-photo trainer-detail-photo-placeholder">${TRAINER_PHOTO_PLACEHOLDER_SVG}</div>`;

    const body = document.getElementById('trainerDetailBody');
    body.innerHTML = `
      <div class="trainer-detail-header">
        ${photoHtml}
        <div>
          <div class="trainer-detail-name">${t.name}</div>
          <div class="trainer-detail-title">${t.title}</div>
        </div>
      </div>
      <div class="trainer-detail-meta-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${t.experience ? escAttr(t.experience) : 'Pengalaman belum diisi'}</span>
      </div>
      <div class="trainer-detail-meta-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        <span>${t.contact ? escAttr(t.contact) : 'Kontak belum diisi'}</span>
      </div>
      <div class="trainer-detail-section">
        <div class="trainer-detail-section-title">Sertifikasi</div>
        ${t.certs.length ? t.certs.map(c => `<div class="trainer-detail-list-item">${escAttr(c)}</div>`).join('') : `<div class="trainer-detail-list-item" style="color:var(--text-dim);">Belum ada sertifikasi ditambahkan</div>`}
      </div>
      <div class="trainer-detail-section">
        <div class="trainer-detail-section-title">Kontribusi Validasi</div>
        ${t.contrib.length ? t.contrib.map(c => `<div class="trainer-detail-list-item">${escAttr(c)}</div>`).join('') : `<div class="trainer-detail-list-item" style="color:var(--text-dim);">Belum ada kontribusi ditambahkan</div>`}
      </div>
      ${t.cert ? `
        <img id="trainerDetailCertImg" src="${t.cert}" style="display:none;">
        <button type="button" class="btn-preview-photo" style="width:100%;justify-content:center;margin-top:4px;"
          onclick="openImagePreviewModal('trainerDetailCertImg', 'Sertifikat ${nameEsc}')">Lihat Sertifikat</button>
      ` : ''}
    `;
    document.getElementById('trainerDetailModal').classList.remove('hidden');
  };

  /**
   * confirmDeleteTrainer — OVERRIDE: eksekusi penghapusan lewat
   * DELETE /api/trainers/:id, lalu segarkan cache & tampilan.
   */
  window.confirmDeleteTrainer = async function () {
    if (_pendingDeleteTrainerId == null) return;
    const t = getTrainersData().find(x => x.id === _pendingDeleteTrainerId);
    const trainerId = _pendingDeleteTrainerId;

    try {
      const result = await apiFetch('/' + encodeURIComponent(trainerId), { method: 'DELETE' });
      if (!result.ok) {
        showToast(result.message || 'Gagal menghapus trainer. Coba lagi.');
        return;
      }
      closeTrainerDeleteConfirm();
      showToast(result.message || `Trainer "${t ? t.name : ''}" berhasil dihapus.`);
      await fetchTrainersData();
    } catch (e) {
      console.error('[confirmDeleteTrainer]', e);
      showToast('Terjadi kesalahan pada server. Coba lagi.');
    }
  };

  /* ── INIT ────────────────────────────────────────────── */
  // Muat daftar trainer dari server begitu halaman siap, supaya section
  // publik "Divalidasi oleh Personal Trainer" langsung terisi data terbaru.
  document.addEventListener('DOMContentLoaded', () => {
    fetchTrainersData();
  });

  console.log('[trainer.js] ExpertGym Kelola Personal Trainer (backend API mode) dimuat.');
})();
