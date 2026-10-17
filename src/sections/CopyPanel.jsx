import { useRef, useState } from "preact/hooks";
import { getChannel, getEmoteSet, getUserEmoteSets } from "../api/seventv.js";
import { cx } from "../lib/cx.js";
import { emoteImg } from "../state/model.js";
import { busy, channel, copySet, setStatus, showError } from "../state/store.js";
import styles from "./CopyPanel.module.css";

const PREVIEW_LIMIT = 120;

export function CopyPanel() {
  const [source, setSource] = useState("");
  const [sets, setSets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  // The set picked last, so a slow preview for an earlier pick doesn't overwrite it.
  const latest = useRef("");

  async function select(id, list = sets) {
    latest.current = id;
    setSelectedId(id);
    setPreview(null);
    if (!id) return;
    setName(list.find((s) => s.id === id)?.name || "");
    try {
      const set = await getEmoteSet(id);
      if (latest.current === id) setPreview(set);
    } catch (err) {
      showError(err);
    }
  }

  async function loadSets(e) {
    e.preventDefault();
    const name = source.trim();
    if (!name) return;
    setLoading(true);
    setStatus(`Loading emote sets of ${name}...`);
    try {
      const { userId, activeSet } = await getChannel(name);
      const list = (await getUserEmoteSets(userId)).map((s) => ({
        ...s,
        active: s.id === activeSet?.id,
      }));
      setSets(list);
      setStatus(`${name} has ${list.length} emote sets`);
      await select(activeSet?.id ?? list[0]?.id ?? "", list);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }

  const emotes = preview?.emotes ?? [];
  const hidden = emotes.length - PREVIEW_LIMIT;

  return (
    <details class={cx("panel", styles.copyPanel)}>
      <summary>Copy an emote set from another channel</summary>
      <div class={styles.copyBody}>
        <form class="field" onSubmit={loadSets}>
          <span>From channel</span>
          <div class="inline">
            <input
              placeholder="Twitch channel"
              autocomplete="off"
              spellcheck={false}
              value={source}
              onInput={(e) => setSource(e.currentTarget.value)}
            />
            <button type="submit" disabled={loading}>
              Find sets
            </button>
          </div>
        </form>
        <label class="field">
          <span>Emote set</span>
          <select
            disabled={sets.length === 0}
            value={selectedId}
            onChange={(e) => select(e.currentTarget.value)}
          >
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name + (set.active ? " (active)" : "")}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span>New set name</span>
          <input
            placeholder="Name in your account"
            autocomplete="off"
            spellcheck={false}
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <button
          class="primary"
          disabled={
            busy.value || emotes.length === 0 || !channel.value || !name.trim()
          }
          onClick={() =>
            copySet({
              emotes,
              name: name.trim(),
              sourceName: preview.name,
              sourceChannel: source.trim(),
            })
          }
        >
          {channel.value ? `Copy to ${channel.value}` : "Copy"}
        </button>
      </div>
      {preview && (
        <div class={styles.preview}>
          <div class={styles.count}>
            {`${emotes.length} emotes` +
              (hidden > 0 ? ` (showing the first ${PREVIEW_LIMIT})` : "")}
          </div>
          <div class={styles.strip}>
            {emotes.slice(0, PREVIEW_LIMIT).map((e) => (
              <img
                key={e.id + e.name}
                src={emoteImg(e.id, "1x")}
                alt={e.name}
                title={e.name}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}
    </details>
  );
}
