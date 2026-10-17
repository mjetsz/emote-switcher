import { useState } from "preact/hooks";
import { getEmote, parseEmoteID, searchEmotes } from "../api/seventv.js";
import {
  addExtra,
  busy,
  extrasSetName,
  rows,
  showError,
  visibleExtras,
} from "../store.js";
import { EmoteCard } from "./EmoteCard.jsx";
import { Hint } from "./Hint.jsx";
import { OptionButton } from "./OptionButton.jsx";
import styles from "./ExtrasSection.module.css";

function emoteIdOrNull(value) {
  try {
    return parseEmoteID(value);
  } catch {
    return null;
  }
}

// A URL or ID adds that emote right away; anything else searches 7TV by name and lists results to pick from.
function AddEmoteForm() {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [results, setResults] = useState(null);
  const [pending, setPending] = useState(false);

  const add = (emote) => {
    try {
      addExtra(emote, name);
      setQuery("");
      setName("");
      setResults(null);
    } catch (err) {
      showError(err);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    setPending(true);
    try {
      const id = emoteIdOrNull(value);
      if (id) add(await getEmote(id));
      else setResults({ query: value, items: await searchEmotes(value) });
    } catch (err) {
      showError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <form class={styles.addForm} onSubmit={submit}>
        <input
          placeholder="7TV emote URL or name to search"
          autocomplete="off"
          spellcheck={false}
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <input
          class={styles.addName}
          placeholder="Name (optional)"
          autocomplete="off"
          spellcheck={false}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" disabled={busy.value || pending}>
          Add emote
        </button>
      </form>
      {results && (
        <div class={styles.addResults}>
          {results.items.length === 0 ? (
            <Hint>No emotes found for "{results.query}"</Hint>
          ) : (
            results.items.map((emote) => (
              <OptionButton
                key={emote.id}
                option={emote}
                onClick={() => add(emote)}
              />
            ))
          )}
        </div>
      )}
    </>
  );
}

export function ExtrasSection() {
  if (rows.value.length === 0) return null;
  return (
    <section class={styles.extras}>
      <div class={styles.sectionHead}>
        <h2>
          Only in <span>{extrasSetName.value}</span>
        </h2>
        <p>
          These emotes are in the festive set but not in your base set. Rename
          them, swap them for another emote, drop them, or add new ones.
        </p>
      </div>
      <AddEmoteForm />
      <div class="grid">
        {visibleExtras.value.map((card) => (
          <EmoteCard key={card.peek().key} card={card} />
        ))}
      </div>
    </section>
  );
}
