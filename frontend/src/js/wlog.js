/**
 * 📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem → Implementasi Website
 *
 * wlog.js — ExpertGym Workout Log v3
 *
 * ARSITEKTUR DATA:
 *   Program aktif SELALU dibaca langsung dari state.weekPlan (single source of truth).
 *   dayStatus per user disimpan di eg_wlogStatus_{uid}_{rekoId}
 *     { [dayIdx]: { done: bool, exercises:[{title, done}], finishedAt } }
 *
 * Sinkronisasi:
 *   - Workout Log membaca weekPlan langsung dari state.weekPlan
 *   - Tidak ada salinan weekPlan tersendiri di localStorage
 *   - Jika jadwal diubah di hasil rekomendasi, Workout Log otomatis sinkron
 *
 * Riwayat:
 *   - Panel Riwayat TIDAK menambah record baru dari Workout Log
 *   - Detail hari latihan di Riwayat ditampilkan sebagai modal (on demand)
 */
(function () {
  'use strict';

  /* ── STORAGE ─────────────────────────────────────────── */
  function uid() {
    return (typeof state !== 'undefined' && state.currentUser)
      ? String(state.currentUser.id) : null;
  }

  // Dapatkan rekoId aktif
  function getRekoId() {
    return (typeof state !== 'undefined') ? state._currentRekoId || null : null;
  }

  // Key untuk dayStatus
  function statusKey(rekoId) {
    return 'eg_wlogStatus_' + uid() + '_' + rekoId;
  }

  function getDayStatus(rekoId) {
    try { return JSON.parse(localStorage.getItem(statusKey(rekoId)) || '{}'); }
    catch (_) { return {}; }
  }

  function saveDayStatus(rekoId, dayStatus) {
    try { localStorage.setItem(statusKey(rekoId), JSON.stringify(dayStatus)); }
    catch (_) {}
  }

  // Inisialisasi dayStatus untuk semua hari latihan di weekPlan
  function initDayStatus(weekPlan, existingStatus) {
    const result = {};
    (weekPlan || []).forEach((day, i) => {
      if (day.isRest) return;
      if (existingStatus[i]) {
        // Perbarui exercise list jika weekPlan berubah (sinkronisasi)
        const existing = existingStatus[i];
        const newExercises = day.exercises.map((ex, exIdx) => {
          const prev = existing.exercises && existing.exercises[exIdx];
          return {
            title: ex.Title,
            bodyPart: ex.BodyPart || '',
            equipment: ex.Equipment || '',
            level: ex.Level || '',
            desc: ex.Desc || '',
            done: prev ? prev.done : false,
          };
        });
        result[i] = {
          done: existing.done || false,
          finishedAt: existing.finishedAt || null,
          exercises: newExercises,
        };
      } else {
        result[i] = {
          done: false,
          finishedAt: null,
          exercises: day.exercises.map(ex => ({
            title: ex.Title,
            bodyPart: ex.BodyPart || '',
            equipment: ex.Equipment || '',
            level: ex.Level || '',
            desc: ex.Desc || '',
            done: false,
          })),
        };
      }
    });
    return result;
  }

  /* ── UTIL ────────────────────────────────────────────── */
  function isLoggedIn() {
    return typeof state !== 'undefined'
      && state.currentUser
      && state.currentUser.role !== 'guest';
  }
  function toast(msg) { if (typeof showToast === 'function') showToast(msg); }
  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString('id-ID',
      { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Set/Rep info dari state
  function getSR() {
    const sr = (typeof SET_REP !== 'undefined' && typeof state !== 'undefined' && state.f5)
      ? (SET_REP[state.f5] || SET_REP.b)
      : { sets: 4, reps: '8–12', restLabel: '60 det' };
    return sr;
  }

  // Satu-satunya icon SVG yang dipakai (checkmark hari selesai) — kecil & fungsional,
  // konsisten dgn checkbox latihan di bawah.
  const CHECK_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  // Estimasi durasi & kalori per hari — HANYA untuk tampilan (heuristik dari set/rep),
  // tidak disimpan/tidak memengaruhi data atau logika apa pun.
  function estimateDayMetrics(exCount, sr) {
    const sets = sr.sets || 4;
    const restSec = parseInt(sr.restLabel) || 60;
    const secsPerSet = 40; // asumsi rata-rata durasi kerja per set
    const totalSec = exCount * sets * (secsPerSet + restSec);
    const minutes = Math.max(5, Math.round(totalSec / 60));
    const kcal = Math.round(minutes * 6.5); // heuristik ringan ~6.5 kkal/menit latihan beban
    return { minutes, kcal };
  }

  /* ── TOMBOL "MULAI WORKOUT" DI HASIL REKO ────────────── */
  window.wlogSyncStartButton = function () {
    const btn = document.getElementById('btnMulaiWorkout');
    if (!btn) return;
    const show = isLoggedIn()
      && typeof state !== 'undefined'
      && state.weekPlan && state.weekPlan.length
      && getRekoId();
    btn.classList.toggle('hidden', !show);
    if (show) {
      const rekoId = getRekoId();
      const ds = getDayStatus(rekoId);
      const hasProgress = Object.keys(ds).length > 0;
      btn.textContent = hasProgress ? 'Lanjutkan Workout' : 'Mulai Workout';
    }
  };

  /* ── MULAI / LANJUTKAN DARI HASIL REKO ──────────────── */
  window.startWorkoutSession = function () {
    if (!isLoggedIn()) {
      toast('⚠️ Login terlebih dahulu untuk memulai Workout Log.');
      return;
    }
    const rekoId = getRekoId();
    if (!rekoId) { toast('⚠️ Selesaikan asesmen terlebih dahulu.'); return; }

    // Pastikan dayStatus diinisialisasi / diperbarui sesuai weekPlan terbaru
    const existing = getDayStatus(rekoId);
    const ds = initDayStatus(state.weekPlan, existing);
    saveDayStatus(rekoId, ds);

    if (typeof showView === 'function') showView('wlog');
  };

  /* ── RENDER WORKOUT LOG VIEW ─────────────────────────── */
  window.renderWlogView = function () {
    if (!isLoggedIn()) {
      toast('⚠️ Login untuk mengakses Workout Log.');
      if (typeof showView === 'function') showView('home');
      return;
    }
    _renderMain();
  };

  /* ── RENDER UTAMA ────────────────────────────────────── */
  function _renderMain() {
    const activeDiv = document.getElementById('wlogActiveSession');
    const noSessDiv = document.getElementById('wlogNoSession');
    if (!activeDiv || !noSessDiv) return;

    const rekoId = getRekoId();
    const weekPlan = (typeof state !== 'undefined') ? state.weekPlan : null;

    if (!rekoId || !weekPlan || !weekPlan.length) {
      activeDiv.classList.add('hidden');
      noSessDiv.classList.remove('hidden');
      return;
    }

    activeDiv.classList.remove('hidden');
    noSessDiv.classList.add('hidden');

    // Pastikan dayStatus sinkron dengan weekPlan terbaru
    const existing = getDayStatus(rekoId);
    const dayStatus = initDayStatus(weekPlan, existing);
    saveDayStatus(rekoId, dayStatus);

    const trainingDays = weekPlan.filter(d => !d.isRest);
    const doneDays = trainingDays.filter((_, idx) => {
      const realIdx = weekPlan.indexOf(trainingDays[idx]);
      return dayStatus[realIdx] && dayStatus[realIdx].done;
    }).length;

    // Judul program = gabungan semua split unik (misal: Push · Pull · Legs)
    const uniqueSplits = [...new Set(trainingDays.map(d => d.splitLabel).filter(Boolean))];
    const programTitle = uniqueSplits.length
      ? uniqueSplits.map(s => {
          // Sederhanakan label panjang (ambil kata pertama saja untuk PPL)
          const short = s.replace(/\s*\(.*?\)/g, '').trim(); // hapus keterangan dalam kurung
          return short;
        }).join(' · ')
      : 'Program Latihan';

    const pct = trainingDays.length ? (doneDays/trainingDays.length)*100 : 0;

    document.getElementById('wlogSessionTitle').textContent = programTitle;
    document.getElementById('wlogSessionMeta').textContent =
      `${trainingDays.length} hari latihan`;
    document.getElementById('wlogSessionPct').textContent =
      trainingDays.length ? Math.round(pct) + '%' : '0%';
    document.getElementById('wlogProgressLabel').textContent =
      `${doneDays} dari ${trainingDays.length} hari latihan selesai`;

    const fill = document.getElementById('wlogProgressFill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.style.background = pct >= 100 ? 'var(--green)' : '';
    }

    _renderDayList(weekPlan, dayStatus, rekoId);

    // Program ini bisa saja baru saja selesai (hari terakhir dicentang) —
    // perbarui label tombol "Mulai Asesmen" di Beranda supaya konsisten.
    if (typeof refreshAssessmentCTA === 'function') refreshAssessmentCTA();
  }

  /* ── RENDER DAFTAR HARI ──────────────────────────────── */
  function _renderDayList(weekPlan, dayStatus, rekoId) {
    const listEl = document.getElementById('wlogExerciseList');
    if (!listEl) return;
    const sr = getSR();

    let html = '';
    weekPlan.forEach((day, dayIdx) => {
      if (day.isRest) {
        html += `
          <div class="wlog-day-block rest">
            <div class="wlog-day-header">
              <div class="wlog-day-left">
                <div>
                  <span class="wlog-day-name">${esc(day.dayName)}</span>
                  <span class="wlog-day-label">Rest Day</span>
                </div>
              </div>
            </div>
          </div>`;
        return;
      }

      const ds      = dayStatus[dayIdx] || { done:false, exercises:[] };
      const total   = ds.exercises.length;
      const doneEx  = ds.exercises.filter(e => e.done).length;
      const pct     = total ? Math.round((doneEx/total)*100) : 0;
      const isDone  = ds.done;
      const metrics = estimateDayMetrics(total, sr);

      // Judul tab = dayName + splitLabel (sinkron dengan jadwal aktif)
      const metaBits = [esc(day.splitLabel||'')];
      if (isDone && ds.finishedAt) metaBits.push(fmtDate(ds.finishedAt));

      html += `
        <div class="wlog-day-block ${isDone ? 'done' : ''}" id="wlogDay_${dayIdx}">
          <div class="wlog-day-header" onclick="wlogToggleDay(${dayIdx})">
            <div class="wlog-day-left">
              <span class="wlog-day-check ${isDone ? 'checked' : ''}">
                ${isDone ? CHECK_ICON : ''}
              </span>
              <div>
                <span class="wlog-day-name">${esc(day.dayName)}</span>
                <span class="wlog-day-label">${metaBits.filter(Boolean).join(' · ')}</span>
              </div>
            </div>
            <div class="wlog-day-right">
              <span class="wlog-day-pct ${isDone ? 'done' : ''}">${pct}%</span>
              <span class="wlog-day-chevron" id="wlogChevron_${dayIdx}">></span>
            </div>
          </div>
          <div class="wlog-day-bar">
            <div class="wlog-day-bar-fill" style="width:${pct}%;background:${isDone?'var(--green)':'var(--accent)'}"></div>
          </div>
          <!-- Detail latihan (collapsible) -->
          <div class="wlog-day-exlist hidden" id="wlogDayEx_${dayIdx}">
            <div class="wlog-ex-set-info">
              ${sr.sets} set &nbsp;·&nbsp; ${sr.reps} rep &nbsp;·&nbsp; Istirahat ${sr.restLabel}
            </div>
            ${ds.exercises.map((ex, exIdx) => _renderExerciseRow(ex, exIdx, dayIdx, day, sr, isDone)).join('')}
            ${!isDone ? `
              <div class="wlog-day-actions">
                <button class="wlog-btn-finish" onclick="wlogFinishDay(${dayIdx})">
                  Tandai Hari Selesai
                </button>
              </div>` : `
              <div class="wlog-day-done-badge">
                Selesai ${ds.finishedAt ? '· ' + fmtDate(ds.finishedAt) : ''}
              </div>`}
          </div>
        </div>`;
    });

    listEl.innerHTML = html;
  }

  /* ── RENDER SATU BARIS LATIHAN (dengan detail lengkap) ── */
  function _renderExerciseRow(ex, exIdx, dayIdx, day, sr, isDone) {
    // Ambil data lengkap dari state.weekPlan (sumber tunggal)
    const weekPlan = (typeof state !== 'undefined') ? state.weekPlan : [];
    const fullDayData = weekPlan[dayIdx];
    const fullEx = fullDayData && fullDayData.exercises && fullDayData.exercises[exIdx]
      ? fullDayData.exercises[exIdx]
      : null;

    const title = fullEx ? fullEx.Title : ex.title;
    const bodyPart = fullEx ? (fullEx.BodyPart || '') : (ex.bodyPart || '');
    const equipment = fullEx ? (fullEx.Equipment || '') : (ex.equipment || '');
    const level = fullEx ? (fullEx.Level || '') : (ex.level || '');
    const desc = fullEx ? (fullEx.Desc || '') : (ex.desc || '');

    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' tutorial gym exercise')}`;

    const lvCls = level === 'Beginner' ? 'level-b' : level === 'Intermediate' ? 'level-i' : 'level-e';

    return `
      <div class="wlog-ex-row ${ex.done ? 'done' : ''}" id="wlogExRow_${dayIdx}_${exIdx}">
        <div class="wlog-ex-row-top">
          <label class="wlog-ex-check-wrap">
            <input type="checkbox" ${ex.done ? 'checked' : ''}
              onchange="wlogToggleEx(${dayIdx},${exIdx})"
              ${isDone ? 'disabled' : ''}>
            <span class="wlog-ex-checkmark"></span>
          </label>
          <div class="wlog-ex-info">
            <span class="wlog-ex-name">${esc(title)}</span>
            <div class="wlog-ex-tags">
              ${level ? `<span class="ex-tag ${lvCls}" style="font-size:.62rem;padding:2px 6px">${level}</span>` : ''}
              ${equipment ? `<span class="ex-tag eq" style="font-size:.62rem;padding:2px 6px">${esc(equipment)}</span>` : ''}
              ${bodyPart ? `<span class="ex-tag" style="font-size:.62rem;padding:2px 6px">${esc(bodyPart)}</span>` : ''}
            </div>
          </div>
          <div class="wlog-ex-srinfo">${sr.sets}×${sr.reps}</div>
        </div>
        ${desc ? `<div class="wlog-ex-desc">${esc(desc)}</div>` : ''}
        <div class="wlog-ex-actions">
          <a class="btn-yt" href="${ytUrl}" target="_blank" rel="noopener" style="font-size:.7rem;padding:4px 10px">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            Tutorial
          </a>
        </div>
      </div>`;
  }

  /* ── TOGGLE COLLAPSE HARI ────────────────────────────── */
  window.wlogToggleDay = function (dayIdx) {
    const exList = document.getElementById('wlogDayEx_' + dayIdx);
    const chevron = document.getElementById('wlogChevron_' + dayIdx);
    if (!exList) return;
    const isOpen = !exList.classList.contains('hidden');
    exList.classList.toggle('hidden', isOpen);
    if (chevron) chevron.textContent = isOpen ? '>' : '<';

    // Update judul halaman mengikuti hari yang sedang dibuka
    if (!isOpen) {
      // Hari ini sedang dibuka — update judul
      const weekPlan = (typeof state !== 'undefined') ? state.weekPlan : null;
      if (weekPlan && weekPlan[dayIdx]) {
        const day = weekPlan[dayIdx];
        const titleEl = document.getElementById('wlogSessionTitle');
        if (titleEl && day.splitLabel) {
          titleEl.textContent = day.splitLabel;
        }
      }
    }
  };

  /* ── TOGGLE CHECKBOX LATIHAN ─────────────────────────── */
  window.wlogToggleEx = function (dayIdx, exIdx) {
    const rekoId = getRekoId(); if (!rekoId) return;
    const weekPlan = (typeof state !== 'undefined') ? state.weekPlan : null;
    if (!weekPlan) return;

    const dayStatus = getDayStatus(rekoId);
    if (!dayStatus[dayIdx]) dayStatus[dayIdx] = initDayStatus(weekPlan, {})[dayIdx];
    const ds = dayStatus[dayIdx];
    if (!ds || ds.done) return;

    ds.exercises[exIdx].done = !ds.exercises[exIdx].done;
    saveDayStatus(rekoId, dayStatus);

    // Update UI row
    const row = document.getElementById(`wlogExRow_${dayIdx}_${exIdx}`);
    if (row) row.classList.toggle('done', ds.exercises[exIdx].done);

    // Update progress bar hari
    const total  = ds.exercises.length;
    const doneEx = ds.exercises.filter(e => e.done).length;
    const pct    = total ? Math.round((doneEx/total)*100) : 0;
    const dayBar = document.querySelector(`#wlogDay_${dayIdx} .wlog-day-bar-fill`);
    if (dayBar) { dayBar.style.width = pct + '%'; }
    const dayPctEl = document.querySelector(`#wlogDay_${dayIdx} .wlog-day-pct`);
    if (dayPctEl) dayPctEl.textContent = pct + '%';

    if (doneEx === total) {
      setTimeout(() => toast('Semua latihan hari ini selesai! Tekan "Tandai Hari Selesai".'), 300);
    }
  };

  /* ── TANDAI HARI SELESAI ─────────────────────────────── */
  window.wlogFinishDay = async function (dayIdx) {
    const rekoId = getRekoId(); if (!rekoId) return;
    const weekPlan = (typeof state !== 'undefined') ? state.weekPlan : null;
    if (!weekPlan) return;

    const dayStatus = getDayStatus(rekoId);
    const ds = dayStatus[dayIdx];
    if (!ds) return;

    const total  = ds.exercises.length;
    const doneEx = ds.exercises.filter(e => e.done).length;

    if (doneEx < total) {
      const sisa = total - doneEx;
      const ok = await egConfirm(`${sisa} latihan belum dicentang. Tandai hari ini selesai tetap?`, {
        title: 'Latihan Belum Selesai', confirmText: 'Ya, Tandai Selesai', danger: false
      });
      if (!ok) return;
      ds.exercises.forEach(e => { e.done = true; });
    }

    ds.done       = true;
    ds.finishedAt = Date.now();
    saveDayStatus(rekoId, dayStatus);

    toast('Hari latihan selesai!');
    _renderMain();
  };

  /* ── RESET PROGRAM (mulai dari awal) ─────────────────── */
  window.wlogResetProgram = async function () {
    const ok = await egConfirm('Reset seluruh progres program ini? Semua centang akan hilang.', {
      title: 'Reset Progres', confirmText: 'Ya, Reset'
    });
    if (!ok) return;
    const rekoId = getRekoId(); if (!rekoId) return;
    const weekPlan = (typeof state !== 'undefined') ? state.weekPlan : null;
    if (!weekPlan) return;

    const freshStatus = initDayStatus(weekPlan, {});
    saveDayStatus(rekoId, freshStatus);
    _renderMain();
    toast('Program direset.');
  };

  /* ── TANDAI RIWAYAT SEBAGAI SELESAI (dipakai bersama) ─────
   * Dipakai oleh "Hapus Program" (wlogDeleteProgram) DAN "Ulangi
   * Asesmen/Rekomendasi" (restartApp di app.js) — kapan pun sebuah
   * program ditinggalkan sebelum selesai 100%, riwayatnya TETAP
   * tersimpan tapi statusnya di Riwayat dipaksa jadi "Sudah Selesai"
   * (bukan "Masih Berjalan"), lalu disinkronkan ke backend supaya
   * database dan localStorage/cache tidak ada yang tertinggal.
   * ──────────────────────────────────────────────────────── */
  window.markRecommendationFinished = function (rekoId) {
    if (!rekoId) return null;
    try {
      const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
      let rec = null;
      let changed = false;
      const updated = all.map((h) => {
        if (String(h.id) === String(rekoId)) {
          if (h.forceFinished) { rec = h; return h; }
          changed = true;
          rec = Object.assign({}, h, { forceFinished: true, forceFinishedAt: Date.now() });
          return rec;
        }
        return h;
      });
      if (changed) {
        localStorage.setItem('eg_allHistory', JSON.stringify(updated));
        // Sinkronkan penanda ini ke database (upsert riwayat_rekomendasi,
        // tanpa menghapus barisnya) lewat helper yang disediakan
        // workout-log.js, kalau tersedia.
        if (typeof window._egSyncRiwayatForceFinished === 'function') {
          window._egSyncRiwayatForceFinished(rec);
        }
      }
      return rec;
    } catch (_) {
      return null;
    }
  };

  /* ── HAPUS PROGRAM AKTIF ─────────────────────────────────
   * Berbeda dari Reset Progres: ini mengosongkan program (weekPlan)
   * itu sendiri, bukan sekadar centang progresnya. Setelah dihapus,
   * tidak ada program aktif sama sekali di Workout Log, dan asesmen
   * ikut direset ke awal (setara menekan "Ulangi Asesmen" saat asesmen
   * selesai) supaya "Mulai Asesmen" tidak membuka hasil lama.
   * ──────────────────────────────────────────────────────── */
  window.wlogDeleteProgram = async function () {
    const ok = await egConfirm(
      'Hapus program latihan ini sepenuhnya? Seluruh jadwal di Workout Log akan dikosongkan dan Anda perlu menjalani asesmen ulang untuk membuat program baru.',
      { title: 'Hapus Program Latihan', confirmText: 'Ya, Hapus Program' }
    );
    if (!ok) return;
    const rekoId = getRekoId();

    // Hapus data progres (centang) milik program ini
    if (rekoId) {
      try { localStorage.removeItem(statusKey(rekoId)); } catch (_) {}
    }

    // JANGAN hapus record riwayat_rekomendasi-nya — riwayat program
    // harus tetap tersimpan. Tandai selesai saja (lihat helper di atas).
    if (rekoId) window.markRecommendationFinished(rekoId);

    if (typeof state !== 'undefined') {
      // Lepas program aktif dari Workout Log
      state._currentRekoId = null;
      // Reset seluruh state asesmen (f1–f19, weekPlan, dll) —
      // sama seperti restartApp(), agar asesmen mulai dari awal lagi.
      if (typeof resetAllState === 'function') resetAllState();
      if (typeof setStep === 'function') setStep(1);
    }

    _renderMain();
    toast('Program latihan dihapus.');
  };

  /* ── STATS PUBLIK (untuk progress tracker) ────────────── */
  window.wlogGetStats = function (rekoId) {
    const id = uid(); if (!id) return null;
    const activeRekoId = rekoId || getRekoId();
    if (!activeRekoId) return null;

    // Cari weekPlan: jika rekoId aktif, gunakan state.weekPlan
    let weekPlan = null;
    if (!rekoId || (typeof state !== 'undefined' && String(state._currentRekoId) === String(activeRekoId))) {
      weekPlan = (typeof state !== 'undefined') ? state.weekPlan : null;
    }
    if (!weekPlan) {
      // Fallback: cari dari eg_allHistory
      try {
        const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
        const rec = all.find(h => String(h.id) === String(activeRekoId));
        if (rec && rec.weekPlan) weekPlan = rec.weekPlan;
      } catch (_) {}
    }
    if (!weekPlan) return null;

    const dayStatus = getDayStatus(activeRekoId);
    const trainDays = weekPlan.filter(d => !d.isRest);
    let daysDone = 0, exDone = 0, exTotal = 0;

    weekPlan.forEach((day, realIdx) => {
      if (day.isRest) return;
      const ds = dayStatus[realIdx];
      if (!ds) return;
      exTotal += ds.exercises.length;
      const dEx = ds.exercises.filter(e => e.done).length;
      exDone += dEx;
      if (ds.done) daysDone++;
    });

    const pct = exTotal ? Math.round((exDone / exTotal) * 100) : 0;
    return {
      rekoId: activeRekoId,
      totalDays: trainDays.length,
      daysDone,
      exTotal,
      exDone,
      pct,
      status: daysDone >= trainDays.length && trainDays.length > 0
        ? 'Selesai' : daysDone > 0 ? 'Sedang Berjalan' : 'Belum Dimulai',
    };
  };

  /* ── LOAD FROM HISTORY (Riwayat → Workout Log) ──────── */
  window.wlogLoadFromHistory = function (rekoId) {
    if (!isLoggedIn()) { toast('⚠️ Login terlebih dahulu.'); return; }

    // Set rekoId agar bisa dilihat di Workout Log
    if (typeof state !== 'undefined') {
      state._currentRekoId = String(rekoId);
    }

    // Cari weekPlan dari history dan restore ke state
    try {
      const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
      const rec = all.find(h => String(h.id) === String(rekoId));
      if (!rec || !rec.weekPlan) {
        toast('⚠️ Data program tidak ditemukan.');
        return;
      }
      // Restore state agar Workout Log punya weekPlan
      if (typeof state !== 'undefined') {
        state.weekPlan = JSON.parse(JSON.stringify(rec.weekPlan));
        if (rec.assessmentAnswers) {
          Object.keys(rec.assessmentAnswers).forEach(k => {
            if (rec.assessmentAnswers[k] !== undefined) state[k] = rec.assessmentAnswers[k];
          });
        }
        state.f17 = rec.levelBase;
        state.f18 = rec.level;
        state.f19 = rec.safetyFlag;
        state.selectedEquipments = [...(rec.equipments || [])];
      }
    } catch (e) {
      console.error('[wlogLoadFromHistory]', e);
      toast('⚠️ Gagal memuat program.');
      return;
    }

    if (typeof closePanel === 'function') closePanel();
    if (typeof showView  === 'function') showView('wlog');
  };

  /* ── RESTORE REKOID SAAT HALAMAN DIMUAT ───────────────
   * PENTING: sebelumnya blok ini HANYA mengisi state._currentRekoId
   * dari record riwayat terbaru, tanpa ikut memulihkan state.weekPlan.
   * Akibatnya, Panel Riwayat (yang menganggap record terbaru sebagai
   * "Masih Berjalan" selama belum selesai) tidak sinkron dengan Workout
   * Log, karena _renderMain() mengecek state.weekPlan — yang kosong
   * setelah refresh halaman — sehingga selalu tampil "Belum Ada Program
   * Aktif" walau Riwayat bilang program itu masih berjalan.
   *
   * Sekarang, kalau record terbaru BELUM selesai, seluruh state program
   * itu (weekPlan, jawaban asesmen, dsb — sama seperti wlogLoadFromHistory)
   * ikut dipulihkan, supaya Workout Log benar-benar menampilkannya sebagai
   * program aktif. Kalau record terbaru SUDAH selesai, _currentRekoId
   * sengaja TIDAK diisi — tidak ada program aktif di Workout Log, dan
   * user bebas memulai asesmen baru. ─── */
  window.restoreActiveProgramState = function () {
    if (typeof state === 'undefined') return;
    if (!state._currentRekoId) {
      try {
        const id = uid();
        if (id) {
          const all = JSON.parse(localStorage.getItem('eg_allHistory') || '[]');
          const mine = all.filter(h => String(h.userId) === id && !h.source);
          const latest = mine[0];
          if (latest && latest.weekPlan) {
            const trainDays = latest.weekPlan.filter(d => !d.isRest);
            const dayStatus = getDayStatus(latest.id);
            const daysDone = trainDays.filter((day) => {
              const realIdx = latest.weekPlan.indexOf(day);
              return dayStatus[realIdx] && dayStatus[realIdx].done;
            }).length;
            const finished = !!latest.forceFinished || (trainDays.length > 0 && daysDone >= trainDays.length);

            if (!finished) {
              // Program terbaru belum selesai → pulihkan seluruh state-nya
              // supaya Workout Log ikut menampilkannya sebagai aktif.
              state._currentRekoId = String(latest.id);
              state.weekPlan = JSON.parse(JSON.stringify(latest.weekPlan));
              const ans = latest.assessmentAnswers || {};
              Object.keys(ans).forEach((k) => { if (ans[k] !== undefined) state[k] = ans[k]; });
              state.f17 = latest.levelBase;
              state.f18 = latest.level;
              state.f19 = latest.safetyFlag;
              state.f19Warnings = [...(latest.f19Warnings || [])];
              state.score = latest.score || 0;
              state.matchedRule = latest.matchedRule || '(dari riwayat)';
              state.selectedEquipments = [...(latest.equipments || [])];
              state.activeDay = 0;
            }
          }
        }
      } catch (_) {}
    }
    if (typeof renderWlogView === 'function') {
      const wlogViewEl = document.getElementById('wlogView');
      if (wlogViewEl && !wlogViewEl.classList.contains('hidden')) renderWlogView();
    }
    if (typeof refreshAssessmentCTA === 'function') refreshAssessmentCTA();
  };

  /* ── RESTORE REKOID SAAT HALAMAN DIMUAT ─────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(window.restoreActiveProgramState, 200);
  });

  console.log('[wlog.js v3] Workout Log dimuat.');
})();
