import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const MORE_HEIGHT = 24;

interface Props {
  children: ReactNode;
  className?: string;
  /** Where "+N more" leads, e.g. the tab with the full list. Without it, the link expands the list in place. */
  onMore?: () => void;
  moreLabel?: string;
}

/**
 * A list that shows only the rows that fit its box, so the page never has to scroll.
 * Rows that don't fit are hidden whole (never cut in half) and a "+N more" line says
 * how many. Add `data-fit-heading` to group headings so one is never left dangling
 * without its rows. When the box isn't height-limited (small screens), all rows show.
 */
export function FitList({ children, className = '', onMore, moreLabel }: Props) {
  const list = useRef<HTMLUListElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [hidden, setHidden] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const measure = useRef(() => {});
  measure.current = () => {
    const el = list.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    for (const item of items) item.style.visibility = '';
    // Fractional positions: rounded offsets can hide a row that pokes out by a pixel.
    const top = el.getBoundingClientRect().top + el.clientTop;
    const height = el.clientHeight;
    const bottomOf = (item: HTMLElement) => item.getBoundingClientRect().bottom - top;
    if (expandedRef.current || !items.some((item) => bottomOf(item) > height + 0.5)) {
      setHidden(0);
      return;
    }
    const limit = height - MORE_HEIGHT;
    let firstHidden = items.findIndex((item) => bottomOf(item) > limit);
    if (firstHidden === -1) firstHidden = items.length;
    // Don't leave a heading as the last visible row.
    while (firstHidden > 0 && items[firstHidden - 1]!.hasAttribute('data-fit-heading')) firstHidden--;
    let count = 0;
    items.forEach((item, i) => {
      if (i < firstHidden) return;
      item.style.visibility = 'hidden';
      if (!item.hasAttribute('data-fit-heading')) count++;
    });
    setHidden(count);
  };

  useEffect(() => {
    // Web fonts change row heights once they arrive.
    document.fonts?.ready.then(() => measure.current());
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, []);

  // Re-measure after every render: the rows may have changed. Watching each row
  // also catches rows that grow on their own (e.g. once their data loads).
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    observer.current ??= new ResizeObserver(() => measure.current());
    observer.current.observe(el);
    for (const item of Array.from(el.children)) observer.current.observe(item);
    measure.current();
    // Once more after the browser settles the layout (e.g. siblings that render in the same pass).
    const frame = requestAnimationFrame(() => measure.current());
    return () => cancelAnimationFrame(frame);
  });

  return (
    <div className={`fit ${expanded ? 'is-expanded' : ''}`}>
      <ul ref={list} className={`fit-list ${className}`}>
        {children}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          className="fit-more"
          onClick={() => (onMore ? onMore() : setExpanded(true))}
          title={onMore ? undefined : 'Show everything (this list will scroll)'}
        >
          +{hidden} more{moreLabel ? ` · ${moreLabel}` : ''}
        </button>
      )}
    </div>
  );
}
