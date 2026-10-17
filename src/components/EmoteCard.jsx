import { memo } from "preact/compat";
import { cx } from "../lib/cx.js";
import * as m from "../state/model.js";
import {
  event,
  pickOption,
  searchCard,
  setAlias,
  setMode,
  useEmoteUrl,
} from "../state/store.js";
import { EmoteFigure } from "./EmoteFigure.jsx";
import { Hint } from "./Hint.jsx";
import { NameField } from "./NameField.jsx";
import { OptionButton } from "./OptionButton.jsx";
import { Segmented } from "./Segmented.jsx";
import { UrlForm } from "./UrlForm.jsx";
import styles from "./EmoteCard.module.css";

function modesFor(c) {
  if (m.isExtra(c))
    return [
      { mode: "keep", label: "Keep", title: "Keep this emote in the festive set" },
      c.added
        ? { mode: "drop", label: "Remove", title: "Don't add this emote" }
        : {
            mode: "drop",
            label: "Drop",
            title: "Remove this emote from the festive set on save",
          },
    ];
  return [
    { mode: "keep", label: "Keep", title: "Include the original emote" },
    {
      mode: "change",
      label: "Change",
      title: "Replace with the selected emote",
      disabled: c.options.length === 0,
    },
    { mode: "drop", label: "Drop", title: "Leave this emote out of the festive set" },
  ];
}

// The right-hand caption is only emphasised when the card actually changes something.
function Figures({ card: c, changing }) {
  const left = m.isExtra(c) ? (
    <EmoteFigure emote={null} caption={c.added ? "Added" : "Not in base"} />
  ) : (
    <EmoteFigure emote={c.original} />
  );
  const right =
    c.mode === "drop" ? (
      <EmoteFigure emote={null} muted caption="Left out" />
    ) : m.isExtra(c) || m.isChanged(c) ? (
      <EmoteFigure
        emote={m.targetOf(c)}
        muted={!changing}
        caption={m.nameOf(c)}
      />
    ) : (
      <EmoteFigure emote={null} muted caption="No change" />
    );
  return (
    <div class={styles.pair}>
      {left}
      <span class={styles.arrow}>{"\u2192"}</span>
      {right}
    </div>
  );
}

// One card for both base emotes and festive-only emotes; card is a signal holding the model object.
export const EmoteCard = memo(function EmoteCard({ card }) {
  const c = card.value;
  const hint = m.hintFor(c);
  const base = m.baseEmote(c);
  // Festive-only emotes always have their current emote as an option, so only show the list once there's a choice.
  const options = m.isExtra(c) && c.options.length < 2 ? [] : c.options;
  const highlighted = m.isExtra(c) || c.mode === "change" ? c.selected : null;
  const dropped = c.mode === "drop";
  const changing = !dropped && (c.added || m.isChanged(c));

  return (
    <article
      class={cx(
        styles.card,
        dropped && styles.dropped,
        changing && styles.changing,
      )}
    >
      <Figures card={c} changing={changing} />
      <Segmented
        modes={modesFor(c)}
        value={c.mode}
        onChange={(mode) => setMode(card, mode)}
      />
      <div class={styles.row}>
        {hint ? <Hint tone={hint[0]}>{hint[1]}</Hint> : <span />}
        <button
          type="button"
          class={styles.searchButton}
          disabled={c.searching}
          title={`Search ${event.value || "other"} variants of ${base.name}`}
          onClick={() => searchCard(card)}
        >
          {c.searching
            ? "Searching..."
            : c.searched
              ? "Search again"
              : "Find variants"}
        </button>
      </div>
      {options.length > 0 && (
        <div class={styles.options}>
          {options.map((option) => (
            <OptionButton
              key={option.id}
              option={option}
              selected={option.id === highlighted}
              onClick={() => pickOption(card, option.id)}
            />
          ))}
        </div>
      )}
      <NameField
        value={m.nameOf(c)}
        placeholder={base.name}
        renamed={m.isRenamed(c)}
        onInput={(value) => setAlias(card, value)}
      />
      <UrlForm onSubmit={(url) => useEmoteUrl(card, url)} />
      {c.error && <div class={styles.error}>{c.error}</div>}
    </article>
  );
});
