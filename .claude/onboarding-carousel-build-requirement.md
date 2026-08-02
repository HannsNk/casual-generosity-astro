# Build Requirement — "How This Works" Onboarding Carousel

## Context

CasuallyGenerous is a static Astro site on GitHub Pages, with Firebase Auth
and Firestore already live for accounts, Favourites, and the Done-This
feature. This build adds a short onboarding carousel that explains the core
loop (browse → send it to someone → do it → share it, come back) the first
time someone creates an account, and remains reachable afterward from the
profile page.

Read `02-tech-stack-and-architecture.md` and `03-design-system.md` from
project knowledge before starting. Two starter files already exist and
should be dropped in as-is, then wired up per this doc:
- `src/components/OnboardingCarousel.astro`
- `src/scripts/onboarding.js`

## Goal

1. Show a 4-slide carousel once, automatically, right after a new
   `users/{uid}` document is first created.
2. Never show it again automatically after it's been dismissed/completed.
3. Make it reachable at any time afterward via a "How this works" link on
   the profile page, which reopens the exact same component.
4. Keep it fully within the existing riso design system — no new colours,
   fonts, or interaction patterns.
5. Must work well on both mobile (swipe, bottom-sheet layout) and desktop
   (centered modal, dot/button nav).

## Data model addition

### `users/{uid}` — one new field on the existing document
```
onboardingSeen: boolean   // default false on creation, set true on
                           // dismiss/skip/completion of the carousel
```

No new collection needed — this is a single flag on the document that
already gets auto-created on first sign-in.

## Firestore rules changes

None required. `users/{uid}` is already owner-write per the existing rules;
`onboardingSeen` is just another field on that same document, covered by the
existing rule.

## Firebase helper functions (add to `src/lib/firebase.js`)

Follow the existing pattern used for Favourites/Done-This helpers.

```js
// Returns true if the current user is signed in AND has not yet
// seen onboarding. False if signed out (nothing to show) or already seen.
export async function shouldShowOnboarding() {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return false;
  return snap.data().onboardingSeen !== true;
}

// Marks onboarding as seen. Called on skip, close, or completion —
// all three count as "seen," none of them should re-trigger it.
export async function markOnboardingSeen() {
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(
    doc(db, "users", user.uid),
    { onboardingSeen: true },
    { merge: true }
  );
}
```

Also update the existing first-sign-in `users/{uid}` creation logic to
initialize `onboardingSeen: false` alongside `displayName`, `photoURL`,
`bio`, `createdAt`.

## Component integration

- Drop `OnboardingCarousel.astro` into `src/components/`.
- Drop `onboarding.js` into `src/scripts/`.
- Mount `<OnboardingCarousel />` once, high in the layout, so it's
  available on any page a signed-in user might land on right after
  creating an account (simplest: `src/layouts/Base.astro`, gated so it
  only renders/initializes when a user is signed in — check however the
  existing Favourites sign-in-gated UI does this, and mirror it).
- The component checks `shouldShowOnboarding()` itself on mount via
  `onboarding.js` — no page-level logic needed beyond mounting it.

## Profile page integration

Add a plain text link/button on the profile page: **"How this works"**.
On click, it should open the same carousel component in forced-open mode
rather than duplicating markup or copy.

Simplest implementation: mount a second instance of
`<OnboardingCarousel forceOpen={true} />` that stays hidden until a custom
event or a directly-toggled `hidden` attribute is triggered by the profile
page's link — or, if the site's existing patterns favor it, give the
carousel's overlay a stable `id` and have the profile link's script just
clear the `hidden` attribute directly and reset `index` to 0 via a small
exported `openOnboarding()` function from `onboarding.js`. Prefer whichever
approach requires touching the fewest existing files; use your judgment
based on how the Favourites sign-in prompt currently triggers its own
modal, and mirror that pattern rather than introducing a new one.

Style the link plainly — small, mono-font, `--ink-soft` colour, consistent
with other secondary/utility links on the profile page (footer links, sign
out, etc.) rather than styled as a prominent button.

## Content (already finalized — do not rewrite)

**Slide 1 — Browse** (pink `t-pink`)
Eyebrow: "Browse" · Title: "Find something worth doing"
Body: "Spontaneous, Planned, or Committed — pick whatever fits your week,
your budget, and how much notice you can give. See something you like but
aren't ready for yet? Save it, and it'll be waiting for you."

**Slide 2 — Send it to someone** (blue `t-blue`)
Eyebrow: "Send it to someone" · Title: "The best plans start with one
person"
Body: "Every activity has a share button that sends a friend the idea, not
just a link. Skip the group chat — the people already in your week are the
easiest ones to actually do something with."

**Slide 3 — Do it** (green `t-green`)
Eyebrow: "Do it, then tell us how it went" · Title: "A few words go a long
way"
Body: "Mark it done when you have. If you want, add a quick note — who you
were with, how it went, any tip for the next person. Totally optional,
thirty seconds tops, and it becomes part of the activity's story for
whoever's next."

**Slide 4 — Share it, come back** (ink `t-ink`)
Eyebrow: "Share it, come back" · Title: "This is what keeps it going"
Body: "Post about it if you're up for it — someone else tries this because
you did. Then come back whenever. There's always another one worth doing."

This copy is already baked into `OnboardingCarousel.astro` — no changes
needed there unless a voice pass is explicitly requested.

## Design constraints

- Reuse `--edge` (3px border), the hard offset-shadow card device, `.chip`
  for dots/buttons — all already implemented in the starter component.
- Icons are inline SVGs styled as small "stamp" badges (solid tier-colour
  square, offset shadow, single-colour silhouette icon in `--card`/`--paper`)
  — matches the `.stamp` convention rather than introducing photo or
  gradient-icon treatments.
- Typography: Bricolage Grotesque for eyebrow/title, Newsreader for body
  text, Space Mono for eyebrow label and dot/button labels — already wired
  into the starter component's styles.
- No new colours or fonts introduced. Tier colours (pink/blue/green) are
  reused per-slide because each slide maps to an existing tier concept;
  slide 4 intentionally uses `--ink` rather than a tier colour since it's
  about the loop closing, not a tier-specific action.

## Mobile vs desktop behavior

- **Mobile (< 640px):** bottom-sheet style — overlay anchors the card to
  the bottom of the viewport, square top corners rounding only at the very
  top, swipeable via touch.
- **Desktop (≥ 640px):** centered modal with padding around it, corners
  fully rounded, swipe replaced by button/dot navigation (touch handlers
  simply won't fire on non-touch devices, no separate code path needed).
- Both breakpoints share the same component and copy — only the CSS layout
  changes, per the starter component's existing media query.

## Edge cases to handle

- User dismisses (skip or ✕) partway through → still counts as seen,
  never auto-reopens.
- User signs out and back in on the same device before finishing onboarding
  → `shouldShowOnboarding()` re-checks Firestore each time, so it will
  correctly reappear if `onboardingSeen` is still false.
- User opens "How this works" from the profile page after already having
  seen it once → should still open normally (forced-open mode bypasses the
  `shouldShowOnboarding()` check entirely).
- Multiple tabs/pages open at once → not a concern at this scale; last
  write wins, consistent with the rest of the project's approach to
  concurrency.

## Acceptance criteria

- [ ] New account creation triggers the carousel automatically, once
- [ ] Skip, ✕, and finishing the last slide all set `onboardingSeen: true`
      and never trigger it again automatically
- [ ] "How this works" link on profile page reopens the identical carousel
      regardless of `onboardingSeen` state
- [ ] Swipe works on mobile; dot/button nav works on both mobile and
      desktop
- [ ] Layout reads correctly at mobile width (bottom sheet) and desktop
      width (centered modal)
- [ ] No new colours, fonts, or interaction patterns introduced outside
      the existing design system
- [ ] Keyboard accessible: arrow keys navigate, Escape closes, focus
      doesn't get trapped outside the dialog in a way that breaks tabbing
