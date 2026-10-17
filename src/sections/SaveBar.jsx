import {
  busy,
  commitTargetName,
  defaultSetName,
  progress,
  rows,
  save,
  setName,
  status,
  summary,
  targetNameInput,
} from "../store.js";
import { cx } from "../cx.js";
import styles from "./SaveBar.module.css";

function Progress() {
  const p = progress.value;
  if (!p) return null;
  return (
    <div class={cx(styles.progress, !p.total && styles.indeterminate)}>
      <div
        class={styles.bar}
        style={{
          width: p.total ? Math.round((p.done / p.total) * 100) + "%" : "0",
        }}
      />
    </div>
  );
}

export function SaveBar() {
  return (
    <footer class={styles.savebar}>
      <Progress />
      <div class="container">
        <span class={styles.summary}>{summary.value}</span>
        <span class={cx(styles.status, status.value.error && styles.errorText)}>
          {status.value.text}
        </span>
        <label
          class={styles.saveAs}
          title="Name of the emote set to save to. Leave empty for the default."
        >
          <span>Save as</span>
          <input
            autocomplete="off"
            spellcheck={false}
            placeholder={setName.value ? defaultSetName.value : "Set name"}
            value={targetNameInput.value}
            onInput={(e) => (targetNameInput.value = e.currentTarget.value)}
            onChange={commitTargetName}
          />
        </label>
        <button
          class="primary"
          disabled={busy.value || rows.value.length === 0}
          onClick={save}
        >
          Save
        </button>
      </div>
    </footer>
  );
}
