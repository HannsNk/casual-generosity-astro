// Drives the landing-page starter pack (components/StarterPack.astro):
// start → three tasks (done / swap / skip, auto-advance + undo) →
// celebration → signup ask. State lives on the device only, via
// lib/starter-store.js. Behaviour follows docs/starter-pack-build-brief.md.
//
// Which hero a visitor gets is decided by scripts/landing.js; this module
// only exports a controller for it to show the pack in a given mode.

import pack from '../data/starter-pack.json';
import { loadStarter, saveStarter } from '../lib/starter-store.js';
import { auth } from '../lib/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { signInWithGoogle, signInWithEmail, emailAuthErrorMessage } from '../lib/auth-actions.js';

const SLOTS = [1, 2, 3];
const ADVANCE_MS = 800;
const UNDO_MS = 5000;

// mode: 'intro' (L1 get-started), 'resume' (L4 "welcome back" card),
// 'signup' (L5 "Save it": the signup ask on its own).
export function initStarterPack(root) {
  const $ = (sel, el = root) => el.querySelector(sel);
  const $$ = (sel, el = root) => [...el.querySelectorAll(sel)];

  const card = $('[data-sp-card]');
  const labelEl = $('[data-sp-label]');
  const countEl = $('[data-sp-count]');
  const segs = $$('[data-sp-seg]');
  const views = Object.fromEntries($$('[data-sp-view]').map((v) => [v.dataset.spView, v]));
  const rowsEl = $('[data-sp-rows]');
  const store = $('[data-sp-store]');
  const panels = Object.fromEntries($$('[data-sp-task]').map((p) => [p.dataset.spTask, p]));
  const undoBar = $('[data-sp-undo]');
  const undoText = $('[data-sp-undo-text]');
  const live = $('[data-sp-live]');

  let s = loadStarter();
  let active = null; // slot currently expanded
  let reoffering = false; // active slot is a skipped one being offered again
  let declinedReoffer = false; // "leave it for later" — stop re-offering this page view
  let justDone = null; // slot showing its DONE state before auto-advance
  let lastDone = null; // slot the undo bar would restore
  let advanceTimer = 0;
  let undoTimer = 0;
  let resumeGate = false; // L4: show the resume card until "Pick up where you left off"

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const taskFor = (slot) => pack.tasks[s.slots[slot]];
  const isDone = (slot) => s.done.includes(slot);
  const isSkipped = (slot) => s.skipped.includes(slot);
  const announce = (msg) => {
    live.textContent = '';
    window.setTimeout(() => { live.textContent = msg; }, 50);
  };
  const progressText = (n) => `${n} of 3 done`;

  // First slot that's neither done nor skipped; failing that, offer a
  // skipped one again (not the one just skipped, and only until declined).
  const nextSlot = (justSkipped = null) => {
    reoffering = false;
    const fresh = SLOTS.find((n) => !isDone(n) && !isSkipped(n));
    if (fresh) return fresh;
    if (declinedReoffer) return null;
    const again = SLOTS.find((n) => !isDone(n) && n !== justSkipped);
    if (again) reoffering = true;
    return again ?? null;
  };

  // Keeps the given task in view as the card grows and shrinks around it
  // (a done task collapses to its feedback line, the next one expands).
  const keepInView = (el) => {
    const top = el.getBoundingClientRect().top;
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 58;
    if (top < navH || top > window.innerHeight * 0.6) {
      el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  };

  const focusHeading = (slot) => {
    const panel = panels[s.slots[slot]];
    if (!panel) return;
    keepInView(panel);
    panel.querySelector('.sp-task-title').focus({ preventScroll: true });
  };

  // ---------- rendering ----------

  const render = () => {
    const doneCount = s.done.length;
    const complete = Boolean(s.completedAt);
    root.classList.toggle('is-started', s.started);
    root.classList.toggle('is-complete', complete);

    const resuming = resumeGate && s.started && !complete;
    root.classList.toggle('is-resuming', resuming);
    labelEl.textContent = s.started && !resuming ? 'Starter pack' : 'Starter pack · 3 small things';
    const oneLeft = s.started && doneCount === 2 && !complete && !resuming;
    countEl.textContent = oneLeft ? 'One left.' : `${doneCount} of 3`;
    countEl.classList.toggle('is-last', oneLeft);
    countEl.hidden = resuming;
    segs.forEach((seg) => seg.classList.toggle('is-done', isDone(Number(seg.dataset.spSeg))));

    views.intro.hidden = s.started || complete;
    views.resume.hidden = !resuming;
    views.pack.hidden = !s.started || complete || resuming;
    views.complete.hidden = !complete;
    if (resuming) $('[data-sp-resume-title]').textContent = `Welcome back — ${doneCount} of 3 done`;

    card.classList.toggle('is-pressed', justDone !== null);
    if (complete) renderComplete();
    else if (s.started && !resuming) renderRows();
  };

  const renderRows = () => {
    Object.values(panels).forEach((p) => store.append(p));
    rowsEl.replaceChildren();

    SLOTS.forEach((slot) => {
      const id = s.slots[slot];
      const task = pack.tasks[id];
      const li = document.createElement('li');

      if (slot === active) {
        const panel = panels[id];
        panel.querySelector('[data-sp-tag]').textContent =
          `Task ${slot} of 3 · ${task.minutes} min · ${task.category}`;
        panel.classList.toggle('is-done', justDone === slot);
        panel.querySelector('[data-sp-reoffer]').hidden = !reoffering;
        panel.querySelectorAll('[data-sp-skip]').forEach((b) => {
          b.textContent = reoffering ? 'Leave it for later' : 'Skip for now';
        });
        panel.querySelector('[data-sp-swap]')?.toggleAttribute('hidden', swapPool(slot).length < 2);
        li.append(panel);
      } else if (isDone(slot)) {
        const row = document.createElement('div');
        row.className = 'sp-row is-done';
        row.innerHTML = '<span class="sp-badge">Done</span><span class="sp-row-title"></span>';
        row.querySelector('.sp-row-title').textContent = task.title;
        li.append(row);
      } else {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'sp-row';
        row.innerHTML = '<span class="sp-num"></span><span class="sp-row-title"></span><span class="sp-min"></span>';
        row.querySelector('.sp-num').textContent = String(slot);
        row.querySelector('.sp-row-title').textContent = task.title;
        row.querySelector('.sp-min').textContent = isSkipped(slot) ? 'Skipped' : `${task.minutes} min`;
        row.setAttribute('aria-label', `Task ${slot}: ${task.title}${isSkipped(slot) ? ', skipped' : ''}. Open`);
        row.addEventListener('click', () => openSlot(slot));
        li.append(row);
      }
      rowsEl.append(li);
    });
  };

  const openSlot = (slot) => {
    finishPendingAdvance();
    active = slot;
    reoffering = false;
    render();
    focusHeading(slot);
  };

  // ---------- start / browse / sign in ----------

  $('[data-sp-start]').addEventListener('click', () => {
    s = saveStarter({ started: true });
    active = nextSlot();
    render();
    card.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    focusHeading(active);
    announce(`Starter pack started. ${progressText(s.done.length)}.`);
  });

  $('[data-sp-resume]').addEventListener('click', () => {
    resumeGate = false;
    active = nextSlot();
    render();
    if (active) focusHeading(active);
    else rowsEl.querySelector('button.sp-row')?.focus();
    announce(`${progressText(s.done.length)}.`);
  });

  $('[data-sp-browse]').addEventListener('click', () => {
    saveStarter({ dismissed: true });
  });

  // Opens the nav's existing sign-in panel. stopPropagation: the widget
  // closes its panel on any document click outside it, which this click
  // would otherwise reach right after opening it.
  $('[data-sp-signin]').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('auth-signin')?.click();
  });

  // ---------- done / undo ----------

  const finishPendingAdvance = () => {
    if (!advanceTimer) return;
    window.clearTimeout(advanceTimer);
    advanceTimer = 0;
    justDone = null;
  };

  const markDone = (slot, extra = {}) => {
    finishPendingAdvance();
    s = saveStarter({
      ...extra,
      done: [...s.done.filter((n) => n !== slot), slot].sort(),
      skipped: s.skipped.filter((n) => n !== slot),
    });
    justDone = slot;
    lastDone = slot;
    render();
    keepInView(panels[s.slots[slot]]);
    announce(`Task ${slot} marked done. ${progressText(s.done.length)}.`);

    undoText.textContent = `Task ${slot} marked done`;
    undoBar.hidden = false;
    window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => { undoBar.hidden = true; }, UNDO_MS);

    advanceTimer = window.setTimeout(() => {
      advanceTimer = 0;
      justDone = null;
      if (s.done.length === 3) {
        complete();
        return;
      }
      active = nextSlot();
      render();
      if (active) focusHeading(active);
    }, ADVANCE_MS);
  };

  $('[data-sp-undo-btn]').addEventListener('click', () => {
    if (lastDone === null) return;
    finishPendingAdvance();
    window.clearTimeout(undoTimer);
    undoBar.hidden = true;
    const slot = lastDone;
    lastDone = null;
    s = saveStarter({
      done: s.done.filter((n) => n !== slot),
      completedAt: null,
      ...(slot === 3 ? { plan: null } : {}),
    });
    active = slot;
    reoffering = false;
    render();
    focusHeading(slot);
    announce(`Task ${slot} back to not done. ${progressText(s.done.length)}.`);
  });

  // ---------- skip / swap ----------

  const swapPool = (slot) => {
    const cfg = pack.slots[slot];
    const taken = SLOTS.filter((n) => n !== slot).map((n) => s.slots[n]);
    return [cfg.default, ...cfg.swaps].filter((id) => !taken.includes(id));
  };

  const skip = (slot) => {
    finishPendingAdvance();
    if (reoffering) declinedReoffer = true;
    if (!isSkipped(slot)) s = saveStarter({ skipped: [...s.skipped, slot] });
    active = nextSlot(slot);
    render();
    if (active) {
      focusHeading(active);
      announce(`Task ${slot} skipped. Moved to task ${active}.`);
    } else {
      rowsEl.querySelector('button.sp-row')?.focus();
      announce(`Task ${slot} skipped. ${progressText(s.done.length)}. Tap a task to come back to it.`);
    }
  };

  const swap = (slot) => {
    const pool = swapPool(slot);
    const next = pool[(pool.indexOf(s.slots[slot]) + 1) % pool.length];
    s = saveStarter({ slots: { ...s.slots, [slot]: next } });
    active = slot;
    reoffering = false;
    render();
    focusHeading(slot);
    announce(`Swapped. Task ${slot} is now: ${pack.tasks[next].title}.`);
  };

  Object.entries(panels).forEach(([id, panel]) => {
    const slotOf = () => SLOTS.find((n) => s.slots[n] === id);
    panel.querySelectorAll('[data-sp-skip]').forEach((b) => b.addEventListener('click', () => skip(slotOf())));
    panel.querySelector('[data-sp-swap]')?.addEventListener('click', () => swap(slotOf()));
    if (id !== 'send-a-plan') {
      panel.querySelector('[data-sp-done]').addEventListener('click', () => markDone(slotOf()));
    }
  });

  // ---------- task 1: platform toggle ----------

  const platformBtns = $$('[data-sp-platform]', store);
  const setPlatform = (p) => {
    platformBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.spPlatform === p)));
    $$('[data-sp-platform-steps]', store).forEach((ol) => { ol.hidden = ol.dataset.spPlatformSteps !== p; });
  };
  platformBtns.forEach((b) => b.addEventListener('click', () => setPlatform(b.dataset.spPlatform)));
  setPlatform(/android/i.test(navigator.userAgent) ? 'Android' : 'iPhone');

  // ---------- task 3: pick, name, send ----------

  const planPanel = panels['send-a-plan'];
  const radios = $$('input[name="sp-pick"]', planPanel);
  const nameInput = $('#sp-name', planPanel);
  const captionEl = $('[data-sp-caption]', planPanel);
  const sendBtn = $('[data-sp-send]', planPanel);
  const confirmEl = $('[data-sp-confirm]', planPanel);
  const whatsappBtn = $('[data-sp-whatsapp]', planPanel);
  const copyBtn = $('[data-sp-copy]', planPanel);
  const canShare = typeof navigator.share === 'function';

  // No share sheet: copying becomes the primary action.
  if (!canShare) {
    sendBtn.textContent = 'Copy message';
    copyBtn.hidden = true;
  }

  const picked = () => radios.find((r) => r.checked) ?? null;

  const caption = () => {
    const r = picked();
    if (!r) return '';
    const name = nameInput.value.trim();
    return `Hey${name ? ` ${name}` : ''}, I picked this for us: "${r.dataset.title}". Up for it? ${r.dataset.url}?via=plan`;
  };

  const updateCaption = () => {
    const text = caption();
    captionEl.textContent = text || 'Pick one above and your message shows up here.';
    captionEl.classList.toggle('is-empty', !text);
    [sendBtn, whatsappBtn, copyBtn].forEach((b) => { b.disabled = !text; });
  };

  radios.forEach((r) => r.addEventListener('change', updateCaption));
  nameInput.addEventListener('input', updateCaption);

  let set = 'a';
  const showSet = (name) => {
    set = name;
    $$('[data-sp-set]', planPanel).forEach((l) => { l.hidden = l.dataset.spSet !== set; });
    const r = picked();
    if (r && r.closest('[data-sp-set]').hidden) r.checked = false;
    updateCaption();
  };
  $('[data-sp-more]', planPanel)?.addEventListener('click', () => {
    showSet(set === 'a' ? 'b' : 'a');
    $(`[data-sp-set="${set}"] input`, planPanel)?.focus();
  });

  const showConfirm = (show) => {
    confirmEl.hidden = !show;
    sendBtn.hidden = show;
    (show ? $('[data-sp-done]', confirmEl) : sendBtn).focus();
  };

  const flash = (btn, text) => {
    const original = btn.dataset.label ?? btn.textContent;
    btn.dataset.label = original;
    btn.textContent = text;
    window.setTimeout(() => { btn.textContent = original; }, 1600);
  };

  const copyCaption = async (btn) => {
    try {
      await navigator.clipboard.writeText(caption());
      flash(btn, 'Copied!');
      return true;
    } catch {
      flash(btn, 'Copy failed');
      return false;
    }
  };

  sendBtn.addEventListener('click', async () => {
    if (!caption()) return;
    if (!canShare) {
      if (await copyCaption(sendBtn)) showConfirm(true);
      return;
    }
    try {
      await navigator.share({ text: caption() });
      showConfirm(true);
    } catch {
      // cancelled share sheet (or share failed) — nothing changes
    }
  });

  whatsappBtn.addEventListener('click', () => {
    if (!caption()) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(caption())}`, '_blank', 'noopener');
    showConfirm(true);
  });

  copyBtn.addEventListener('click', async () => {
    if (caption() && await copyCaption(copyBtn)) showConfirm(true);
  });

  $('[data-sp-notyet]', planPanel).addEventListener('click', () => showConfirm(false));

  $('[data-sp-done]', confirmEl).addEventListener('click', () => {
    const r = picked();
    if (!r) return;
    const name = nameInput.value.trim();
    markDone(3, { plan: { slug: r.value, name: name || null, sentAt: new Date().toISOString() } });
    confirmEl.hidden = true;
    sendBtn.hidden = false;
  });

  // Restore a previously chosen plan (e.g. after Undo of task 3 on reload).
  if (s.plan) {
    const r = radios.find((x) => x.value === s.plan.slug);
    if (r) {
      r.checked = true;
      showSet(r.closest('[data-sp-set]').dataset.spSet);
    }
    nameInput.value = s.plan.name ?? '';
  }
  updateCaption();

  // ---------- celebration + signup ask ----------

  const stamp = $('[data-sp-stamp]');

  const planTitle = () => radios.find((r) => r.value === s.plan?.slug)?.dataset.title ?? 'your plan';
  const planName = () => s.plan?.name ?? '';

  const complete = () => {
    s = saveStarter({ completedAt: new Date().toISOString() });
    active = null;
    stamp.classList.toggle('is-landing', !reduceMotion());
    render();
    card.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    $('[data-sp-celebrate-title]').focus({ preventScroll: true });
    announce('Starter pack done. 3 of 3.');
  };

  const renderComplete = () => {
    const name = planName();
    const title = planTitle();

    const receipts = [1, 2].map((slot) => taskFor(slot).receipt);
    receipts.push(`Sent "${title}" to ${name || 'someone'}`);
    $('[data-sp-receipts]').replaceChildren(...receipts.map((text) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="sp-badge">Done</span><span></span>';
      li.lastElementChild.textContent = text;
      return li;
    }));

    const parts = [taskFor(1).outcome, taskFor(2).outcome,
      name ? `${name} has a plan on the table` : "there's a plan on the table"];
    const line = `${parts[0]}, ${parts[1]}, and ${parts[2]}.`;
    $('[data-sp-outcome]').textContent = line.charAt(0).toUpperCase() + line.slice(1);

    $('[data-sp-rung-a]').textContent = name ? 'Do it' : 'Do the';
    $('[data-sp-rung-b]').textContent = name ? `with ${name}` : 'plan';
    $('[data-sp-signup-title]').textContent = name
      ? `Keep these, and your plan with ${name}.`
      : 'Keep these, and your plan.';
    $('[data-sp-signup-body]').textContent =
      `Right now they're only saved on this phone. A free account keeps them, and lets you tick off "${title}" once you've done it.`;
  };

  // Sign-in reuses the site's existing flow (Google popup, or email +
  // password with a create-account mode) — see lib/auth-actions.js.
  const googleBtn = $('[data-sp-google]');
  const emailToggle = $('[data-sp-email-toggle]');
  const emailForm = $('[data-sp-email-form]');
  const emailInput = $('#sp-email');
  const passwordInput = $('#sp-password');
  const emailSubmit = $('[data-sp-email-submit]');
  const modeBtn = $('[data-sp-email-mode]');
  const errorEl = $('[data-sp-error]');
  let mode = 'signup';

  const showError = (msg) => { errorEl.textContent = msg; errorEl.hidden = !msg; };

  googleBtn.addEventListener('click', async () => {
    showError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      console.error('Google sign-in failed', err);
      showError('Google sign-in failed — try again.');
    }
  });

  emailToggle.addEventListener('click', () => {
    emailForm.hidden = false;
    emailToggle.hidden = true;
    emailToggle.setAttribute('aria-expanded', 'true');
    googleBtn.classList.add('sp-btn--outline');
    emailInput.focus();
  });

  modeBtn.addEventListener('click', () => {
    mode = mode === 'signup' ? 'signin' : 'signup';
    emailSubmit.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    modeBtn.textContent = mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account';
    passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    showError('');
  });

  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      showError('Add your email and a password.');
      return;
    }
    emailSubmit.disabled = true;
    try {
      await signInWithEmail(mode, email, password);
      emailForm.reset();
    } catch (err) {
      console.error('Email auth failed', err);
      showError(emailAuthErrorMessage(err.code));
    } finally {
      emailSubmit.disabled = false;
    }
  });

  onAuthStateChanged(auth, (user) => {
    $('[data-sp-signup]').hidden = Boolean(user);
    $('[data-sp-signedin]').hidden = !user;
    $('[data-sp-signin-wrap]').hidden = Boolean(user);
  });

  // ---------- controller ----------

  return {
    show(mode, { returning = false } = {}) {
      s = loadStarter();
      resumeGate = mode === 'resume';
      root.classList.toggle('is-signup-only', mode === 'signup');
      root.classList.toggle('is-returning', returning || mode !== 'intro');
      active = s.started && !s.completedAt ? nextSlot() : null;
      render();
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
    // The celebration or signup ask is on screen — a sign-in from it should
    // leave it there (showing "You're signed in.") rather than re-route.
    isShowingComplete() {
      return !root.hidden && Boolean(s.completedAt);
    },
    focus() {
      const target = s.completedAt ? $('[data-sp-signup-title]') : $('#sp-title');
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    },
  };
}
