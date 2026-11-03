import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/** The timeline methods a section reveal uses, so a section is written once for both layouts. */
export type ScrollReveal = {
  from(targets: gsap.TweenTarget, vars: gsap.TweenVars, position?: gsap.Position): ScrollReveal;
  fromTo(
    targets: gsap.TweenTarget,
    fromVars: gsap.TweenVars,
    toVars: gsap.TweenVars,
    position?: gsap.Position,
  ): ScrollReveal;
};

type ScrollRevealOptions = {
  start: string;
  /** Phone layout: the section's blocks stack instead of sitting side by side. */
  stacked: boolean;
  /** The gsap.matchMedia callback's second argument, so tweens started later revert with the rest. */
  contextSafe: gsap.ContextSafeFunc | undefined;
};

/** Where an element revealing on its own starts: just after its top edge comes into view. */
export const IN_VIEW_START = 'top 88%';

const defaults = { ease: 'power3.out' };

/**
 * A section's scroll reveal. Side by side, the section plays as one timeline once its top reaches `start`.
 * Stacked, a section runs several screens tall, and one timeline would play its lower blocks while they
 * are still below the fold, so each element reveals as it scrolls into view instead. Elements that come
 * into view together keep their stagger; timeline positions apply only side by side.
 * Call it inside a gsap.matchMedia callback, which reverts everything it starts.
 */
export function scrollReveal(trigger: gsap.DOMTarget, { start, stacked, contextSafe }: ScrollRevealOptions) {
  if (!stacked) {
    return gsap.timeline({ defaults, scrollTrigger: { trigger, start, once: true } }) as ScrollReveal;
  }

  return revealInView(contextSafe);
}

/**
 * A page intro. Stacked, its lower blocks start below the fold, and the intro would finish them before
 * anyone scrolls there: those reveal as they scroll into view instead, and the rest plays in `intro`.
 */
export function introReveal(intro: gsap.core.Timeline, { stacked, contextSafe }: Omit<ScrollRevealOptions, 'start'>) {
  if (!stacked) return intro as ScrollReveal;

  const inView = revealInView(contextSafe);
  const belowFold = (element: Element) => element.getBoundingClientRect().top >= window.innerHeight;
  const split = (targets: gsap.TweenTarget) => {
    const elements = gsap.utils.toArray<Element>(targets);
    return [elements.filter(element => !belowFold(element)), elements.filter(belowFold)];
  };

  const reveal: ScrollReveal = {
    from(targets, vars, position) {
      const [aboveFold, below] = split(targets);
      if (aboveFold.length) intro.from(aboveFold, vars, position);
      inView.from(below, vars);
      return reveal;
    },
    fromTo(targets, fromVars, toVars, position) {
      const [aboveFold, below] = split(targets);
      if (aboveFold.length) intro.fromTo(aboveFold, fromVars, toVars, position);
      inView.fromTo(below, fromVars, toVars);
      return reveal;
    },
  };

  return reveal;
}

// Reveals each element as it scrolls into view. Elements that come into view together play as one group,
// so they keep their stagger.
function revealInView(contextSafe: gsap.ContextSafeFunc | undefined) {
  // Calls `play` with each group of `targets` that comes into view, and returns them; an empty selection
  // would warn.
  const onScrollIn = (targets: gsap.TweenTarget, play: ScrollTrigger.BatchCallback) => {
    const elements = gsap.utils.toArray<Element>(targets);
    if (elements.length) {
      const onEnter = (contextSafe?.(play) ?? play) as ScrollTrigger.BatchCallback;
      ScrollTrigger.batch(elements, { start: IN_VIEW_START, once: true, onEnter });
    }
    return elements;
  };

  const reveal: ScrollReveal = {
    from(targets, vars) {
      // Hidden until it is in view; shown again just before `from` reads its resting state.
      const hides = 'autoAlpha' in vars;
      const elements = onScrollIn(targets, batch => {
        if (hides) gsap.set(batch, { autoAlpha: 1 });
        gsap.from(batch, { ...defaults, ...vars });
      });
      if (hides && elements.length) gsap.set(elements, { autoAlpha: 0 });
      return reveal;
    },
    fromTo(targets, fromVars, toVars) {
      const elements = onScrollIn(targets, batch => gsap.to(batch, { ...defaults, ...toVars }));
      if (elements.length) gsap.set(elements, fromVars);
      return reveal;
    },
  };

  return reveal;
}
