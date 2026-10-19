// Activity of the Week (components/ActivityOfTheWeek.astro).
//
// This week's pick: the first activity (by slug) whose Featured Week
// matches the current ISO week; failing that, a deterministic fallback —
// activities with images sorted by slug, index = ISO week number mod count
// — so the module is never empty. Surprise Me swaps in a random other one.

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// ISO-8601 week (Monday start; week 1 holds the year's first Thursday).
export const isoWeek = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
};

// Featured Week values accepted: "2026-W42", "2026-42", "W42", "42", or
// several separated by commas. A bare week number matches every year.
const parseWeeks = (value) => String(value ?? '')
  .split(/[,;\s]+/)
  .map((token) => token.match(/^(?:(\d{4})-?)?W?(\d{1,2})$/i))
  .filter(Boolean)
  .map((m) => ({ year: m[1] ? Number(m[1]) : null, week: Number(m[2]) }));

const matchesWeek = (value, { year, week }) =>
  parseWeeks(value).some((w) => w.week === week && (w.year === null || w.year === year));

// Dev helper: on localhost, ?aotw-week=2026-W10 pretends it's that week.
const currentWeek = () => {
  const override = isLocal && new URLSearchParams(location.search).get('aotw-week');
  const parsed = override && parseWeeks(override)[0];
  return parsed ? { year: parsed.year ?? isoWeek().year, week: parsed.week } : isoWeek();
};

export function initActivityOfTheWeek(root) {
  const $ = (sel) => root.querySelector(sel);
  const data = JSON.parse($('[data-aotw-data]').textContent);
  const bySlug = new Map(data.activities.map((a) => [a.slug, a]));
  const pool = data.pool.map((slug) => bySlug.get(slug)).filter(Boolean);

  const weekPick = () => {
    const now = currentWeek();
    const featured = data.activities
      .filter((a) => matchesWeek(a.featuredWeek, now))
      .sort((a, b) => a.slug.localeCompare(b.slug))[0];
    return featured ?? pool[now.week % pool.length];
  };

  const h1 = $('[data-aotw-h1]');
  const label = $('[data-aotw-label]');
  const tier = $('[data-aotw-tier]');
  const media = $('[data-aotw-media]');
  const img = $('[data-aotw-img]');
  const live = $('[data-aotw-live]');
  let current = null;

  const fill = (a, labelText) => {
    current = a;
    root.classList.remove('t-Spontaneous', 't-Planned', 't-Committed');
    root.classList.add(`t-${a.tier}`);
    label.textContent = labelText;
    tier.textContent = a.tier;
    $('[data-aotw-cost]').textContent = a.cost;
    $('[data-aotw-time]').textContent = a.time;
    $('[data-aotw-group]').textContent = a.group;
    $('[data-aotw-title]').textContent = a.title;
    $('[data-aotw-hook]').textContent = a.hook;
    $('[data-aotw-view]').href = a.url;
    media.href = a.url;
    if (a.img) {
      img.src = a.img;
      img.srcset = `${a.img} 640w, ${a.img2x} 1200w`;
    } else {
      img.removeAttribute('src');
      img.removeAttribute('srcset');
    }
  };

  $('[data-aotw-surprise]').addEventListener('click', () => {
    const others = pool.filter((a) => a !== current);
    if (!others.length) return;
    const next = others[Math.floor(Math.random() * others.length)];
    fill(next, 'Surprise pick');
    live.textContent = `Surprise pick: ${next.title}`;
  });

  return {
    show({ welcome = false } = {}) {
      fill(weekPick(), "This week's pick");
      h1.textContent = welcome ? 'Welcome back.' : 'Activity of the week';
      h1.classList.toggle('is-sr', !welcome);
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
    activity: (slug) => bySlug.get(slug) ?? null,
  };
}
