import { useEffect, useRef, useState } from "preact/hooks";
import { filter, matches, rows, setId, tab } from "../store.js";
import { EmoteCard } from "./EmoteCard.jsx";
import styles from "./EmoteGrid.module.css";

// Big sets are rendered in pages; every card holds animated images, which is what eats memory.
const PAGE_SIZE = 60;

export function EmoteGrid() {
  const [count, setCount] = useState(PAGE_SIZE);
  const more = useRef(null);
  const list = matches.value;
  const hasMore = count < list.length;

  useEffect(() => setCount(PAGE_SIZE), [filter.value, tab.value, setId.value]);

  // Recreated after every page, which re-checks visibility so a tall screen keeps filling until it's covered.
  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setCount((n) => n + PAGE_SIZE);
      },
      { rootMargin: "800px" },
    );
    observer.observe(more.current);
    return () => observer.disconnect();
  }, [hasMore, count]);

  return (
    <>
      <main class="grid">
        {rows.value.length === 0 ? (
          <div class={styles.emptyState}>Load a channel to see its emotes</div>
        ) : list.length === 0 ? (
          <div class={styles.emptyState}>No emotes match</div>
        ) : (
          list
            .slice(0, count)
            .map((card) => <EmoteCard key={card.peek().key} card={card} />)
        )}
      </main>
      {hasMore && (
        <button
          ref={more}
          type="button"
          class={styles.showMore}
          onClick={() => setCount((n) => n + PAGE_SIZE)}
        >
          Show more
        </button>
      )}
    </>
  );
}
