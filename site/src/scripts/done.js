import {
  auth, db, markActivityDone, undoActivityDone, patchDoneRecord, doneRecordRef, activityStatsRef,
} from '../lib/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, getDocs, getDoc,
} from 'firebase/firestore';
import { clearFavoriteLocal } from '../lib/favorites.js';

let uid = null;
const doneSlugs = new Set();
const pending = new Set();

const applyDoneState = (btn, active) => {
  btn.classList.toggle('is-done', active);
  btn.setAttribute('aria-pressed', String(active));
  const label = btn.querySelector('.done-label');
  if (label) label.textContent = active ? 'Done' : 'Mark done';
};

const refreshButtons = () => {
  document.querySelectorAll('[data-done]').forEach((btn) => {
    applyDoneState(btn, doneSlugs.has(btn.dataset.slug ?? ''));
  });
};

onAuthStateChanged(auth, async (user) => {
  doneSlugs.clear();
  uid = user ? user.uid : null;

  if (uid) {
    try {
      const q = query(
        collection(db, 'doneRecords'),
        where('uid', '==', uid),
        where('active', '==', true),
      );
      const snap = await getDocs(q);
      snap.forEach((d) => doneSlugs.add(d.data().activitySlug));
    } catch (err) {
      console.error('Failed to load done activities', err);
    }
  }

  refreshButtons();
});

// ---------- quick-capture + share window ----------

const win = document.getElementById('donewin');
const closeTriggers = [...document.querySelectorAll('[data-donewin-close]')];
const captureStep = document.getElementById('donewin-capture');
const shareStep = document.getElementById('donewin-share');

const highlightInput = document.getElementById('donewin-highlight');
const withWhoChips = [...document.querySelectorAll('#donewin-withwho .chip')];
const reactionChips = [...document.querySelectorAll('#donewin-reaction .chip')];
const skipBtn = document.getElementById('donewin-skip');
const continueBtn = document.getElementById('donewin-continue');

const captionInput = document.getElementById('donewin-caption');
const nativeBtn = document.getElementById('donewin-native');
const whatsappBtn = document.getElementById('donewin-whatsapp');
const xBtn = document.getElementById('donewin-x');
const copyCaptionBtn = document.getElementById('donewin-copycaption');
const copyLinkBtn = document.getElementById('donewin-copylink');

const selection = { withWho: null, reaction: null };
let currentSlug = null;
let currentTitle = '';
let currentUrl = '';

const wireChipGroup = (chips, key) => {
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.value ?? '';
      selection[key] = selection[key] === value ? null : value;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === selection[key])));
    });
  });
};
wireChipGroup(withWhoChips, 'withWho');
wireChipGroup(reactionChips, 'reaction');

const syncChipSelection = (chips, value) => {
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === value)));
};

const closeWindow = () => {
  win.hidden = true;
  currentSlug = null;
};

const closeWindowIfSlug = (slug) => {
  if (!win.hidden && currentSlug === slug) closeWindow();
};

closeTriggers.forEach((el) => el.addEventListener('click', closeWindow));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !win.hidden) closeWindow();
});

const openCapture = async (slug, title, url) => {
  currentSlug = slug;
  currentTitle = title;
  currentUrl = new URL(url, location.href).href;

  highlightInput.value = '';
  selection.withWho = null;
  selection.reaction = null;

  if (uid) {
    try {
      const snap = await getDoc(doneRecordRef(uid, slug));
      if (snap.exists()) {
        const data = snap.data();
        if (data.highlight) highlightInput.value = data.highlight;
        if (data.withWho) selection.withWho = data.withWho;
        if (data.reaction) selection.reaction = data.reaction;
      }
    } catch (err) {
      console.error('Failed to load done record', err);
    }
  }

  syncChipSelection(withWhoChips, selection.withWho);
  syncChipSelection(reactionChips, selection.reaction);

  captureStep.hidden = false;
  shareStep.hidden = true;
  win.hidden = false;
};

const buildCaption = (title, url, highlight, withWho) => {
  let text = `Just tried "${title}"`;
  if (withWho) text += ` with ${withWho}`;
  if (highlight) text += ` — ${highlight}`;
  text += `. #CasuallyGenerous ${url}`;
  return text;
};

const proceedToShare = async () => {
  const highlight = highlightInput.value.trim().slice(0, 140);

  if (uid && currentSlug) {
    try {
      await patchDoneRecord(uid, currentSlug, {
        highlight: highlight || null,
        withWho: selection.withWho,
        reaction: selection.reaction,
      });
    } catch (err) {
      console.error('Failed to save done details', err);
    }
  }

  captionInput.value = buildCaption(currentTitle, currentUrl, highlight, selection.withWho);
  captureStep.hidden = true;
  shareStep.hidden = false;
};

skipBtn.addEventListener('click', proceedToShare);
continueBtn.addEventListener('click', proceedToShare);

nativeBtn.hidden = !navigator.share;
nativeBtn.addEventListener('click', async () => {
  try {
    await navigator.share({ title: currentTitle, text: captionInput.value });
  } catch {
    // user backed out of the share sheet — nothing to do
  }
});

whatsappBtn.addEventListener('click', () => {
  window.open(`https://wa.me/?text=${encodeURIComponent(captionInput.value)}`, '_blank', 'noopener');
});

xBtn.addEventListener('click', () => {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(captionInput.value)}`, '_blank', 'noopener');
});

const flash = (btn, message) => {
  const prev = btn.dataset.feedback;
  btn.dataset.feedback = message;
  btn.classList.add('flashed');
  window.setTimeout(() => {
    btn.classList.remove('flashed');
    if (prev) btn.dataset.feedback = prev;
  }, 1600);
};

copyCaptionBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(captionInput.value);
    flash(copyCaptionBtn, 'Copied!');
  } catch {
    flash(copyCaptionBtn, 'Copy failed');
  }
});

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentUrl);
    flash(copyLinkBtn, 'Copied!');
  } catch {
    flash(copyLinkBtn, 'Copy failed');
  }
});

// ---------- done count display (activity detail page) ----------

const countEl = document.getElementById('done-count');

const loadCount = async () => {
  if (!countEl) return;
  const slug = countEl.dataset.slug ?? '';
  try {
    const snap = await getDoc(activityStatsRef(slug));
    countEl.textContent = String(snap.exists() ? (snap.data().doneCount ?? 0) : 0);
  } catch (err) {
    console.error('Failed to load done count', err);
  }
};
loadCount();

const bumpCount = (slug, delta) => {
  if (!countEl || countEl.dataset.slug !== slug) return;
  countEl.textContent = String(Number(countEl.textContent || '0') + delta);
};

// ---------- done button clicks ----------

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-done]');
  if (!btn) return;

  const slug = btn.dataset.slug ?? '';
  if (!slug) return;

  if (!uid) {
    document.getElementById('auth-signin')?.click();
    return;
  }

  if (pending.has(slug)) return;
  pending.add(slug);
  btn.disabled = true;

  const wasDone = doneSlugs.has(slug);
  try {
    if (wasDone) {
      await undoActivityDone(uid, slug);
      doneSlugs.delete(slug);
      refreshButtons();
      bumpCount(slug, -1);
      closeWindowIfSlug(slug);
    } else {
      await markActivityDone(uid, slug);
      doneSlugs.add(slug);
      refreshButtons();
      bumpCount(slug, 1);
      clearFavoriteLocal(slug);
      openCapture(slug, btn.dataset.title ?? '', btn.dataset.url ?? '');
    }
  } catch (err) {
    console.error('Failed to update done state', err);
  } finally {
    pending.delete(slug);
    btn.disabled = false;
  }
});
