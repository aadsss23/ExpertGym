/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * ui-dialogs.js — ExpertGym Custom Confirm Dialog
 *
 * Menyediakan window.egConfirm(message, opts) sebagai pengganti confirm()
 * bawaan browser. confirm()/alert() bawaan browser ditampilkan oleh BROWSER
 * itu sendiri (judulnya "localhost says" / nama domain), bukan oleh
 * halaman web — sehingga terasa keluar dari tampilan ExpertGym. Dialog ini
 * dibangun murni dari HTML/CSS milik ExpertGym (memakai struktur .modal
 * yang sama dengan modal-modal lain di situs), jadi peringatan konfirmasi
 * akan selalu tampil sebagai bagian dari website, bukan popup browser.
 *
 * Pemakaian (menggantikan `if (!confirm('...')) return;`):
 *
 *   if (!(await egConfirm('Hapus data ini?'))) return;
 *
 * Opsi tambahan (semua opsional):
 *   egConfirm(message, {
 *     title: 'Judul dialog',        // default: 'Konfirmasi'
 *     confirmText: 'Ya, Hapus',     // default: 'Ya, Lanjutkan'
 *     cancelText: 'Batal',          // default: 'Batal'
 *     danger: true                  // default: true → tombol konfirmasi berwarna merah
 *   })
 *
 * File ini TIDAK mengubah file lain — hanya menambahkan window.egConfirm
 * yang lalu dipakai di app.js/auth.js/exercise.js/wlog.js sebagai
 * pengganti confirm() bawaan.
 */

(function () {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  let activeReject = null;

  window.egConfirm = function (message, opts) {
    const {
      title = 'Konfirmasi',
      confirmText = 'Ya, Lanjutkan',
      cancelText = 'Batal',
      danger = true
    } = opts || {};

    // Kalau ada dialog konfirmasi lain yang masih terbuka, tutup dulu
    // (anggap dibatalkan) supaya tidak menumpuk.
    document.getElementById('egConfirmOverlay')?.remove();
    if (typeof activeReject === 'function') { activeReject(); activeReject = null; }

    return new Promise((resolve) => {
      const prevOverflow = document.body.style.overflow;
      const prevFocus = document.activeElement;

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay eg-confirm-overlay';
      overlay.id = 'egConfirmOverlay';
      overlay.innerHTML = `
        <div class="modal eg-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="egConfirmTitle">
          <div class="modal-header eg-confirm-header">
            <div class="modal-title" id="egConfirmTitle">${esc(title)}</div>
          </div>
          <div class="modal-body eg-confirm-body">
            <p class="eg-confirm-message">${esc(message)}</p>
          </div>
          <div class="modal-actions eg-confirm-actions">
            <button type="button" class="eg-confirm-btn eg-confirm-cancel" id="egConfirmCancelBtn">${esc(cancelText)}</button>
            <button type="button" class="eg-confirm-btn ${danger ? 'eg-confirm-danger' : 'eg-confirm-primary'}" id="egConfirmOkBtn">${esc(confirmText)}</button>
          </div>
        </div>`;

      function cleanup(result) {
        document.removeEventListener('keydown', onKeydown, true);
        overlay.remove();
        document.body.style.overflow = prevOverflow;
        if (prevFocus && typeof prevFocus.focus === 'function') {
          try { prevFocus.focus(); } catch (_) {}
        }
        activeReject = null;
        resolve(result);
      }

      function onKeydown(e) {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
        else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
      }

      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
      overlay.querySelector('#egConfirmCancelBtn').addEventListener('click', () => cleanup(false));
      overlay.querySelector('#egConfirmOkBtn').addEventListener('click', () => cleanup(true));
      document.addEventListener('keydown', onKeydown, true);
      activeReject = () => cleanup(false);

      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      overlay.querySelector('#egConfirmOkBtn').focus();
    });
  };

  console.log('[ui-dialogs.js] ExpertGym Custom Confirm Dialog dimuat.');
})();
