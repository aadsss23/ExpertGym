/**
 * js/mobile-ui.js — ExpertGym: Lapisan UI/UX khusus Mobile (≤640px)
 *
 * PENTING: File ini HANYA mengubah cara informasi ditampilkan pada layar
 * mobile. Semua logika sistem (Forward Chaining, dataset, validasi
 * pertanyaan, jumlah hari latihan, jadwal mingguan, rekomendasi, safety
 * flag F13–F19, dsb.) TIDAK disentuh sama sekali — file ini murni
 * membungkus (monkey-patch) fungsi tampilan yang sudah ada di app.js /
 * auth.js / secure-auth.js, lalu menambah efek visual (stepper, bottom
 * nav, dst). Setiap fungsi asli tetap dipanggil apa adanya sebelum kita
 * menambahkan efek tampilan.
 *
 * Dimuat PALING TERAKHIR (lihat index.html) supaya membungkus versi
 * fungsi yang benar-benar aktif (mis. showAppScreen versi terbaru dari
 * secure-auth.js/trainer.js jika ada, bukan stub awal di app.js).
 */
(function () {
  'use strict';

  const MOBILE_MQ = window.matchMedia('(max-width: 640px)');
  function isMobile() { return MOBILE_MQ.matches; }

  // ── Helper: cek mode tamu (memakai state global yang SUDAH ADA) ──
  // Catatan: `state` dideklarasikan dengan `const` di app.js (bukan
  // `window.state`), jadi harus diakses sebagai identifier biasa, bukan
  // lewat window.state (yang akan selalu undefined).
  function isGuestUser() {
    try {
      return typeof state === 'undefined' || !state.currentUser || state.currentUser.role === 'guest';
    } catch (e) { return true; }
  }

  // ══════════════════════════════════════════════════════════
  // 1. HEADER: body class is-guest/is-user (untuk CSS mobile)
  // ══════════════════════════════════════════════════════════
  function updateAuthUI() {
    const guest = isGuestUser();
    document.body.classList.toggle('is-guest', guest);
    document.body.classList.toggle('is-user', !guest);
  }

  // ══════════════════════════════════════════════════════════
  // 2. BOTTOM NAV: highlight tab aktif
  // ══════════════════════════════════════════════════════════
  const VIEW_TO_TAB = { home: 'mbnHome', assessment: 'mbnAssessment', wlog: 'mbnWorkout' };

  function setBottomActive(id) {
    document.querySelectorAll('.mbn-item').forEach(b => b.classList.remove('active'));
    const el = id && document.getElementById(id);
    if (el) el.classList.add('active');
  }
  window.mobileSetBottomActive = setBottomActive; // dipakai inline onclick tombol Riwayat

  function syncBottomNavToCurrentView() {
    const asmActive = document.getElementById('assessmentView')?.classList.contains('active');
    const wlogEl = document.getElementById('wlogView');
    const wlogVisible = wlogEl && !wlogEl.classList.contains('hidden');
    if (asmActive) setBottomActive('mbnAssessment');
    else if (wlogVisible) setBottomActive('mbnWorkout');
    else setBottomActive('mbnHome');
  }

  // ══════════════════════════════════════════════════════════
  // 3. ASSESSMENT STEPPER (step-by-step + progress bar, mobile only)
  //    Tidak mengubah <input type=radio> / value yang dibaca oleh
  //    processAsesmen(), submitDynamicAll(), dsb — hanya menyembunyikan
  //    .question-block yang belum aktif via style.display.
  // ══════════════════════════════════════════════════════════
  function isAnswered(block) {
    const option = block.querySelector('.radio-option[data-q]');
    if (!option) return false;
    const q = option.dataset.q;
    try {
      return typeof state !== 'undefined' && !!state[q];
    } catch (e) {
      return false;
    }
  }

  function createStepper(container, opts) {
    opts = opts || {};
    const blocks = Array.from(container.querySelectorAll('.question-block'));
    if (!blocks.length) return null;

    let idx = 0;
    const submitBtn = opts.submitSelector ? container.querySelector(opts.submitSelector) : null;
    const backOutBtn = opts.backSelector ? container.querySelector(opts.backSelector) : null;

    // Progress bar (disisipkan di awal container)
    const progress = document.createElement('div');
    progress.className = 'm-stepper-progress';
    progress.innerHTML =
      '<div class="m-stepper-progress-track"><div class="m-stepper-progress-fill"></div></div>' +
      '<div class="m-stepper-progress-text"><span class="m-step-current"></span><span class="m-step-pct"></span></div>';
    container.insertBefore(progress, container.firstChild);

    // Tombol navigasi (disisipkan di akhir container)
    const navEl = document.createElement('div');
    navEl.className = 'm-stepper-nav';
    navEl.innerHTML =
      '<button type="button" class="m-step-back">Kembali</button>' +
      '<button type="button" class="m-step-next">Lanjut</button>';
    container.appendChild(navEl);

    const fill = progress.querySelector('.m-stepper-progress-fill');
    const curText = progress.querySelector('.m-step-current');
    const pctText = progress.querySelector('.m-step-pct');
    const backBtn = navEl.querySelector('.m-step-back');
    const nextBtn = navEl.querySelector('.m-step-next');


    function clearRequiredOnAnswer(event) {
      const option = event.target.closest('.radio-option');
      if (!option) return;
      const block = option.closest('.question-block');
      if (!block) return;
      block.classList.remove('m-answer-required');
      block.querySelector('.m-answer-required-text')?.remove();
    }
    container.addEventListener('click', clearRequiredOnAnswer);

    function render() {
      blocks.forEach((b, i) => { b.style.display = (i === idx) ? '' : 'none'; });
      const pct = Math.round(((idx + 1) / blocks.length) * 100);
      fill.style.width = pct + '%';
      curText.textContent = 'Pertanyaan ' + (idx + 1) + ' dari ' + blocks.length;
      pctText.textContent = pct + '%';
      backBtn.disabled = (idx === 0 && !backOutBtn);
      nextBtn.textContent = (idx === blocks.length - 1) ? 'Selesai' : 'Lanjut';
      // Jaga kartu asesmen tetap berada di area tengah layar mobile.
      const cardEl = container.closest('.main-card') || container;
      cardEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    backBtn.addEventListener('click', function () {
      if (idx === 0) { if (backOutBtn) backOutBtn.click(); return; }
      idx--; render();
    });

    nextBtn.addEventListener('click', function () {
      if (!isAnswered(blocks[idx])) {
        const activeBlock = blocks[idx];
        activeBlock.classList.add('m-answer-required');
        let warning = activeBlock.querySelector('.m-answer-required-text');
        if (!warning) {
          warning = document.createElement('div');
          warning.className = 'm-answer-required-text';
          warning.textContent = 'Pilih salah satu jawaban terlebih dahulu.';
          activeBlock.appendChild(warning);
        }
        if (typeof showToast === 'function') showToast('Pilih salah satu jawaban untuk melanjutkan.');
        return;
      }
      blocks[idx].classList.remove('m-answer-required');
      blocks[idx].querySelector('.m-answer-required-text')?.remove();
      if (idx === blocks.length - 1) {
        if (submitBtn) submitBtn.click();
        return;
      }
      idx++; render();
    });

    container.classList.add('m-stepper-active');
    idx = 0;
    render();

    return {
      reset() { idx = 0; render(); },
      destroy() {
        blocks.forEach(b => { b.style.display = ''; });
        container.removeEventListener('click', clearRequiredOnAnswer);
        container.classList.remove('m-stepper-active');
        progress.remove();
        navEl.remove();
      }
    };
  }

  let step1Stepper = null;
  let dynStepper = null;

  function teardownSteppers() {
    if (step1Stepper) { step1Stepper.destroy(); step1Stepper = null; }
    if (dynStepper) { dynStepper.destroy(); dynStepper = null; }
  }

  function setupStep1Stepper() {
    const root = document.querySelector('#step1 .card-body');
    if (!root) return;
    if (!isMobile()) return;
    if (step1Stepper) { step1Stepper.reset(); return; }
    step1Stepper = createStepper(root, { submitSelector: '.btn-primary' });
  }

  function setupDynStepper() {
    const root = document.getElementById('dynamicQBody');
    if (!root) return;
    // Konten dynamicQBody selalu digambar ulang tiap kali — bangun ulang stepper
    if (dynStepper) { dynStepper.destroy(); dynStepper = null; }
    if (!isMobile()) return;
    if (!root.querySelector('.question-block')) return;
    dynStepper = createStepper(root, { submitSelector: '.btn-primary', backSelector: '.btn-secondary' });
  }

  // ══════════════════════════════════════════════════════════
  // 4. WRAP fungsi tampilan yang sudah ada (tanpa mengubah isinya)
  // ══════════════════════════════════════════════════════════
  function wrap(name, after) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      const ret = orig.apply(this, arguments);
      try { after.apply(this, arguments); } catch (e) { console.error('[mobile-ui] ' + name + ' hook error', e); }
      return ret;
    };
  }

  wrap('showAppScreen', function () {
    updateAuthUI();
    setupStep1Stepper();
    syncBottomNavToCurrentView();
  });

  wrap('showView', function (view) {
    syncBottomNavToCurrentView();
    if (view === 'assessment') setupStep1Stepper();
  });

  wrap('setStep', function (n) {
    if (n === 1) setupStep1Stepper();
  });

  wrap('renderDynamicSplitFrequency', function () {
    setupDynStepper();
  });

  wrap('closePanel', function () {
    syncBottomNavToCurrentView();
  });

  wrap('doLogout', function () {
    teardownSteppers();
  });

  // Adaptasi saat viewport melewati breakpoint mobile (resize/putar layar)
  function onBreakpointChange(e) {
    if (!e.matches) {
      teardownSteppers();
    } else {
      const asmActive = document.getElementById('assessmentView')?.classList.contains('active');
      if (asmActive) {
        const step1El = document.getElementById('step1');
        const step1bEl = document.getElementById('step1b');
        if (step1El && !step1El.classList.contains('hidden')) setupStep1Stepper();
        if (step1bEl && !step1bEl.classList.contains('hidden')) setupDynStepper();
      }
    }
  }
  if (typeof MOBILE_MQ.addEventListener === 'function') {
    MOBILE_MQ.addEventListener('change', onBreakpointChange);
  } else if (typeof MOBILE_MQ.addListener === 'function') {
    MOBILE_MQ.addListener(onBreakpointChange); // fallback Safari lama
  }

  // ══════════════════════════════════════════════════════════
  // 5. Inisialisasi awal
  // ══════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function () {
    updateAuthUI();
    syncBottomNavToCurrentView();
    // Jika appScreen sudah aktif (mis. sesi dipulihkan sebelum file ini
    // sempat membungkus showAppScreen), siapkan stepper step1 sekarang.
    if (document.getElementById('appScreen')?.classList.contains('active')) {
      setupStep1Stepper();
    }
  });

  console.log('[mobile-ui.js] Lapisan UI mobile ExpertGym dimuat (tidak mengubah logika sistem).');
})();
