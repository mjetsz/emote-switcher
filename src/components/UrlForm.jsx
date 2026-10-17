import { useState } from "preact/hooks";
import styles from "./UrlForm.module.css";

export function UrlForm({ onSubmit }) {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      class={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        setPending(true);
        await onSubmit(url.trim());
        setPending(false);
      }}
    >
      <input
        type="text"
        placeholder="Paste a 7TV emote URL"
        spellcheck={false}
        value={url}
        onInput={(e) => setUrl(e.currentTarget.value)}
      />
      <button type="submit" disabled={pending}>
        Use
      </button>
    </form>
  );
}
