import { cx } from "../lib/cx.js";
import styles from "./Hint.module.css";

// tone: "", "exact", "keep", "partial" or "remove".
export function Hint({ tone, children }) {
  return <div class={cx(styles.hint, tone && styles[tone])}>{children}</div>;
}
