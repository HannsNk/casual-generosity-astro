// src/scripts/onboarding.js
//
// Drives the OnboardingCarousel component: slide navigation (buttons,
// dots, swipe), skip/close, and reporting completion back to Firestore
// via markOnboardingSeen() (see firebase.js addition in the build prompt).
//
// Per project convention, this file is imported into the .astro
// component with `<script>import '../scripts/onboarding.js';</script>`
// — never inline bare-specifier imports, never src="" script tags.

import { auth, shouldShowOnboarding, markOnboardingSeen } from "../lib/firebase.js";
import { onAuthStateChanged } from "firebase/auth";

// Set by initOnboarding once the single overlay instance mounted in the
// layout exists, so the profile page's "How this works" link can reopen
// the exact same component (forced) without a second component instance.
let forceOpenOnboarding = null;

export function openOnboarding() {
  forceOpenOnboarding?.();
}

function initOnboarding() {
  const overlay = document.getElementById("onboarding-overlay");
  if (!overlay) return;

  const track = document.getElementById("onboarding-track");
  const dotsWrap = document.getElementById("onboarding-dots");
  const dots = Array.from(dotsWrap.querySelectorAll(".dot"));
  const prevBtn = document.getElementById("onboarding-prev");
  const nextBtn = document.getElementById("onboarding-next");
  const closeBtn = document.getElementById("onboarding-close");
  const slideCount = dots.length;

  let index = 0;
  let startX = 0;
  let deltaX = 0;
  let dragging = false;

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
    prevBtn.disabled = index === 0;
    nextBtn.setAttribute(
      "aria-label",
      index === slideCount - 1 ? "Finish" : "Next slide",
    );
  }

  function goTo(i) {
    index = Math.max(0, Math.min(slideCount - 1, i));
    render();
  }

  // Locks page scroll behind the modal while it's open — restores whatever
  // the body's own inline overflow was before, so this doesn't clobber
  // scroll-locking done by anything else on the page.
  let previousBodyOverflow = "";

  function open() {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlay.hidden = false;
  }

  function finish() {
    overlay.hidden = true;
    document.body.style.overflow = previousBodyOverflow;
    // Fire-and-forget; don't block the UI on the write.
    markOnboardingSeen().catch((err) => {
      console.error("Failed to record onboarding as seen:", err);
    });
  }

  prevBtn.addEventListener("click", () => goTo(index - 1));

  nextBtn.addEventListener("click", () => {
    if (index === slideCount - 1) {
      finish();
    } else {
      goTo(index + 1);
    }
  });

  closeBtn.addEventListener("click", finish);

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => goTo(i));
  });

  // Swipe support (mobile)
  track.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    dragging = true;
  }, { passive: true });

  track.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    deltaX = e.touches[0].clientX - startX;
  }, { passive: true });

  track.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    const threshold = 40;
    if (deltaX > threshold) goTo(index - 1);
    else if (deltaX < -threshold) goTo(index + 1);
    deltaX = 0;
  });

  // Keyboard nav while open
  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "ArrowRight") goTo(index + 1);
    if (e.key === "ArrowLeft") goTo(index - 1);
    if (e.key === "Escape") finish();
  });

  render();

  forceOpenOnboarding = () => {
    goTo(0);
    open();
  };

  // Auto-open logic: either forced open (profile page "How this works"
  // link), or reacting to sign-in like favorites.js does — checking on
  // every auth state change (rather than once at page load) is what makes
  // this fire immediately right after a brand-new account is created,
  // instead of only on the next page load.
  const forceOpen = overlay.dataset.forceOpen === "true";
  if (forceOpen) {
    open();
  } else {
    onAuthStateChanged(auth, (user) => {
      if (!user) return;
      shouldShowOnboarding().then((show) => {
        if (show) open();
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", initOnboarding);
