'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

/** Stacked layouts show this many until "Ver más". The nth-child rule in home-reviews.css matches it. */
const STACKED_REVIEW_COUNT = 3;

/** Side by side the reviews scroll sideways. Stacked they don't overflow, so no arrow or fade appears. */
export function HomeReviewsRail({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () =>
      setEdges({
        start: list.scrollLeft > 1,
        end: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
      });
    update();
    list.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(list);
    return () => {
      list.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, []);

  function scrollReviews(direction: -1 | 1) {
    const list = listRef.current;
    const card = list?.firstElementChild;
    if (!list || !(card instanceof HTMLElement)) return;
    const { columnGap } = getComputedStyle(list);
    list.scrollBy({ left: direction * (card.offsetWidth + parseFloat(columnGap)), behavior: 'smooth' });
  }

  function showAll() {
    // The button goes away, so focus moves to the list instead of falling back to the page.
    listRef.current?.focus({ preventScroll: true });
    setExpanded(true);
  }

  return (
    <>
      <div
        className="reviews-rail"
        data-more-before={edges.start || undefined}
        data-more-after={edges.end || undefined}
      >
        {/* Focusable so the keyboard can scroll it: the cards inside have nothing to tab to. */}
        <div
          aria-label="Opiniones de clientes"
          className="reviews-list"
          data-expanded={expanded || undefined}
          ref={listRef}
          role="group"
          tabIndex={0}
        >
          {children}
        </div>
        {/* Pointer shortcuts only: the keyboard scrolls the focused list with the arrow keys. */}
        {edges.start && (
          <button
            aria-hidden="true"
            className="reviews-rail-arrow reviews-rail-arrow-prev"
            onClick={() => scrollReviews(-1)}
            tabIndex={-1}
            type="button"
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}
        {edges.end && (
          <button
            aria-hidden="true"
            className="reviews-rail-arrow reviews-rail-arrow-next"
            onClick={() => scrollReviews(1)}
            tabIndex={-1}
            type="button"
          >
            <ChevronRight size={20} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {!expanded && Children.count(children) > STACKED_REVIEW_COUNT ? (
        <button className="text-link reviews-more" onClick={showAll} type="button">
          Ver más opiniones <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} />
        </button>
      ) : null}
    </>
  );
}
