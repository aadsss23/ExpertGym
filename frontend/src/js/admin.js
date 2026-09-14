/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * admin.js — ExpertGym Admin Panel (navigasi & util bersama)
 *
 * CATATAN REVISI:
 * File ini sebelumnya berisi implementasi CRUD Data Latihan berbasis
 * localStorage (getAllExercises, renderAdminExTable, adminSaveExercise,
 * adminStartEdit, adminResetForm, adminDeleteExercise) serta fitur
 * Statistik Dashboard & Kelola User.
 *
 * Kode tersebut sudah dihapus karena:
 *  - Fungsi CRUD Data Latihan sepenuhnya digantikan oleh js/exercise.js
 *    (dimuat SETELAH file ini, menimpa window.* dengan versi backend
 *    MySQL) — versi localStorage di sini tidak pernah tereksekusi.
 *  - Fitur Statistik Dashboard & Kelola User tidak memiliki elemen HTML
 *    tujuan (#adminStatsSection, #adminUserSection) maupun tab navigasi
 *    di index.html, dan tidak terhubung ke tabel `user` di MySQL —
 *    sehingga tidak pernah bisa diakses dan tidak termasuk fitur yang
 *    diuji/didokumentasikan di BAB IV.
 *
 * Fungsi yang tersisa di file ini:
 *   showAdminScreen()  → tampilkan panel admin & buka tab Beranda
 *   adminCancelEdit()  → batalkan mode edit pada form Kelola Data Latihan
 *                         (dipanggil dari onclick="" di index.html;
 *                         adminResetForm()/renderAdminExTable() yang
 *                         dipanggil di dalamnya diselesaikan ke versi
 *                         backend milik js/exercise.js saat runtime)
 */

(function () {
  'use strict';

  /* ── OVERRIDE: showAdminScreen ─────────────────────────── */
  window.showAdminScreen = function () {
    document.getElementById('adminScreen').classList.add('active');
    if (typeof showAdminView === 'function') {
      showAdminView('home');
    } else {
      setTimeout(() => {
        if (typeof renderAdminTrainerSection === 'function') renderAdminTrainerSection();
      }, 100);
      if (typeof renderAdminExTable === 'function') renderAdminExTable();
    }
  };

  /* ── adminCancelEdit ────────────────────────────────────── */
  window.adminCancelEdit = function () {
    const hf = document.getElementById('editingTitle');
    if (hf) hf.value = '';
    if (typeof adminResetForm === 'function') adminResetForm();

    const formTitle = document.getElementById('adminFormTitle');
    if (formTitle) formTitle.textContent = 'Tambah Data Latihan';

    const btnSave = document.getElementById('btnAdminSave');
    if (btnSave) { btnSave.textContent = '+ Tambah Latihan'; btnSave.classList.remove('editing'); }

    const btnCancel = document.getElementById('btnAdminCancel');
    if (btnCancel) btnCancel.classList.add('hidden');

    if (typeof renderAdminExTable === 'function') renderAdminExTable();
  };

  console.log('[admin.js] ExpertGym Admin (navigasi) dimuat.');
})();
