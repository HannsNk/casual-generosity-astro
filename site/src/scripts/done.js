import {
  auth, db, markActivityDone, undoActivityDone, patchDoneDetails, doneDetailsRef,
} from '../lib/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, getDocs, getDoc,
} from 'firebase/firestore';
import { clearFavoriteLocal, isFavoritedLocal, onFavoritesChange } from '../lib/favorites.js';
import { onStatsChange, bumpStat, loadStats } from '../lib/stats.js';

let uid = null;
// slug -> Date the signed-in user marked it done (present only while active).
const doneDates = new Map();
const pending = new Set();

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const applyDoneState = (btn, active, date) => {
  btn.classList.toggle('is-done', active);
  btn.setAttribute('aria-pressed', String(active));
  const label = btn.querySelector('.done-label');
  if (label) label.textContent = active && date ? `Done — ${dateFmt.format(date)}` : 'Mark as done';
};

// Save and Done are mutually exclusive, so every [data-fav] button also
// de-emphasises itself (.fav-muted) whenever its slug is currently done —
// it's still clickable (clicking it clears Done), just visually quieter.
const refreshButtons = () => {
  document.querySelectorAll('[data-done]').forEach((btn) => {
    const slug = btn.dataset.slug ?? '';
    applyDoneState(btn, doneDates.has(slug), doneDates.get(slug));
  });
  document.querySelectorAll('[data-fav]').forEach((btn) => {
    btn.classList.toggle('fav-muted', doneDates.has(btn.dataset.slug ?? ''));
  });
};

onAuthStateChanged(auth, async (user) => {
  doneDates.clear();
  uid = user ? user.uid : null;

  if (uid) {
    try {
      const q = query(
        collection(db, 'activityInteractions'),
        where('uid', '==', uid),
        where('state', '==', 'done'),
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data();
        doneDates.set(data.activitySlug, data.doneAt?.toDate ? data.doneAt.toDate() : new Date());
      });
    } catch (err) {
      console.error('Failed to load done activities', err);
    }
  }

  refreshButtons();
  applyDetailStats(latestStats);
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
      const snap = await getDoc(doneDetailsRef(uid, slug));
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
      await patchDoneDetails(uid, currentSlug, {
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

// ---------- save/done counts (activity cards + detail tally) ----------

// Card-scale fav/done buttons carry their own live count (icon + number).
// Pre-launch, a count of zero is hidden entirely (icon only) rather than
// shown as "0" — the aria-label still states it for screen readers. The
// detail page's fav/done buttons have no count span, so they're skipped here.
const applyCardStats = (stats) => {
  document.querySelectorAll('[data-fav]').forEach((btn) => {
    const countEl = btn.querySelector('[data-stat-saves]');
    if (!countEl) return;
    const slug = btn.dataset.slug ?? '';
    const { saveCount } = stats.get(slug) ?? { saveCount: 0 };
    countEl.textContent = String(saveCount);
    countEl.hidden = saveCount === 0;
    btn.setAttribute('aria-label', `${btn.classList.contains('is-fav') ? 'Saved' : 'Save'} — ${saveCount} saved`);
  });
  document.querySelectorAll('[data-done]').forEach((btn) => {
    const countEl = btn.querySelector('[data-stat-done]');
    if (!countEl) return;
    const slug = btn.dataset.slug ?? '';
    const { doneCount } = stats.get(slug) ?? { doneCount: 0 };
    countEl.textContent = String(doneCount);
    countEl.hidden = doneCount === 0;
    btn.setAttribute('aria-label', `${btn.classList.contains('is-done') ? 'Done' : 'Mark as done'} — ${doneCount} done`);
  });
};

const tallySavesEl = document.getElementById('tally-saves');
const tallyDoneEl = document.getElementById('tally-done');
const tallyDividerEl = document.querySelector('.tally-divider');

// The detail-page tally: whichever count includes the signed-in user is
// inked (figure in the tier colour, label spelling out "incl. you"); the
// other stays neutral grey. Pre-launch, a count of zero hides its whole
// tally item rather than showing "0 saved"/"0 done"; the divider between
// them only makes sense with both sides visible.
const applyDetailStats = (stats) => {
  if (tallySavesEl) {
    const slug = tallySavesEl.dataset.slug ?? '';
    const { saveCount } = stats.get(slug) ?? { saveCount: 0 };
    const isYours = isFavoritedLocal(slug);
    tallySavesEl.querySelector('.tally-figure').textContent = String(saveCount);
    tallySavesEl.querySelector('.tally-label').textContent = isYours ? 'saved, incl. you' : 'saved';
    tallySavesEl.classList.toggle('is-yours', isYours);
    tallySavesEl.hidden = saveCount === 0;
  }
  if (tallyDoneEl) {
    const slug = tallyDoneEl.dataset.slug ?? '';
    const { doneCount } = stats.get(slug) ?? { doneCount: 0 };
    const isYours = doneDates.has(slug);
    tallyDoneEl.querySelector('.tally-figure').textContent = String(doneCount);
    tallyDoneEl.querySelector('.tally-label').textContent = isYours ? 'done, incl. you' : 'done';
    tallyDoneEl.classList.toggle('is-yours', isYours);
    tallyDoneEl.hidden = doneCount === 0;
  }
  if (tallyDividerEl) {
    tallyDividerEl.hidden = Boolean(tallySavesEl?.hidden) || Boolean(tallyDoneEl?.hidden);
  }
};

// Live save/done counts are only fetched on the activity detail page (where
// tally-saves/tally-done exist) — 2 aggregation queries per page load there.
// Grid pages render dozens to hundreds of cards at once, so firing count()
// queries per card there previously meant hundreds of simultaneous Firestore
// requests; cards just show the icon with no count instead.
const isDetailPage = Boolean(document.getElementById('tally-saves') || document.getElementById('tally-done'));
if (isDetailPage) {
  const pageSlugs = [...document.querySelectorAll('[data-fav]')].map((btn) => btn.dataset.slug ?? '').filter(Boolean);
  if (pageSlugs.length) loadStats(pageSlugs);
}

let latestStats = new Map();
onStatsChange((stats) => {
  latestStats = stats;
  applyCardStats(stats);
  applyDetailStats(stats);
});

// Favorites load asynchronously on their own after sign-in (no count
// changes, so no onStatsChange fires) — re-run the tally so "incl. you"
// catches up once favorites are known.
onFavoritesChange(() => applyDetailStats(latestStats));

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

  const wasDone = doneDates.has(slug);
  try {
    if (wasDone) {
      await undoActivityDone(uid, slug);
      doneDates.delete(slug);
      refreshButtons();
      bumpStat(slug, 'doneCount', -1);
      closeWindowIfSlug(slug);
    } else {
      const wasFav = isFavoritedLocal(slug);
      await markActivityDone(uid, slug);
      doneDates.set(slug, new Date());
      refreshButtons();
      bumpStat(slug, 'doneCount', 1);
      if (wasFav) {
        clearFavoriteLocal(slug);
        bumpStat(slug, 'saveCount', -1);
      }
      openCapture(slug, btn.dataset.title ?? '', btn.dataset.url ?? '');
    }
  } catch (err) {
    console.error('Failed to update done state', err);
  } finally {
    pending.delete(slug);
    btn.disabled = false;
  }
});
