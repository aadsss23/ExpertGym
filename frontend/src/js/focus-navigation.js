/* ══════════════════════════════════════════════════════════
   📍 Tahap Alur Penelitian: Implementasi Sistem → Pengembangan Sistem →
      Implementasi Website
   EXPERTGYM — FOCUS NAVIGATION
   Enter key moves focus to next focusable field.
   On the last field, Enter triggers the context submit action.
   Supports: input, select, textarea (except radio/checkbox/hidden)
   ══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Selector for navigable form elements */
  const NAVIGABLE = [
    'input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]):not([type="submit"]):not([type="button"])',
    'select',
    'textarea'
  ].join(',');

  /* ── Context definitions ─────────────────────────────── */
  /* Each context = { container selector, submit callback } */
  const CONTEXTS = [
    {
      name: 'login',
      container: '#loginPanel',
      submitFn: () => typeof doLogin === 'function' && doLogin()
    },
    {
      name: 'register',
      container: '#registerPanel',
      submitFn: () => typeof doRegister === 'function' && doRegister()
    },
    {
      name: 'admin-form',
      container: '.admin-form-card',
      submitFn: () => {
        const btn = document.getElementById('btnAdminSave');
        if (btn && !btn.disabled) btn.click();
      }
    }
  ];

  /* ── Get visible focusable fields within a container ─── */
  function getFields(container) {
    return Array.from(container.querySelectorAll(NAVIGABLE)).filter(el => {
      if (el.disabled || el.readOnly) return false;
      // Skip elements not visible
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      // Skip elements in hidden parent
      let parent = el.parentElement;
      while (parent) {
        const ps = window.getComputedStyle(parent);
        if (ps.display === 'none' || parent.classList.contains('hidden')) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }

  /* ── Find which context owns a given element ─────────── */
  function findContext(el) {
    for (const ctx of CONTEXTS) {
      const container = document.querySelector(ctx.container);
      if (container && container.contains(el)) return { ctx, container };
    }
    return null;
  }

  /* ── Main keydown handler ─────────────────────────────── */
  function handleKeydown(e) {
    if (e.key !== 'Enter') return;

    const target = e.target;

    /* Allow Enter inside textarea to insert newline */
    if (target.tagName === 'TEXTAREA') return;

    /* Allow Enter inside select to change value (browser default) */
    /* — we still want to move focus after selection, so we handle it */

    const found = findContext(target);
    if (!found) return;

    const { ctx, container } = found;
    const fields = getFields(container);
    const idx = fields.indexOf(target);

    if (idx === -1) return;

    if (idx < fields.length - 1) {
      /* Move to next field */
      e.preventDefault();
      fields[idx + 1].focus();
      /* For select/input: select text for easy replacement */
      if (fields[idx + 1].select) {
        try { fields[idx + 1].select(); } catch (_) {}
      }
    } else {
      /* Last field → trigger submit */
      e.preventDefault();
      ctx.submitFn();
    }
  }

  /* ── Attach listener once DOM is ready ───────────────── */
  function attach() {
    document.addEventListener('keydown', handleKeydown, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }

  /* ── Remove inline onkeydown on loginPassword to avoid double-fire */
  document.addEventListener('DOMContentLoaded', function () {
    const pw = document.getElementById('loginPassword');
    if (pw) pw.removeAttribute('onkeydown');
  });

})();
