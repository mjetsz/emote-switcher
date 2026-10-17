import {
  busy,
  commitTargetName,
  defaultSetName,
  pendingChanges,
  progress,
  rows,
  save,
  savedExists,
  setName,
  status,
  summary,
  targetNameInput,
  targetSetName,
} from "../state/store.js";
import { cx } from "../lib/cx.js";
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

function pendingText() {
  const p = pendingChanges.value;
  if (p.error) return [`Can't save: ${p.error}`, true];
  if (savedExists.value === null) return ["Checking the saved set...", false];
  if (!savedExists.value)
    return [`Creates ${targetSetName.value} with ${p.total} emotes`, false];
  const parts = [
    [p.replaced, "replaced"],
    [p.added, "added"],
    [p.renamed, "renamed"],
    [p.removed, "removed"],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`);
  return [parts.length ? parts.join(", ") : "Nothing to save", false];
}

// Two views of the same edits: compared to the base set, and what Save would change on 7TV.
function Counts() {
  if (rows.value.length === 0) return null;
  const [pending, problem] = pendingText();
  return (
    <div class={styles.counts}>
      <span class={styles.summary}>
        <span class={styles.label}>Vs base</span>
        {summary.value}
      </span>
      <span class={cx(styles.pending, problem && styles.warn)}>
        <span class={styles.label}>On save</span>
        {pending}
      </span>
    </div>
  );
}

export function SaveBar() {
  return (
    <footer class={styles.savebar}>
      <Progress />
      <div class="container">
        <Counts />
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
