# Build Brief — Starter Pack, Visitor Routing, Activity of the Week (v1)

Source of truth for this build. Where the Claude Design file and this brief
disagree on **visuals**, follow the design file. Where they disagree on
**behaviour, logic or copy rules**, follow this brief.

Goal of v1: see the full flow working on localhost. Front-end and device
storage only. No Firestore schema or rules changes in this build.

---

## 1. Scope

**Build**
1. Starter pack on the landing page, from `Starter Pack Frames v2.dc.html`
   (get-started screen → 3 tasks → celebration → signup ask)
2. Visitor routing: the landing hero changes by visitor state (section 4)
3. Activity of the Week module, with Surprise Me as its secondary action
4. Small additions on other pages (section 5)
5. Remove the existing 3-slide onboarding carousel completely (code, styles,
   any "seen onboarding" flag) — the starter pack replaces it

**Not in v1** (do not build)
- Merging pack progress into Firestore on signup, `signupSource`, rules changes
- Add-to-calendar, email, push, "pick one back"
- Personalisation of any kind (the who-with question was removed)
- Saved-but-not-done items in the member hero
- Any modal, pop-up or on-load prompt

---

## 2. Decisions locked for v1 (simplest option chosen)

| Topic | v1 decision |
|---|---|
| Task content | Hardcoded in `src/data/starter-pack.json` (not Airtable) |
| Task 3 suggestions | 6 activities from `activities.json`: Spontaneous or Planned, with images, picked by a hardcoded slug list in the same JSON. Show 3, "Show me three different ones" shows the other 3 |
| Progress | 3 segments, one per task. No head start |
| Advance after Done | Auto-advance after ~800 ms + in-card undo bar for ~5 s |
| Celebration stamp | Tri-colour misregistration settling into ink; static with `prefers-reduced-motion` |
| "Second look" state (L2) | Dropped. One ignored visit → Browser state |
| Friend's name | Device only (localStorage) |
| Re-engagement | None in v1 |
| Signup | Reuse the existing Firebase Auth flow (Google + email magic link) as-is |
| Activity of the Week fallback | If no activity has the current ISO week in `Featured Week`, pick deterministically: activities with images sorted by slug, index = ISO week number mod count. The module must never be empty |
| Grid strip for first-timers | Yes |
| Share-link marker | Append `?via=plan` to the activity URL in the Task 3 caption |

---

## 3. Starter pack content

### Task slots (default → swap options)

**Slot 1 — Set Up Your Phone's Emergency Info** · 2 min · Preparedness
- Why: If you're ever hurt and can't speak, a paramedic or passer-by can see who to call and anything they need to know, without unlocking your phone.
- iPhone: Open Health, tap your photo, tap Medical ID, tap Edit, add an emergency contact, turn on Show When Locked.
- Android: Open Settings, find Safety & emergency, add medical information and an emergency contact. (Menu names vary by phone maker.)
- Button: `Done` · sub-line: *Already set up? That counts.*
- Feedback: *Nice. That's the kind of thing nobody thinks about until it matters.*

**Slot 2 — Download A First Aid App** · 3 min · Preparedness
- Why: If someone near you collapses, is badly cut or starts choking, step-by-step instructions on your phone can help you act instead of freeze. The Red Cross app works offline, so it's there even with no signal.
- How: 1) Open your app store and search "Red Cross First Aid". 2) Pick the version from your country's Red Cross or Red Crescent — most countries have their own, and it's free. 3) Open it once and skim one guide.
- Button: `Done — it's on my phone` · sub-line: *Already have one? That counts.*
- Feedback: *Next time someone near you needs help, the steps are in your pocket.*

**Swap options (available in slots 1 and 2)**
- *Send A Specific Thank-You To Someone* · 3 min · Gratitude — Why: People tend to underestimate how much a specific thank-you means to the person getting it. How: 1) Think of one person who did something for you this year. 2) Message them: what they did, and what difference it made. 3) Be specific. Collapsed helper: *"Random, but I've been meaning to say thanks for ___. It honestly made ___ easier."* Button: `Done — sent it`. Feedback: *Someone's going to read that and have a better day.*
- *Leave A Real Review For A Small Local Business* · 3 min · Local Business — Why: For a small business, one specific review from a real customer can matter more than any ad. How: 1) Think of a small local place you like. 2) Leave a review on whichever map or review app you use. 3) Mention one specific thing you liked. Button: `Done — posted it`. Feedback: *That'll help someone find them.*

**Slot 3 — Pick An Activity And Send It To One Person** · 2 min
- Why: A plan sent to one person is far more likely to happen than "we should do something" in a group chat.
- 3a pick one of 3 suggested activities · 3b *Who's it for?* (optional first name) · 3c send.
- Caption: `Hey {Name}, I picked this for us: "{Title}". Up for it? {URL}?via=plan` — no name → `Hey, I picked this for us: ...`
- Send: native share sheet where available (primary); `WhatsApp` (`https://wa.me/?text=`) and `Copy message` as fallbacks.
- After any send action → `Done — I sent it` (filled) + *Not yet* (text link). A cancelled native share changes nothing.
- On Done: save `{slug, name, sentAt}` as the plan (device only).

### Flow rules
- Swap and skip are text links on every task. A skipped slot stays empty; after slot 3, re-open the skipped task with *Want to finish this one? Or leave it for later.*
- Celebration and signup ask only play when all 3 slots are done.
- Celebration receipts use what they did (swapped task names, activity title, friend's name).
- Signup ask copy: heading *Keep these, and your plan with {Name}.* · body *Right now they're only saved on this phone. A free account keeps them, and lets you tick off {activity} once you've done it.* · primary `Continue with Google` · secondary `Use email instead` · reassurance *No newsletter. No spam. Just your saved stuff.* · exit *Not now — show me all the activities →*. No name → *Keep these, and your plan.*

---

## 4. Visitor routing (landing page hero)

First match wins:

| # | Condition | State | Hero |
|---|---|---|---|
| 1 | Signed in | **L6 Member** | If a plan exists on this device, not marked done, not snoozed: *Did you and {Name} do "{Title}" yet?* → `Mark it done` (existing Done logic) · *Not yet* (snooze 7 days). Otherwise Activity of the Week with *Welcome back.* No pack, no signup copy anywhere |
| 2 | Pack finished, not signed in | **L5** | Activity of the Week hero + slim banner *Your starter pack's done. Keep it?* `Save it` (opens the signup ask alone) · ✕. Banner shows on max 2 visits; ✕ hides it forever. After that: plain L3 without the strip |
| 3 | Pack started, not finished | **L4 Resume** | Resume card: *Welcome back — {n} of 3 done* · `Pick up where you left off` |
| 4 | Pack dismissed ("just browse"), or seen on 1 earlier visit without starting | **L3 Browser** | Activity of the Week hero + slim strip `STARTER PACK · 3 SMALL THINGS →` above it (tapping it restores the get-started screen) |
| 5 | None of the above | **L1 First visit** | Get-started screen from the design file, with *or just browse all activities →* and *Been here before? Sign in* |

**Auth timing:** Firebase auth resolves asynchronously. Reserve the hero's
space (fixed min-height, no layout shift) and render once auth resolves, with
a ~1.5 s timeout that falls back to the device-state route.

**Below the hero** stays the same in every state.

---

## 5. Other pages

| Where | Who | Add |
|---|---|---|
| Activity page | Signed out | End-of-page card after the instructions: *New here? Three small things to start with →* (to `/`). If pack in progress: *Your starter pack: {n} of 3 done. Finish it →* |
| Activity page | URL has `?via=plan` | One line above the title: *A friend picked this for you.* |
| Activity page | Signed in | Nothing extra |
| `/activities/` grid | States L1 or L3-from-ignore, not dismissed here | Slim dismissible strip above filters: `NEW? START WITH 3 SMALL THINGS →` |
| Notes post | Signed out | Same end-of-page card as activity pages |
| Contextual sign-in prompt (Save/Done tapped while signed out) | — | Copy: *Sign in to save this. Ten seconds with Google, no password.* With pack progress: *Sign in to save this, and keep your starter pack progress too.* |

---

## 6. Device storage

One key, JSON, every read/write wrapped in try/catch; the site must work if
storage throws or is empty.

```
localStorage["cg.starter"] = {
  v: 1,
  started: false,
  slots: { "1": "emergency-info", "2": "first-aid-app", "3": "send-a-plan" }, // after swaps
  done: [],            // slot numbers
  skipped: [],
  completedAt: null,
  dismissed: false,    // "just browse" or strip-only
  seenVisits: 0,       // visits where L1 was shown and not started
  bannerViews: 0,
  bannerDismissed: false,
  gridStripDismissed: false,
  plan: null,          // { slug, name, sentAt }
  planSnoozeUntil: null
}
```

Count a "visit" once per browser session (use a sessionStorage flag).

**Dev helper:** on localhost only, `?reset-starter` clears `cg.starter`.

---

## 7. Conventions and constraints

- Follow existing project conventions: page logic in `src/scripts/*.js`,
  imported in `.astro` files via `<script>import '../scripts/x.js';</script>`.
  No inline bare-specifier imports, no `src=""` script tags.
- Reuse the Favourites/Done patterns for auth checks and the sign-in prompt.
- Design system only: existing tokens, `--edge`, hard offset shadows, `.chip`,
  `.stamp`, Bricolage Grotesque / Newsreader / Space Mono. No new colours,
  fonts or icon sets.
- One filled button per view. The nav keeps a plain `Sign in` text link.
- Nothing on page load: no modals, interstitials or pop-ups anywhere.
- Accessibility: tap targets ≥ 44 px, focus moves to each newly expanded task
  heading, progress changes announced via `aria-live="polite"`,
  `prefers-reduced-motion` respected, DONE states carry the word, not just colour.
- No JS: the landing page renders without the pack, as it does today.
- Work on a feature branch. **Never push to `main`** (it auto-deploys).

---

## 8. Build order — stop after each phase so it can be checked on localhost

1. **Starter pack UI on the landing page** (L1 only, full flow through the
   signup ask, device storage, dev reset) + remove the old carousel
2. **Routing** L3–L6 and the Activity of the Week module with fallback and
   Surprise Me
3. **Other pages** (section 5)

---

## 9. Acceptance checks

- [ ] Fresh browser on `/`: get-started screen; browse link visible without scrolling; no account mentioned before the signup ask
- [ ] Complete all 3 tasks: progress fills, undo works, celebration plays (static with reduced motion), receipts show real choices
- [ ] Swap a task: replacement appears in the same slot and in the receipts
- [ ] Skip a task: celebration waits; skipped task re-offered after slot 3
- [ ] Task 3: caption updates live with name; native share / WhatsApp / copy all produce correctly encoded text with `?via=plan`
- [ ] Tap "just browse", reload: L3 with strip; pack never re-expands on its own
- [ ] Leave mid-pack, reload: L4 resume with correct count
- [ ] Finish without signing in: L5 banner on next 2 visits only; ✕ removes it permanently
- [ ] Sign in: L6; no pack or signup copy on any page; plan nudge shows if a plan exists
- [ ] Activity page signed out: nothing above content, end card after; `?via=plan` shows the friend line
- [ ] Grid shows the first-timer strip for new visitors; dismiss is remembered
- [ ] Old 3-slide onboarding no longer appears anywhere
- [ ] Activity of the Week renders for a week with no `Featured Week` match
- [ ] `localStorage` blocked: site works, pack starts fresh each visit, no errors
