import { filter, matches, rows, tab } from "../store.js";
import styles from "./Toolbar.module.css";

const TABS = [
  ["all", "All"],
  ["variants", "With variants"],
  ["none", "No variants"],
  ["changing", "Changing"],
  ["dropped", "Dropped"],
  [
    "unsaved",
    "Unsaved",
    "Only emotes that differ from the festive set as it's saved on 7TV",
  ],
];

export function Toolbar() {
  const total = rows.value.length;
  return (
    <div class={styles.toolbar}>
      <div class={styles.search}>
        <input
          type="search"
          placeholder="Search emotes..."
          autocomplete="off"
          value={filter.value}
          onInput={(e) => (filter.value = e.currentTarget.value)}
        />
      </div>
      <div class={styles.tabs}>
        {TABS.map(([id, label, title]) => (
          <button
            key={id}
            class={tab.value === id ? styles.active : ""}
            title={title}
            onClick={() => (tab.value = id)}
          >
            {label}
          </button>
        ))}
      </div>
      <span class={styles.count}>
        {total ? `${matches.value.length} of ${total} emotes` : ""}
      </span>
    </div>
  );
}
