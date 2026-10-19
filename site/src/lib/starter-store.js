// Device-only state for the starter pack: one JSON blob in localStorage
// under "cg.starter". Every storage access is wrapped — if storage throws
// (private mode, blocked site data) the pack still works for the current
// page from an in-memory copy, it just starts fresh on the next visit.

const KEY = 'cg.starter';
const VISIT_KEY = 'cg.starter.visit';

const defaults = () => ({
  v: 1,
  started: false,
  slots: { 1: 'emergency-info', 2: 'first-aid-app', 3: 'send-a-plan' },
  done: [],
  skipped: [],
  completedAt: null,
  dismissed: false,
  seenVisits: 0,
  bannerViews: 0,
  bannerDismissed: false,
  gridStripDismissed: false,
  plan: null,
  planSnoozeUntil: null,
});

let memory = null;

const readStorage = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const loadStarter = () => {
  if (!memory) {
    const stored = readStorage();
    memory = stored && stored.v === 1
      ? { ...defaults(), ...stored, slots: { ...defaults().slots, ...stored.slots } }
      : defaults();
  }
  return memory;
};

export const saveStarter = (patch) => {
  memory = { ...loadStarter(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // storage unavailable — keep the in-memory copy for this page
  }
  return memory;
};

// A "visit" is one browser session (sessionStorage), so reloads within it
// aren't re-counted. getVisit().isNew is true on the first page load of a
// session; the other fields are per-visit flags set with setVisit (e.g.
// whether this visit already counted a banner view). Without
// sessionStorage, every load is a new visit.
let visit = null;

export const getVisit = () => {
  if (!visit) {
    let stored = null;
    try {
      const raw = sessionStorage.getItem(VISIT_KEY);
      if (raw !== null) stored = JSON.parse(raw);
    } catch {
      // unavailable or unreadable — treat as a new visit
    }
    visit = { ...(stored && typeof stored === 'object' ? stored : {}), isNew: stored === null };
  }
  return visit;
};

export const setVisit = (patch = {}) => {
  visit = { ...getVisit(), ...patch };
  const { isNew, ...flags } = visit;
  try {
    sessionStorage.setItem(VISIT_KEY, JSON.stringify(flags));
  } catch {
    // storage unavailable — flags last for this page only
  }
  return visit;
};

// Dev helper: on localhost only, ?reset-starter wipes the pack state (and
// this session's visit flag), then drops the param from the address bar.
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const params = new URLSearchParams(location.search);
if (isLocal && params.has('reset-starter')) {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(VISIT_KEY); } catch { /* ignore */ }
  memory = null;
  visit = null;
  params.delete('reset-starter');
  const qs = params.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}
