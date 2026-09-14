/* ══════════════════════════════════════════════════════════
 * CUSTOM DROPDOWN — komponen pengganti <select> native.
 *
 * Dipakai pada form "Kelola Data Latihan" (Body Part & Tipe) supaya:
 *  - Panel pilihan SELALU terbuka ke bawah (tidak lagi ke atas
 *    seperti perilaku <select> native di browser).
 *  - Tinggi panel dibatasi (± 5 opsi terlihat), sisanya bisa discroll.
 *  - Tidak ada opsi kosong "Pilih Body Part" / "Pilih Tipe" di dalam
 *    daftar pilihan — teks itu hanya jadi placeholder pada tombol
 *    saat belum ada nilai yang dipilih.
 *
 * Elemen root tetap memakai id yang sama seperti <select> sebelumnya
 * (mis. #addBodyPart, #addType) dan diberi properti `.value` custom
 * (getter/setter) via Object.defineProperty, sehingga seluruh kode
 * lain yang sudah ada (app.js, exercise.js — yang membaca/menulis
 * `document.getElementById('addBodyPart').value`) tetap berfungsi
 * tanpa perlu diubah sama sekali.
 * ══════════════════════════════════════════════════════════ */
(function () {
  function initCustomDropdown(el) {
    if (!el || el._customDropdownInit) return;
    el._customDropdownInit = true;

    const trigger = el.querySelector('.custom-dropdown-trigger');
    const label = el.querySelector('.custom-dropdown-label');
    const panel = el.querySelector('.custom-dropdown-panel');
    const options = Array.from(el.querySelectorAll('.custom-dropdown-option'));
    const placeholder = el.dataset.placeholder || 'Pilih';

    let currentValue = '';

    function applyValue(newValue, opts) {
      currentValue = newValue || '';
      const matched = options.find(o => o.dataset.value === currentValue);

      if (matched) {
        label.textContent = matched.dataset.value;
        label.classList.remove('is-placeholder');
      } else {
        currentValue = '';
        label.textContent = placeholder;
        label.classList.add('is-placeholder');
      }

      options.forEach(o => o.classList.toggle('selected', o.dataset.value === currentValue));

      if (!opts || !opts.silent) {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Properti `.value` custom — kompatibel dengan pemakaian `.value` /
    // `.value = ...` yang sudah ada di kode lain.
    Object.defineProperty(el, 'value', {
      configurable: true,
      get() { return currentValue; },
      set(v) { applyValue(v, { silent: true }); },
    });

    function closeDropdown() {
      el.classList.remove('open');
    }

    function openDropdown() {
      // Tutup dropdown custom lain yang mungkin sedang terbuka.
      document.querySelectorAll('.custom-dropdown.open').forEach(other => {
        if (other !== el) other.classList.remove('open');
      });
      el.classList.add('open');
      // Pastikan opsi terpilih (jika ada) langsung terlihat, dan scroll
      // panel selalu mulai berfungsi dengan baik dari posisi yang wajar.
      const selected = panel.querySelector('.custom-dropdown-option.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      } else {
        panel.scrollTop = 0;
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.classList.contains('open')) closeDropdown();
      else openDropdown();
    });

    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        applyValue(opt.dataset.value);
        closeDropdown();
        el.focus();
      });
    });

    // Klik di luar komponen -> tutup panel.
    document.addEventListener('click', (e) => {
      if (!el.contains(e.target)) closeDropdown();
    });

    // Navigasi keyboard dasar (Enter/Space buka-tutup, Esc tutup,
    // Arrow Up/Down pindah opsi, Enter pilih opsi yang di-highlight).
    el.addEventListener('keydown', (e) => {
      const isOpen = el.classList.contains('open');

      if (e.key === 'Escape') {
        closeDropdown();
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
        e.preventDefault();
        openDropdown();
        return;
      }

      if (isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const currentIndex = options.findIndex(o => o.classList.contains('hover-active'));
        let nextIndex;
        if (currentIndex === -1) {
          nextIndex = e.key === 'ArrowDown' ? 0 : options.length - 1;
        } else {
          nextIndex = e.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, options.length - 1)
            : Math.max(currentIndex - 1, 0);
        }
        options.forEach(o => o.classList.remove('hover-active'));
        options[nextIndex].classList.add('hover-active');
        options[nextIndex].scrollIntoView({ block: 'nearest' });
        return;
      }

      if (isOpen && e.key === 'Enter') {
        e.preventDefault();
        const active = options.find(o => o.classList.contains('hover-active'));
        if (active) {
          applyValue(active.dataset.value);
          closeDropdown();
        }
        return;
      }
    });

    // Nilai awal kosong -> tampilkan placeholder pada tombol.
    applyValue('', { silent: true });
  }

  function initAll() {
    document.querySelectorAll('.custom-dropdown').forEach(initCustomDropdown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Diekspos jaga-jaga bila ada dropdown kustom lain yang dirender
  // secara dinamis setelah load awal.
  window.initCustomDropdown = initCustomDropdown;
})();
