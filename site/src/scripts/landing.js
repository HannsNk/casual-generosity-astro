// Landing-page hero routing (docs/starter-pack-build-brief.md §4). First
// match wins:
//   L6 member      signed in → plan nudge, else Activity of the Week + "Welcome back."
//   L5 finished    pack done, signed out → AotW + "Keep it?" banner (2 visits max)
//   L4 resume      pack started, not finished → "Welcome back — n of 3 done"
//   L3 browser     dismissed, or L1 already seen on an earlier visit → AotW + strip
//   L1 first visit → get-started screen
// Auth resolves asynchronously, so the hero slot keeps its space reserved
// (.is-routing) until auth answers or a 1.5s timeout falls back to the
// device-state route. Everything below the hero is the same in every state.

import { auth, activityInteractionRef } from '../lib/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { loadStarter, saveStarter, getVisit, setVisit } from '../lib/starter-store.js';
import { initStarterPack } from './starter-pack.js';
import { initActivityOfTheWeek } from './activity-of-the-week.js';

const AUTH_TIMEOUT_MS = 1500;
const SNOOZE_DAYS = 7;
const MAX_BANNER_VISITS = 2;

const hero = document.querySelector('[data-hero]');
if (hero) init(hero);

function init(hero) {
  const pack = initStarterPack(hero.querySelector('[data-starter]'));
  const aotw = initActivityOfTheWeek(hero.querySelector('[data-aotw]'));
  const strip = hero.querySelector('[data-sn-strip]');
  const banner = hero.querySelector('[data-sn-banner]');
  const nudge = hero.querySelector('[data-pn]');
  const nudgeDone = nudge.querySelector('[data-pn-done]');

  const hideAll = () => {
    pack.hide();
    aotw.hide();
    strip.hidden = true;
    banner.hidden = true;
    nudge.hidden = true;
  };

  const settle = () => {
    hero.classList.remove('is-routing');
    setVisit(); // marks this session as a visit already under way
  };

  // ---------- signed out: device state ----------

  const routeDevice = () => {
    let s = loadStarter();
    const visit = getVisit();
    hideAll();

    // All three done but the tab closed before the celebration landed.
    if (s.done.length === 3 && !s.completedAt) s = saveStarter({ completedAt: new Date().toISOString() });

    if (s.completedAt) {
      // L5. A banner view is counted once per visit, on the visit's first load.
      if (visit.isNew && !visit.bannerCounted && !s.bannerDismissed && s.bannerViews < MAX_BANNER_VISITS) {
        s = saveStarter({ bannerViews: s.bannerViews + 1 });
        setVisit({ bannerCounted: true });
      }
      banner.hidden = !(getVisit().bannerCounted && !s.bannerDismissed);
      aotw.show();
      return 'L5';
    }

    if (s.started) {
      pack.show('resume');
      return 'L4';
    }

    // L1 seen on an earlier visit (not this one) without starting → L3.
    const earlierSeen = s.seenVisits - (visit.l1Counted ? 1 : 0);
    if (s.dismissed || earlierSeen >= 1) {
      strip.hidden = false;
      aotw.show();
      return 'L3';
    }

    if (!visit.l1Counted) {
      saveStarter({ seenVisits: s.seenVisits + 1 });
      setVisit({ l1Counted: true });
    }
    pack.show('intro');
    return 'L1';
  };

  // ---------- signed in: member ----------

  const withTimeout = (promise, ms, fallback) =>
    Promise.race([promise, new Promise((resolve) => window.setTimeout(() => resolve(fallback), ms))]);

  const planIsDone = async (uid, slug) => {
    try {
      const snap = await getDoc(activityInteractionRef(uid, slug));
      return snap.exists() && snap.data().state === 'done';
    } catch {
      return false;
    }
  };

  const showWelcome = () => {
    hideAll();
    aotw.show({ welcome: true });
  };

  const showNudge = (plan, activity) => {
    hideAll();
    nudge.classList.remove('t-Spontaneous', 't-Planned', 't-Committed');
    nudge.classList.add(`t-${activity.tier}`);
    nudge.querySelector('[data-pn-title]').textContent = plan.name
      ? `Did you and ${plan.name} do "${activity.title}" yet?`
      : `Did you do "${activity.title}" yet?`;
    nudge.querySelector('[data-pn-link]').href = activity.url;
    nudge.querySelector('[data-pn-activity-title]').textContent = activity.title;
    nudge.querySelector('[data-pn-tier]').textContent = activity.tier;
    const img = nudge.querySelector('[data-pn-img]');
    if (activity.thumb) img.src = activity.thumb;
    else img.removeAttribute('src');
    nudgeDone.dataset.slug = activity.slug;
    nudgeDone.dataset.title = activity.title;
    nudgeDone.dataset.url = activity.url;
    nudge.hidden = false;
  };

  const routeMember = async (user) => {
    const s = loadStarter();
    const plan = s.plan;
    const snoozed = s.planSnoozeUntil && Date.parse(s.planSnoozeUntil) > Date.now();
    const activity = plan && aotw.activity(plan.slug);
    if (activity && !snoozed && !(await withTimeout(planIsDone(user.uid, plan.slug), AUTH_TIMEOUT_MS, false))) {
      showNudge(plan, activity);
      return 'L6 (plan nudge)';
    }
    showWelcome();
    return 'L6';
  };

  // "Mark it done": done.js runs the existing Done flow on this button and
  // flips aria-pressed once the write lands — then the nudge has done its job.
  new MutationObserver(() => {
    if (!nudge.hidden && nudgeDone.getAttribute('aria-pressed') === 'true') showWelcome();
  }).observe(nudgeDone, { attributes: true, attributeFilter: ['aria-pressed'] });

  nudge.querySelector('[data-pn-later]').addEventListener('click', () => {
    saveStarter({ planSnoozeUntil: new Date(Date.now() + SNOOZE_DAYS * 86400000).toISOString() });
    showWelcome();
  });

  // ---------- strip and banner ----------

  strip.addEventListener('click', () => {
    hideAll();
    pack.show('intro', { returning: true });
    pack.focus();
  });

  banner.querySelector('[data-sn-save]').addEventListener('click', () => {
    banner.hidden = true;
    pack.show('signup');
    pack.focus();
  });

  banner.querySelector('[data-sn-close]').addEventListener('click', () => {
    saveStarter({ bannerDismissed: true });
    banner.hidden = true;
  });

  // ---------- auth ----------

  let routed = false;
  const log = (route) => {
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) console.info(`[landing] route: ${route}`);
  };

  const fallback = window.setTimeout(() => {
    if (routed) return;
    routed = true;
    log(routeDevice());
    settle();
  }, AUTH_TIMEOUT_MS);

  onAuthStateChanged(auth, async (user) => {
    if (!routed) {
      routed = true;
      window.clearTimeout(fallback);
      log(user ? await routeMember(user) : routeDevice());
      settle();
      return;
    }
    // Later changes (sign in/out from the nav or the signup ask). A sign-in
    // from the pack's own signup ask leaves it showing "You're signed in."
    if (user) {
      if (!pack.isShowingComplete()) log(await routeMember(user));
    } else {
      log(routeDevice());
    }
  });
}
