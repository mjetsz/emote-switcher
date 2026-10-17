import { cx } from "../lib/cx.js";
import styles from "./Segmented.module.css";

// modes: [{ mode, label, title, disabled }]; "change" and "drop" get their own active colour.
export function Segmented({ modes, value, onChange }) {
  return (
    <div class={styles.segmented}>
      {modes.map(({ mode, label, title, disabled }) => (
        <button
          key={mode}
          type="button"
          class={cx(styles[mode], value === mode && styles.active)}
          title={title}
          disabled={disabled}
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
