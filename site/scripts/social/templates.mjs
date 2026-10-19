// Instagram post templates — 1080×1350 (4:5), built from the site's riso design tokens.
// Each template returns an HTML fragment; page() wraps it with fonts + tokens.

const TOKENS = `
:root{--paper:#EFEEE7;--paper-deep:#E5E3DA;--card:#FBFAF6;--ink:#17161A;--ink-soft:#55535E;--rule:#CFCCC0;
--pink:#F0355F;--blue:#2350D8;--green:#0B8F63;--edge:8px;--off:22px}
.t-Spontaneous{--tier:var(--pink)}.t-Planned{--tier:var(--blue)}.t-Committed{--tier:var(--green)}
*{margin:0;box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:News;overflow:hidden;position:relative}
.frame{position:absolute;inset:0;padding:80px 80px 70px;display:flex;flex-direction:column;overflow:hidden}
.mono{font-family:Mono;text-transform:uppercase;letter-spacing:.08em}
.disp{font-family:Bri;letter-spacing:-.025em;line-height:.98}
.stamp{display:inline-block;font-family:Mono;font-weight:700;font-size:26px;letter-spacing:.1em;text-transform:uppercase;background:var(--tier);color:var(--card);padding:10px 18px 8px}
.card{position:relative;background:var(--card);border:var(--edge) solid var(--ink);box-shadow:var(--off) var(--off) 0 var(--tier)}
.photo{position:relative;aspect-ratio:3/2;border-bottom:var(--edge) solid var(--ink);background:repeating-linear-gradient(135deg,var(--paper-deep) 0 18px,var(--paper) 18px 36px);display:grid;place-items:center;overflow:hidden}
.photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.photo span{font-family:Mono;font-size:24px;color:var(--ink-soft);letter-spacing:.1em}
.foot{margin-top:auto;padding-top:30px;display:flex;justify-content:space-between;align-items:end;font-family:Mono;font-size:24px;letter-spacing:.06em}
.foot b{font-family:Bri;font-size:32px;letter-spacing:-.01em;font-weight:normal}
.pager{font-family:Mono;font-size:24px;color:var(--ink-soft)}
.rule{height:var(--edge);background:var(--ink)}
`;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const foot = (right = 'Link in bio →') => `<div class="foot"><b>CasuallyGenerous</b><span class="mono">${esc(right)}</span></div>`;
const pager = p => (p ? `<span class="pager">${esc(p)}</span>` : '');

export const templates = {
  // Single activity card — feed workhorse and carousel slide 2
  card: d => `<div class="frame t-${d.tier}">
    ${d.page ? `<div style="text-align:right;margin:-20px 0 0">${pager(d.page)}</div>` : ''}
    <div class="card" style="margin-top:20px">
      <div class="photo"><span>ACTIVITY PHOTO · 3:2</span>${d.image ? `<img src="${esc(d.image)}" onerror="this.remove()">` : ''}</div>
      <div style="padding:44px 48px 50px">
        <span class="stamp">${d.tier}</span>
        <h1 class="disp" data-fit style="font-size:80px;margin:28px 0 22px">${esc(d.title)}</h1>
        <p data-fit style="font-size:36px;line-height:1.3;color:var(--ink-soft)">${esc(d.hook)}</p>
      </div>
    </div>${foot()}</div>`,

  // Carousel cover — big question on a tier-colour field
  hook: d => `<div class="frame t-${d.tier}" style="background:var(--tier);color:var(--card)">
    <span class="mono" style="font-size:28px">${esc(d.kicker)}</span>
    <h1 class="disp" data-fit style="font-size:132px;margin-top:auto">${esc(d.text)}</h1>
    <div class="mono" style="margin-top:60px;display:flex;justify-content:space-between;font-size:26px"><span>Swipe →</span><span>CasuallyGenerous</span></div></div>`,

  steps: d => `<div class="frame t-${d.tier}">
    <div style="display:flex;justify-content:space-between"><span class="stamp">How to</span>${pager(d.page)}</div>
    <h2 class="disp" data-fit style="font-size:72px;margin:46px 0 44px">${esc(d.title)}</h2>
    ${d.steps.map((s, i) => `<div style="display:flex;gap:34px;padding:30px 0;border-top:3px solid var(--ink)">
      <span class="disp" style="font-size:68px;color:var(--tier);min-width:56px">${i + 1}</span>
      <p data-fit style="font-size:38px;line-height:1.3">${esc(s)}</p></div>`).join('')}
    ${foot('')}</div>`,

  why: d => `<div class="frame t-${d.tier}">
    <div style="display:flex;justify-content:space-between"><span class="stamp">Why it matters</span>${pager(d.page)}</div>
    <p data-fit style="font-style:italic;font-size:60px;line-height:1.22;margin-top:auto">${esc(d.text)}</p>
    <div style="height:var(--edge);width:180px;background:var(--tier);margin:56px 0 auto"></div>
    ${foot('')}</div>`,

  cta: d => `<div class="frame t-${d.tier}">
    <div style="text-align:right">${pager(d.page)}</div>
    <div class="card" style="margin:auto 0;padding:70px 60px">
      <h2 class="disp" style="font-size:96px">Send this to the person you'd do it with.</h2>
      <p style="font-size:40px;line-height:1.3;margin-top:36px;color:var(--ink-soft)">Then pick a day. More ideas like this — mostly free, all done together — at the link in bio.</p>
    </div>${foot('casuallygenerous.com')}</div>`,

  instead: d => `<div class="frame t-${d.tier}">
    <span class="mono" style="font-size:28px;color:var(--ink-soft)">Instead of</span>
    <h2 class="disp" data-fit style="font-size:96px;margin-top:20px;color:var(--ink-soft);text-decoration:line-through;text-decoration-thickness:10px;text-decoration-color:var(--tier)">${esc(d.x)}</h2>
    <div class="rule" style="margin:70px 0"></div>
    <span class="mono" style="font-size:28px">Try</span>
    <h1 class="disp" data-fit style="font-size:104px;margin-top:20px;text-shadow:5px 5px 0 var(--tier)">${esc(d.y)}</h1>
    <p data-fit style="font-size:38px;line-height:1.3;margin-top:44px;color:var(--ink-soft)">${esc(d.note)}</p>
    ${foot()}</div>`,

  roundup: d => `<div class="frame">
    <span class="mono" style="font-size:28px;color:var(--ink-soft)">${esc(d.kicker)}</span>
    <h1 class="disp" data-fit style="font-size:92px;margin:20px 0 56px">${esc(d.title)}</h1>
    ${d.items.map(it => `<div class="card t-${it.tier}" style="padding:32px 38px;margin-bottom:46px;box-shadow:14px 14px 0 var(--tier)">
      <span class="stamp" style="font-size:22px">${it.tier}</span>
      <h3 class="disp" data-fit style="font-size:52px;margin-top:18px">${esc(it.title)}</h3></div>`).join('')}
    ${foot()}</div>`,
  // ---------- Intro carousel (pinned first post) ----------
  introCover: d => `<div class="frame t-Spontaneous" style="background:var(--tier);color:var(--card)">
    <span class="mono" style="font-size:28px">Hello — new here</span>
    <h1 class="disp" data-fit style="font-size:124px;margin-top:auto">Doing good, without giving up your Saturday.</h1>
    <p style="font-size:42px;line-height:1.3;margin-top:44px">Small, mostly free, generous things to do with people you already see.</p>
    <div class="mono" style="margin-top:60px;display:flex;justify-content:space-between;font-size:26px"><span>Swipe →</span><span>CasuallyGenerous</span></div></div>`,

  introNot: d => `<div class="frame t-Planned">
    <div style="text-align:right">${pager(d.page)}</div>
    <span class="mono" style="font-size:28px;color:var(--ink-soft)">It's not</span>
    ${['Volunteering', 'Donations'].map(w => `<h2 class="disp" style="font-size:112px;margin-top:16px;color:var(--ink-soft);text-decoration:line-through;text-decoration-thickness:12px;text-decoration-color:var(--tier)">${w}</h2>`).join('')}
    <div class="rule" style="margin:70px 0"></div>
    <span class="mono" style="font-size:28px">It's the bit in between</span>
    <p data-fit style="font-size:54px;line-height:1.3;margin-top:28px">Thoughtful things you fold into time you're already spending with friends, family or a partner. No sign-up sheet. No donate button.</p>
    ${foot('')}</div>`,

  introTiers: d => `<div class="frame">
    <div style="display:flex;justify-content:space-between;align-items:start"><span class="mono" style="font-size:28px;color:var(--ink-soft)">Every idea has a tier</span>${pager(d.page)}</div>
    <h1 class="disp" style="font-size:88px;margin:20px 0 54px">Pick by how much effort you've got.</h1>
    ${TIERS.map(([t, line]) => `<div class="card t-${t}" style="padding:30px 38px;margin-bottom:44px;box-shadow:14px 14px 0 var(--tier)">
      <span class="stamp" style="font-size:22px">${t}</span>
      <p style="font-size:38px;line-height:1.28;margin-top:16px">${line}</p></div>`).join('')}
    ${foot('')}</div>`,

  introCta: d => `<div class="frame t-Committed">
    <div style="text-align:right">${pager(d.page)}</div>
    <div class="card" style="margin:auto 0;padding:70px 60px">
      <h2 class="disp" style="font-size:104px">Pick one this week.</h2>
      <p style="font-size:40px;line-height:1.3;margin-top:36px;color:var(--ink-soft)">Browse them all at casuallygenerous.com — link in bio. Did one? Tag <b style="font-family:Mono;font-weight:700;color:var(--ink)">#CasuallyGenerous</b> and we'll share it.</p>
    </div>${foot('casuallygenerous.com')}</div>`,

  // ---------- Story frames 1080×1920 (content kept clear of the top/bottom app UI) ----------
  story: d => `<div class="frame t-${d.tier ?? 'Spontaneous'}" style="padding:300px 90px 380px">
    <div style="display:flex;justify-content:space-between"><span class="stamp">${esc(d.stamp)}</span><span class="pager">${esc(d.page ?? '')}</span></div>
    <h1 class="disp" data-fit style="font-size:140px;margin:auto 0 50px">${esc(d.title)}</h1>
    ${d.body ? `<p data-fit style="font-size:58px;line-height:1.3">${esc(d.body)}</p>` : ''}
    ${d.tiers ? TIERS.map(([t, line]) => `<div class="card t-${t}" style="padding:30px 38px;margin-top:40px;box-shadow:14px 14px 0 var(--tier)">
      <span class="stamp" style="font-size:26px">${t}</span><p style="font-size:46px;line-height:1.28;margin-top:16px">${line}</p></div>`).join('') : ''}
    ${d.cta ? `<div class="card" style="margin-top:60px;padding:40px 44px"><p class="disp" style="font-size:58px">${esc(d.cta)}</p></div>` : ''}
    <div class="foot" style="margin-top:auto;padding-top:50px"><b>CasuallyGenerous</b><span class="mono">${esc(d.footRight ?? '')}</span></div></div>`,

  // ---------- Highlight covers — Instagram crops the centre into a small circle ----------
  cover: d => `<div class="frame t-${d.tier}" style="display:grid;place-items:center">
    <div style="width:560px;height:560px;border-radius:50%;background:var(--tier);display:grid;place-items:center">
      <svg width="300" height="300" viewBox="0 0 100 100" fill="none" stroke="#FBFAF6" stroke-width="12" stroke-linecap="square" stroke-linejoin="miter">${ICONS[d.icon]}</svg>
    </div></div>`,
};

const TIERS = [
  ['Spontaneous', 'Do it today. Nothing to book, nothing to arrange.'],
  ['Planned', 'Needs a date in the diary and a bit of coordinating.'],
  ['Committed', 'Sign up, apply or train first — then it stays available to you.'],
];
const ICONS = {
  arrow: '<path d="M14 50h66M56 24l26 26-26 26"/>',
  check: '<path d="M16 52l22 22 46-48"/>',
  plus: '<path d="M50 14v72M14 50h72"/>',
};

export const SIZES = { story: [1080, 1920], cover: [1080, 1920] };
const sizeOf = kind => SIZES[kind] ?? [1080, 1350];

// Shrinks [data-fit] text until the frame stops overflowing, so long titles never get clipped.
const FIT = `<script>window.__fit=()=>{const f=document.querySelector('.frame');const els=[...document.querySelectorAll('[data-fit]')];
for(let i=0;i<30&&f.scrollHeight>f.clientHeight+1;i++)els.forEach(e=>{e.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*0.96)+'px'})}</script>`;

export function page(kind, data, fonts) {
  const ff = `@font-face{font-family:Bri;src:url(${fonts.bri})}
@font-face{font-family:News;src:url(${fonts.news})}@font-face{font-family:News;font-style:italic;src:url(${fonts.newsItalic})}
@font-face{font-family:Mono;src:url(${fonts.mono})}@font-face{font-family:Mono;font-weight:700;src:url(${fonts.monoBold})}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${ff}${TOKENS}</style></head><body style="width:${sizeOf(kind)[0]}px;height:${sizeOf(kind)[1]}px">${templates[kind](data)}${FIT}</body></html>`;
}
