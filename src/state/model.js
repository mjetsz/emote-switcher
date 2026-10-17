// A card is either a base emote (original set) or, with original null, an emote that's only in the
// festive set (saved) or that the user added. Cards are plain immutable objects; the store wraps each in a signal.

export const emoteImg = (id, size = "2x") =>
  `https://cdn.7tv.app/emote/${encodeURIComponent(id)}/${size}.webp`;

const blank = {
  alias: "",
  options: [],
  selected: null,
  mode: "keep",
  exact: false,
  searched: false,
  searching: false,
  touched: false,
  error: "",
};

export const newRow = (original, alias = "") => ({
  ...blank,
  key: `row:${original.id}:${original.name}`,
  original,
  saved: null,
  added: false,
  alias,
});

export const newExtra = (emote, added = false) => ({
  ...blank,
  key: `${added ? "added" : "extra"}:${emote.id}:${emote.name}`,
  original: null,
  saved: emote,
  added,
  options: [{ ...emote, current: true }],
  selected: emote.id,
});

export const isExtra = (c) => !c.original;
export const baseEmote = (c) => c.original ?? c.saved;
export const nameOf = (c) => c.alias.trim() || baseEmote(c).name;
export const isRenamed = (c) => nameOf(c) !== baseEmote(c).name;
export const selectedOption = (c) =>
  c.options.find((o) => o.id === c.selected) || null;

// The emote that ends up in the festive set, or null when dropped.
export function targetOf(c) {
  if (c.mode === "drop") return null;
  if (isExtra(c)) return selectedOption(c) || c.saved;
  return c.mode === "change"
    ? selectedOption(c) || c.original
    : c.original;
}

export const isChanged = (c) =>
  c.mode !== "drop" && (targetOf(c).id !== baseEmote(c).id || isRenamed(c));

export function nameError(name) {
  return /\s/.test(name) || name.length > 100
    ? `"${name}" is not a valid name: no spaces, max 100 characters`
    : null;
}

export function pick(c, id) {
  return isExtra(c)
    ? { ...c, selected: id }
    : { ...c, touched: true, selected: id, mode: "change" };
}

export function setMode(c, mode) {
  if (isExtra(c)) return { ...c, mode };
  const next = { ...c, touched: true, mode };
  if (mode === "change" && !selectedOption(c))
    next.selected = c.options[0]?.id ?? null;
  return next;
}

export function withCustom(c, emote) {
  const options = [
    ...c.options.filter((o) => !o.custom && o.id !== emote.id),
    { ...emote, custom: true },
  ];
  return { ...pick({ ...c, options }, emote.id), error: "" };
}

// Adds search results, keeping the current and custom options. Untouched base emotes switch to the best match.
export function mergeVariants(c, found, exact) {
  const kept = c.options.filter((o) => o.current || o.custom);
  const candidates = found.filter((f) => !kept.some((o) => o.id === f.id));
  const next = {
    ...c,
    options: [
      ...kept.filter((o) => o.current),
      ...candidates,
      ...kept.filter((o) => o.custom),
    ],
    exact,
    searched: true,
  };
  if (isExtra(c)) return next;
  const keepSelection =
    c.mode === "change" && kept.some((o) => o.id === c.selected);
  const current = kept.find((o) => o.current);
  if (!keepSelection && !c.touched && c.mode !== "drop") {
    next.selected = current ? current.id : (candidates[0]?.id ?? null);
    next.mode = current || exact ? "change" : "keep";
  }
  return next;
}

// Mirrors the existing festive set: its emote under the row's name becomes a "current" option, and an
// untouched row defaults to Change (different emote there), Drop (name missing from the set) or Keep.
export function applyCurrent(row, byName, exists) {
  const hadCurrentSelected = row.options.some(
    (o) => o.current && o.id === row.selected,
  );
  let options = row.options.filter((o) => !o.current);
  const current = byName.get(nameOf(row));
  const differs = current && current.id !== row.original.id;
  if (differs)
    options = [
      { ...current, current: true },
      ...options.filter((o) => o.id !== current.id),
    ];

  const next = { ...row, options };
  if (!row.touched) {
    next.selected = differs ? current.id : null;
    next.mode = differs ? "change" : exists && !current ? "drop" : "keep";
  } else if (hadCurrentSelected) {
    next.selected = differs ? current.id : (options[0]?.id ?? null);
    if (!differs && row.mode === "change") next.mode = "keep";
  }
  return next;
}

// Whether saving would change this row's entry in the existing festive set.
export function differsFromSaved(row, saved) {
  const entry = saved.get(nameOf(row));
  if (row.mode === "drop") return !!entry;
  return entry?.id !== targetOf(row).id;
}

// [class, text] for the status line of a card.
export function hintFor(c) {
  if (isExtra(c)) {
    if (c.mode === "drop") return ["remove", "Will be removed on save"];
    if (c.added) return ["keep", "Will be added on save"];
    if (isChanged(c)) return ["partial", "Will be updated on save"];
    return ["keep", "Kept in festive set"];
  }
  if (c.mode === "drop") return ["remove", "Left out of the festive set"];
  const selected = selectedOption(c);
  if (c.mode === "change" && selected?.current)
    return ["keep", "Currently in the festive set"];
  if (selected?.custom) return ["", "Custom emote from URL"];
  if (c.exact) return ["exact", "Exact name match"];
  if (c.options.length)
    return ["partial", "Similar names, check before using"];
  if (c.searched) return ["", "No festive variant found"];
  return null;
}
