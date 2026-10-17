import { signal, computed, batch } from "@preact/signals";
import * as api from "../api/seventv.js";
import * as m from "./model.js";

const LAST_CHANNEL_KEY = "emote-switcher:channel";

// ?channel=name&event=christmas preselects; otherwise the last loaded channel is reused.
const params = new URLSearchParams(location.search);
const startEvent = params.get("event");

export const channelInput = signal(
  params.get("channel") || localStorage.getItem(LAST_CHANNEL_KEY) || "",
);
export const event = signal(
  startEvent && api.EVENT_TAGS[startEvent] ? startEvent : "",
);
export const token = signal("");
export const filter = signal("");
export const tab = signal("all");
export const busy = signal(false);
export const status = signal({ text: "", error: false });
export const progress = signal(null);

export const channel = signal("");
export const userId = signal("");
export const setId = signal("");
export const setName = signal("");
export const sets = signal([]);
export const activeSetId = signal("");
export const targetNameInput = signal("");
export const extrasSetName = signal("");

// Each card is its own signal, so editing one only re-renders that card.
export const rows = signal([]);
export const extras = signal([]);
// The festive set as currently saved on 7TV, by emote name.
export const saved = signal(new Map());
// Whether that set exists on 7TV; null while it's being looked up.
export const savedExists = signal(null);

export const defaultSetName = computed(() =>
  event.value ? `${setName.value}-${event.value}` : setName.value,
);
export const targetSetName = computed(
  () => targetNameInput.value.trim() || defaultSetName.value,
);

export const setStatus = (text, error = false) =>
  (status.value = { text, error });
export const showError = (err) => setStatus("Error: " + err.message, true);

function showProgress(label, done = 0, total = 0) {
  progress.value = { done, total };
  setStatus(total ? `${label}... ${done} / ${total}` : `${label}...`);
}
const hideProgress = () => (progress.value = null);

api.hooks.onRateLimit = (ms) =>
  setStatus(`Rate limited by 7TV, retrying in ${ms / 1000}s...`);

const update = (card, fn) => (card.value = fn(card.value));

function matchesFilter(row) {
  const q = filter.value.trim().toLowerCase();
  if (
    q &&
    !row.original.name.toLowerCase().includes(q) &&
    !m.nameOf(row).toLowerCase().includes(q) &&
    !row.options.some((o) => o.name.toLowerCase().includes(q))
  )
    return false;
  switch (tab.value) {
    case "variants":
      return row.options.length > 0;
    case "none":
      return row.options.length === 0;
    case "changing":
      return m.isChanged(row);
    case "dropped":
      return row.mode === "drop";
    case "unsaved":
      return m.differsFromSaved(row, saved.value);
    default:
      return true;
  }
}

export const matches = computed(() =>
  rows.value.filter((r) => matchesFilter(r.value)),
);

export const visibleExtras = computed(() => {
  const q = filter.value.trim().toLowerCase();
  // Extras whose name is now used by a base emote get replaced anyway, so don't offer them.
  const taken = new Set(
    rows.value
      .map((r) => r.value)
      .filter((r) => r.mode !== "drop")
      .map(m.nameOf),
  );
  return extras.value.filter((x) => {
    const c = x.value;
    if (!c.added && taken.has(c.saved.name)) return false;
    return !q || `${c.saved.name} ${m.nameOf(c)}`.toLowerCase().includes(q);
  });
});

export const summary = computed(() => {
  const rs = rows.value.map((r) => r.value);
  if (rs.length === 0) return "";
  const xs = extras.value.map((x) => x.value);
  const count = (list, fn) => list.filter(fn).length;
  const parts = [
    [count(rs, (r) => r.mode === "drop"), "dropped"],
    [count(rs, (r) => r.mode !== "drop" && m.isRenamed(r)), "renamed"],
    [count(xs, (x) => x.added), "added"],
    [count(xs, (x) => !x.added && m.isChanged(x)), "extras changed"],
    [count(xs, (x) => x.mode === "drop"), "extras removed"],
  ];
  return (
    `${count(rs, (r) => r.mode === "change")} of ${rs.length} will be replaced` +
    parts.map(([n, label]) => (n ? `, ${n} ${label}` : "")).join("")
  );
});

const aliasKey = () => `emote-switcher:names:${setName.value}`;

function saveAliases() {
  const names = {};
  for (const { value: row } of rows.value)
    if (m.isRenamed(row)) names[row.original.id] = m.nameOf(row);
  localStorage.setItem(aliasKey(), JSON.stringify(names));
}

function loadAliases() {
  try {
    return JSON.parse(localStorage.getItem(aliasKey())) || {};
  } catch {
    return {};
  }
}

// Custom target names are remembered per base set and event.
const targetNameKey = () =>
  `emote-switcher:target:${setName.value}:${event.value}`;

function restoreTargetName() {
  targetNameInput.value = localStorage.getItem(targetNameKey()) || "";
}

export function commitTargetName() {
  const custom = targetNameInput.value.trim();
  if (custom) localStorage.setItem(targetNameKey(), custom);
  else localStorage.removeItem(targetNameKey());
  loadExtras();
}

export function setEvent(value) {
  event.value = value;
  restoreTargetName();
  loadExtras();
}

export function setAlias(card, alias) {
  update(card, (c) => ({ ...c, alias }));
  if (!m.isExtra(card.value)) saveAliases();
}

export const pickOption = (card, id) => update(card, (c) => m.pick(c, id));

export function setMode(card, mode) {
  const c = card.value;
  if (c.added && mode === "drop")
    extras.value = extras.value.filter((x) => x !== card);
  else card.value = m.setMode(c, mode);
}

export async function useEmoteUrl(card, url) {
  try {
    const emote = await api.getEmote(api.parseEmoteID(url));
    update(card, (c) => m.withCustom(c, emote));
  } catch (err) {
    update(card, (c) => ({ ...c, error: err.message }));
  }
}

export async function searchCard(card) {
  update(card, (c) => ({ ...c, searching: true, error: "" }));
  try {
    const { exact, variants } = await api.findVariantCandidates(
      m.baseEmote(card.value),
      api.EVENT_TAGS[event.value] ?? [],
    );
    update(card, (c) => ({
      ...m.mergeVariants(c, variants, exact),
      searching: false,
    }));
  } catch (err) {
    update(card, (c) => ({ ...c, searching: false, error: err.message }));
  }
}

export function addExtra(emote, customName) {
  const name = customName.trim() || emote.name;
  const error = m.nameError(name);
  if (error) throw new Error(error);
  const taken = [...rows.value, ...extras.value].some(
    ({ value: c }) => c.mode !== "drop" && m.nameOf(c) === name,
  );
  if (taken) throw new Error(`"${name}" is already used in the festive set`);
  extras.value = [
    ...extras.value,
    signal(m.newExtra({ id: emote.id, name }, true)),
  ];
  setStatus(`${name} will be added on save`);
}

function applyCurrent(emotes, exists) {
  const byName = new Map(emotes.map((e) => [e.name, e]));
  for (const row of rows.value)
    update(row, (r) => m.applyCurrent(r, byName, exists));
}

export async function loadExtras() {
  const name = targetSetName.value;
  batch(() => {
    extras.value = [];
    saved.value = new Map();
    savedExists.value = null;
    extrasSetName.value = name;
    applyCurrent([], false);
  });
  if (rows.value.length === 0) return;
  try {
    const existing = await api.findEmoteSetByName(userId.value, name);
    const emotes = existing ? (await api.getEmoteSet(existing.id)).emotes : [];
    if (name !== targetSetName.value) return;
    const originalNames = new Set(rows.value.map((r) => r.value.original.name));
    batch(() => {
      saved.value = new Map(emotes.map((e) => [e.name, e]));
      savedExists.value = !!existing;
      extras.value = emotes
        .filter((e) => !originalNames.has(e.name))
        .map((e) => signal(m.newExtra(e)));
      applyCurrent(emotes, !!existing);
    });
  } catch (err) {
    showError(err);
  }
}

// Without chosenSetId the channel from the input is loaded with its active set; with one, that set of the current channel.
export async function loadChannel(chosenSetId = "") {
  const name = chosenSetId ? channel.value : channelInput.value.trim();
  if (!name) return;
  busy.value = true;
  setStatus(`Loading ${name}...`);
  try {
    const { userId: id, activeSet } = await api.getChannel(name);
    const list = await api.getUserEmoteSets(id);
    const chosenId = chosenSetId || activeSet?.id || list[0]?.id;
    if (!chosenId) throw new Error(`${name} has no 7TV emote sets`);
    const set =
      chosenId === activeSet?.id ? activeSet : await api.getEmoteSet(chosenId);

    batch(() => {
      channel.value = name;
      userId.value = id;
      setId.value = set.id;
      setName.value = set.name;
      sets.value = list;
      activeSetId.value = activeSet?.id ?? "";
      restoreTargetName();
      const names = loadAliases();
      rows.value = set.emotes.map((e) =>
        signal(m.newRow(e, names[e.id] || "")),
      );
    });
    localStorage.setItem(LAST_CHANNEL_KEY, name);
    setStatus(`Loaded ${set.emotes.length} emotes from ${set.name}`);
  } catch (err) {
    showError(err);
  } finally {
    busy.value = false;
  }
  await loadExtras();
}

export async function findVariants() {
  if (rows.value.length === 0) await loadChannel();
  const list = rows.value;
  if (list.length === 0) return;

  const eventLabel = event.value || "other";
  const tags = api.EVENT_TAGS[event.value] ?? [];
  const label = `Searching ${eventLabel} variants`;
  let withVariants = 0;
  busy.value = true;
  try {
    for (const [i, row] of list.entries()) {
      showProgress(label, i, list.length);
      const { exact, variants } = await api.findVariantCandidates(
        row.value.original,
        tags,
      );
      update(row, (r) => m.mergeVariants(r, variants, exact));
      if (variants.length) withVariants++;
    }
    hideProgress();
    setStatus(`Found ${eventLabel} variants for ${withVariants} emotes`);
  } catch (err) {
    hideProgress();
    showError(err);
  } finally {
    busy.value = false;
  }
}

// Syncs emotes into the set called name, then reloads whatever that write affected.
async function writeSet(name, emotes, label, describe) {
  busy.value = true;
  showProgress(label);
  let reload = null;
  try {
    const { created } = await api.syncEmoteSet(
      token.value.trim(),
      userId.value,
      name,
      emotes,
      new Set(),
      (done, total) => showProgress(label, done, total),
    );
    hideProgress();
    setStatus(describe(created));
    reload =
      name === setName.value ? () => loadChannel(setId.value) : loadExtras;
  } catch (err) {
    hideProgress();
    showError(err);
  } finally {
    busy.value = false;
  }
  await reload?.();
}

// What saving would write: one entry per kept card, the counts for the confirm dialog, or the first problem found.
function planSave() {
  const entries = [];
  const seen = new Map();
  const counts = {
    changed: 0,
    dropped: 0,
    renamed: 0,
    added: 0,
    removing: 0,
    extrasChanged: 0,
  };
  const fail = (error) => ({ entries, counts, error });

  for (const { value: row } of rows.value) {
    if (row.mode === "drop") {
      counts.dropped++;
      continue;
    }
    const name = m.nameOf(row);
    const error = m.nameError(name);
    if (error) return fail(error);
    if (seen.has(name))
      return fail(
        `${seen.get(name)} and ${row.original.name} both use the name "${name}"`,
      );
    seen.set(name, row.original.name);
    if (row.mode === "change" && row.selected) counts.changed++;
    if (m.isRenamed(row)) counts.renamed++;
    entries.push({ id: m.targetOf(row).id, name });
  }

  const rowNames = new Set(seen.keys());
  for (const { value: extra } of extras.value) {
    if (extra.mode === "drop") {
      counts.removing++;
      continue;
    }
    // A base emote now uses this name, so its saved entry gets replaced anyway.
    if (!extra.added && rowNames.has(extra.saved.name)) continue;
    const name = m.nameOf(extra);
    const error = m.nameError(name);
    if (error) return fail(error);
    if (seen.has(name))
      return fail(`"${name}" is used more than once in the festive set`);
    seen.set(name, name);
    entries.push({ id: m.targetOf(extra).id, name });
    if (extra.added) counts.added++;
    else if (m.isChanged(extra)) counts.extrasChanged++;
  }
  return { entries, counts, error: null };
}

// How the saved festive set on 7TV would change when clicking Save.
export const pendingChanges = computed(() => {
  const { entries, error } = planSave();
  if (error) return { error };
  const current = saved.value;
  const added = entries.filter((e) => !current.has(e.name));
  const replaced = entries.filter((e) => {
    const s = current.get(e.name);
    return s && s.id !== e.id;
  }).length;
  const names = new Set(entries.map((e) => e.name));
  const removed = [...current.values()].filter((s) => !names.has(s.name));
  // An emote that disappears under one name and appears under another is a rename.
  const removedIds = removed.map((s) => s.id);
  let renamed = 0;
  for (const e of added) {
    const i = removedIds.indexOf(e.id);
    if (i !== -1) {
      removedIds.splice(i, 1);
      renamed++;
    }
  }
  return {
    total: entries.length,
    added: added.length - renamed,
    replaced,
    removed: removed.length - renamed,
    renamed,
  };
});

export async function save() {
  if (!token.value.trim()) return setStatus("Enter your 7TV token first", true);

  const { entries, counts, error } = planSave();
  if (error) return setStatus(error, true);
  const { changed, dropped, renamed, added, removing, extrasChanged } = counts;

  const name = targetSetName.value;
  if (name.length > 100)
    return setStatus("Set name can be at most 100 characters", true);
  const parts = [`${changed} replaced`];
  if (dropped) parts.push(`${dropped} dropped`);
  if (renamed) parts.push(`${renamed} renamed`);
  if (added) parts.push(`${added} added`);
  if (extrasChanged) parts.push(`${extrasChanged} extras changed`);
  if (removing) parts.push(`${removing} extras removed`);
  let message = `Save "${name}" with ${parts.join(", ")}?\nAn existing set with that name will be overwritten.`;
  if (name === setName.value && event.value)
    message += `\n\nWARNING: "${name}" is your base emote set, it will be overwritten.`;
  if (!confirm(message)) return;

  await writeSet(
    name,
    entries,
    `Saving ${name}`,
    (created) =>
      `${created ? "Created" : "Updated"} ${name}: ${changed} replaced, ${dropped} dropped` +
      (added ? `, ${added} added` : ""),
  );
}

export async function copySet({ emotes, name, sourceName, sourceChannel }) {
  if (name.length > 100)
    return setStatus("Set name can be at most 100 characters", true);
  if (!token.value.trim()) return setStatus("Enter your 7TV token first", true);
  let message = `Copy ${emotes.length} emotes from "${sourceName}" (${sourceChannel}) into "${name}" on ${channel.value}?\nAn existing set with that name will be overwritten.`;
  if (name === setName.value)
    message += `\n\nWARNING: "${name}" is the emote set you're currently editing.`;
  if (!confirm(message)) return;

  await writeSet(
    name,
    emotes,
    `Copying into ${name}`,
    (created) =>
      `${created ? "Created" : "Updated"} ${name} on ${channel.value} with ${emotes.length} emotes`,
  );
}
