import { cx } from "../cx.js";
import {
  activeSetId,
  busy,
  channel,
  channelInput,
  event,
  findVariants,
  loadChannel,
  setEvent,
  setId,
  sets,
  token,
} from "../store.js";
import styles from "./Controls.module.css";

const EVENTS = [
  ["", "None (edit base set)"],
  ["christmas", "Christmas"],
  ["halloween", "Halloween"],
  ["easter", "Easter"],
];

function TokenField() {
  return (
    <label class={cx("field", styles.tokenField)}>
      <span>
        7TV token{" "}
        <span class={styles.info} aria-hidden="true">
          ?
        </span>
      </span>
      <input
        type="password"
        autocomplete="off"
        placeholder="Paste your 7TV token"
        aria-describedby="token-help"
        value={token.value}
        onInput={(e) => (token.value = e.currentTarget.value)}
      />
      <small>Only sent to 7tv.io, never stored.</small>
      <div class={styles.tooltip} id="token-help" role="tooltip">
        <strong>How to get your token</strong>
        <ol>
          <li>
            Open <b>7tv.app</b> and log in
          </li>
          <li>
            Press <kbd>F12</kbd> and open the <b>Console</b> tab
          </li>
          <li>
            Type this and press <kbd>Enter</kbd>:
            <code>localStorage.getItem("7tv-token")</code>
          </li>
          <li>Copy the result without the quotes</li>
        </ol>
        <em>
          Treat it like a password: anyone with it can edit your 7TV account.
        </em>
      </div>
    </label>
  );
}

export function Controls() {
  return (
    <section class={cx("panel", styles.controls)}>
      <form
        class="field"
        onSubmit={(e) => {
          e.preventDefault();
          loadChannel();
        }}
      >
        <span>Channel</span>
        <div class="inline">
          <input
            placeholder="Twitch channel"
            autocomplete="off"
            spellcheck={false}
            value={channelInput.value}
            onInput={(e) => (channelInput.value = e.currentTarget.value)}
          />
          <button type="submit" disabled={busy.value}>
            Load
          </button>
        </div>
      </form>
      <label class="field">
        <span>Base emote set</span>
        <select
          disabled={busy.value || !channel.value}
          value={setId.value}
          onChange={(e) => loadChannel(e.currentTarget.value)}
        >
          {sets.value.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name + (set.id === activeSetId.value ? " (active)" : "")}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span>Event</span>
        <select
          value={event.value}
          onChange={(e) => setEvent(e.currentTarget.value)}
        >
          {EVENTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <TokenField />
      <button class="primary" disabled={busy.value} onClick={findVariants}>
        Find festive variants
      </button>
    </section>
  );
}
