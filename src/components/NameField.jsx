import { useState } from "preact/hooks";
import { cx } from "../lib/cx.js";
import styles from "./NameField.module.css";

// Shows what's being typed while focused, and the resolved name otherwise, so the field can be cleared to retype.
export function NameField({ value, placeholder, renamed, onInput }) {
  const [draft, setDraft] = useState(null);
  return (
    <label class={styles.field} title="Name this emote gets in the festive set">
      <span>Name in set</span>
      <input
        type="text"
        value={draft ?? value}
        placeholder={placeholder}
        spellcheck={false}
        class={cx(renamed && styles.renamed)}
        onInput={(e) => {
          setDraft(e.currentTarget.value);
          onInput(e.currentTarget.value);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}
