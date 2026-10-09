import {
  EVENT_TAGS,
  hooks,
  parseEmoteID,
  getChannel,
  getUserEmoteSets,
  getEmoteSet,
  getEmote,
  findEmoteSetByName,
  findVariantCandidates,
  syncEmoteSet,
} from "./seventv.js";

const $ = (id) => document.getElementById(id);
const els = {
  channelForm: $("channel-form"),
  channel: $("channel"),
  load: $("load"),
  baseSet: $("base-set"),
  event: $("event"),
  token: $("token"),
  find: $("find"),
  filter: $("filter"),
  tabs: $("tabs"),
  count: $("count"),
  progressWrap: $("progress-wrap"),
  progressBar: $("progress-bar"),
  grid: $("grid"),
  summary: $("summary"),
  status: $("status"),
  save: $("save"),
  targetName: $("target-name"),
  extrasSection: $("extras-section"),
  extrasSet: $("extras-set"),
  extrasGrid: $("extras-grid"),
};
const copyEls = {
  form: $("source-form"),
  channel: $("source-channel"),
  load: $("source-load"),
  set: $("source-set"),
  name: $("copy-name"),
  copy: $("copy"),
  preview: $("copy-preview"),
  count: $("copy-count"),
  strip: $("preview-strip"),
};

const LAST_CHANNEL_KEY = "emote-switcher:channel";

const sourceSets = new Map();
let sourceEmotes = [];

const state = {
  channel: "",
  userId: "",
  setId: "",
  setName: "",
  rows: [],
  extras: [],
  tab: "all",
  // The festive set as currently saved on 7TV, by emote name.
  saved: new Map(),
  busy: false,
};

const emoteImg = (id, size = "2x") =>
  `https://cdn.7tv.app/emote/${encodeURIComponent(id)}/${size}.webp`;

// Big sets are rendered in pages; every card holds animated images, which is what eats memory.
const PAGE_SIZE = 60;
const PREVIEW_LIMIT = 120;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node[key] = value;
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle("error-text", isError);
}

function showProgress(label, done = 0, total = 0) {
  els.progressWrap.hidden = false;
  els.progressWrap.classList.toggle("indeterminate", total === 0);
  els.progressBar.style.width = total
    ? Math.round((done / total) * 100) + "%"
    : "0";
  setStatus(total ? `${label}... ${done} / ${total}` : `${label}...`);
}

function hideProgress() {
  els.progressWrap.hidden = true;
}

hooks.onRateLimit = (ms) =>
  setStatus(`Rate limited by 7TV, retrying in ${ms / 1000}s...`);

function setBusy(busy) {
  state.busy = busy;
  els.load.disabled = busy;
  els.find.disabled = busy;
  els.baseSet.disabled = busy || !state.channel;
  updateSummary();
}

function token() {
  return els.token.value.trim();
}

function emoteFigure(emote, extraClass = "", caption = emote?.name) {
  if (!emote) {
    return el(
      "figure",
      { class: `emote ${extraClass}` },
      el("div", { class: "placeholder" }),
      el("figcaption", {}, caption ?? "No change"),
    );
  }
  return el(
    "figure",
    { class: `emote ${extraClass}` },
    el("img", { src: emoteImg(emote.id), alt: emote.name, loading: "lazy" }),
    el("figcaption", { title: emote.name }, caption),
  );
}

const selectedOption = (row) =>
  row.options.find((o) => o.id === row.selected) || null;
const aliasOf = (row) => row.alias.trim() || row.original.name;
const isRenamed = (row) => aliasOf(row) !== row.original.name;

const aliasKey = () => `emote-switcher:names:${state.setName}`;

function saveAliases() {
  const names = {};
  for (const row of state.rows)
    if (isRenamed(row)) names[row.original.id] = aliasOf(row);
  localStorage.setItem(aliasKey(), JSON.stringify(names));
}

function loadAliases() {
  try {
    return JSON.parse(localStorage.getItem(aliasKey())) || {};
  } catch {
    return {};
  }
}

function hintFor(row) {
  if (row.mode === "drop")
    return el("div", { class: "hint remove" }, "Left out of the festive set");
  if (row.mode === "change" && selectedOption(row)?.current)
    return el("div", { class: "hint keep" }, "Currently in the festive set");
  if (selectedOption(row)?.custom)
    return el("div", { class: "hint" }, "Custom emote from URL");
  if (row.exact) return el("div", { class: "hint exact" }, "Exact name match");
  if (row.options.length)
    return el(
      "div",
      { class: "hint partial" },
      "Similar names, check before using",
    );
  if (row.searched)
    return el("div", { class: "hint" }, "No festive variant found");
  return null;
}

const MODES = [
  ["keep", "Keep", "Include the original emote"],
  ["change", "Change", "Replace with the selected emote"],
  ["drop", "Drop", "Leave this emote out of the festive set"],
];

function renderCard(row) {
  const target =
    row.mode === "change"
      ? selectedOption(row)
      : row.mode === "keep" && isRenamed(row)
        ? row.original
        : null;
  const caption = target
    ? aliasOf(row)
    : row.mode === "drop"
      ? "Left out"
      : undefined;

  const setMode = (mode) => {
    row.touched = true;
    row.mode = mode;
    if (mode === "change" && !selectedOption(row))
      row.selected = row.options[0]?.id ?? null;
    update(row);
  };
  const modes = el(
    "div",
    { class: "segmented" },
    ...MODES.map(([mode, label, title]) =>
      el(
        "button",
        {
          type: "button",
          class: mode + (row.mode === mode ? " active" : ""),
          disabled: mode === "change" && row.options.length === 0,
          title,
          onclick: () => setMode(mode),
        },
        label,
      ),
    ),
  );

  const head = el(
    "div",
    { class: "card-head" },
    el(
      "div",
      { class: "pair" },
      emoteFigure(row.original),
      el("span", { class: "arrow" }, "\u2192"),
      emoteFigure(target, "replacement", caption),
    ),
  );

  const nameInput = el("input", {
    type: "text",
    value: aliasOf(row),
    placeholder: row.original.name,
    spellcheck: false,
    class: isRenamed(row) ? "renamed" : "",
    oninput: (e) => {
      row.alias = e.target.value;
      saveAliases();
      updateExtras();
      updateSummary();
    },
    onchange: () => update(row),
  });
  const nameField = el(
    "label",
    { class: "name-field", title: "Name this emote gets in the festive set" },
    el("span", {}, "Name in set"),
    nameInput,
  );

  const options =
    row.options.length === 0
      ? null
      : el(
          "div",
          { class: "options" },
          ...row.options.map((option) =>
            el(
              "button",
              {
                type: "button",
                class:
                  "option" +
                  (row.mode === "change" && option.id === row.selected
                    ? " selected"
                    : ""),
                title: option.name,
                onclick: () => {
                  row.touched = true;
                  row.selected = option.id;
                  row.mode = "change";
                  update(row);
                },
              },
              el("img", {
                src: emoteImg(option.id),
                alt: option.name,
                loading: "lazy",
              }),
              el("span", {}, option.name),
              option.current
                ? el("em", {}, "current")
                : option.custom
                  ? el("em", {}, "custom")
                  : null,
            ),
          ),
        );

  const urlInput = el("input", {
    type: "text",
    placeholder: "Paste a 7TV emote URL",
    spellcheck: false,
  });
  const urlButton = el("button", { type: "submit" }, "Use");
  const form = el(
    "form",
    {
      class: "url-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const value = urlInput.value.trim();
        if (!value) return;
        urlButton.disabled = true;
        try {
          const emote = await getEmote(parseEmoteID(value));
          row.options = [
            ...row.options.filter((o) => !o.custom && o.id !== emote.id),
            { ...emote, custom: true },
          ];
          row.touched = true;
          row.selected = emote.id;
          row.mode = "change";
          row.error = "";
        } catch (err) {
          row.error = err.message;
        }
        update(row);
      },
    },
    urlInput,
    urlButton,
  );

  const cardClass =
    row.mode === "drop"
      ? " dropped"
      : row.mode === "change" || isRenamed(row)
        ? " changing"
        : "";
  return el(
    "article",
    { class: "card" + cardClass },
    head,
    modes,
    hintFor(row),
    options,
    nameField,
    form,
    el("div", { class: "error" }, row.error || ""),
  );
}

function update(row) {
  if (row.el) {
    const next = renderCard(row);
    row.el.replaceWith(next);
    row.el = next;
    row.el.hidden = !matchesFilter(row);
  }
  updateExtras();
  updateSummary();
}

function renderExtraCard(extra) {
  const toggle = el("input", {
    type: "checkbox",
    checked: extra.keep,
    onchange: (e) => {
      extra.keep = e.target.checked;
      const next = renderExtraCard(extra);
      extra.el.replaceWith(next);
      extra.el = next;
      updateExtras();
      updateSummary();
    },
  });
  return el(
    "article",
    { class: "card" + (extra.keep ? "" : " removing") },
    el(
      "div",
      { class: "card-head" },
      el("div", { class: "pair" }, emoteFigure(extra.emote)),
      el(
        "label",
        {
          class: "switch",
          title: extra.keep ? "Keep in festive set" : "Remove from festive set",
        },
        toggle,
        el("span"),
      ),
    ),
    el(
      "div",
      { class: "hint " + (extra.keep ? "keep" : "remove") },
      extra.keep ? "Kept in festive set" : "Will be removed on save",
    ),
  );
}

function renderExtras() {
  for (const extra of state.extras) extra.el = renderExtraCard(extra);
  els.extrasGrid.replaceChildren(...state.extras.map((x) => x.el));
  updateExtras();
  updateSummary();
}

// Mirrors the existing festive set: its emote under each row's name becomes a "current" option, and
// untouched rows default to Change (different emote there), Drop (name missing from the set) or Keep.
function applyCurrent(festiveEmotes, exists) {
  const byName = new Map(festiveEmotes.map((e) => [e.name, e]));
  for (const row of state.rows) {
    const hadCurrentSelected = row.options.some(
      (o) => o.current && o.id === row.selected,
    );
    row.options = row.options.filter((o) => !o.current);
    const current = byName.get(aliasOf(row));
    const differs = current && current.id !== row.original.id;
    if (differs) {
      row.options = [
        { ...current, current: true },
        ...row.options.filter((o) => o.id !== current.id),
      ];
    }

    if (!row.touched) {
      row.selected = differs ? current.id : null;
      row.mode = differs ? "change" : exists && !current ? "drop" : "keep";
    } else if (hadCurrentSelected) {
      row.selected = differs ? current.id : (row.options[0]?.id ?? null);
      if (!differs && row.mode === "change") row.mode = "keep";
    }
  }
  renderAll();
}

async function loadExtras() {
  const setName = targetSetName();
  state.extras = [];
  state.saved = new Map();
  applyCurrent([], false);
  renderExtras();
  if (state.rows.length === 0) return;
  try {
    const existing = await findEmoteSetByName(state.userId, setName);
    const emotes = existing ? (await getEmoteSet(existing.id)).emotes : [];
    if (setName !== targetSetName()) return;
    els.extrasSet.textContent = setName;
    state.saved = new Map(emotes.map((e) => [e.name, e]));
    const originalNames = new Set(state.rows.map((r) => r.original.name));
    state.extras = emotes
      .filter((e) => !originalNames.has(e.name))
      .map((e) => ({ emote: e, keep: true }));
    renderExtras();
    applyCurrent(emotes, !!existing);
  } catch (err) {
    setStatus("Error: " + err.message, true);
  }
}

let matches = [];
let rendered = 0;
const showMore = el(
  "button",
  { type: "button", class: "show-more", onclick: () => renderMore() },
  "Show more",
);
const pager = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) renderMore();
  },
  { rootMargin: "800px" },
);
els.grid.after(showMore);
pager.observe(showMore);

// Drops all card elements and renders the first count rows that match the filter.
function renderRows(count) {
  for (const row of state.rows) row.el = null;
  matches = state.rows.filter(matchesFilter);
  rendered = 0;
  if (state.rows.length === 0) {
    els.grid.replaceChildren(
      el("div", { class: "empty-state" }, "Load a channel to see its emotes"),
    );
  } else if (matches.length === 0) {
    els.grid.replaceChildren(
      el("div", { class: "empty-state" }, "No emotes match"),
    );
  } else {
    els.grid.replaceChildren();
  }
  renderMore(count);
  els.count.textContent = state.rows.length
    ? `${matches.length} of ${state.rows.length} emotes`
    : "";
}

function renderMore(count = PAGE_SIZE) {
  const next = matches.slice(rendered, rendered + count);
  for (const row of next) row.el = renderCard(row);
  els.grid.append(...next.map((r) => r.el));
  rendered += next.length;
  showMore.hidden = rendered >= matches.length;
  // Re-observing re-checks visibility, so a tall screen keeps filling until it's covered.
  if (!showMore.hidden) {
    pager.unobserve(showMore);
    pager.observe(showMore);
  }
}

// Keeps as many cards rendered as before, so saving or reloading doesn't jump back to the top.
function renderAll() {
  renderRows(Math.max(rendered, PAGE_SIZE));
  updateExtras();
  updateSummary();
}

function applyFilter() {
  renderRows(PAGE_SIZE);
  updateExtras();
}

function matchesFilter(row) {
  const q = els.filter.value.trim().toLowerCase();
  if (
    q &&
    !row.original.name.toLowerCase().includes(q) &&
    !aliasOf(row).toLowerCase().includes(q) &&
    !row.options.some((o) => o.name.toLowerCase().includes(q))
  )
    return false;
  switch (state.tab) {
    case "variants":
      return row.options.length > 0;
    case "none":
      return row.options.length === 0;
    case "changing":
      return row.mode === "change" || (row.mode === "keep" && isRenamed(row));
    case "dropped":
      return row.mode === "drop";
    case "unsaved":
      return differsFromSaved(row);
    default:
      return true;
  }
}

// Whether saving would change this emote's entry in the existing festive set.
function differsFromSaved(row) {
  const saved = state.saved.get(aliasOf(row));
  if (row.mode === "drop") return !!saved;
  const target =
    row.mode === "change" && row.selected ? row.selected : row.original.id;
  return saved?.id !== target;
}

function updateExtras() {
  const q = els.filter.value.trim().toLowerCase();
  // Extras whose name is now used by one of the base emotes get replaced anyway, so don't offer them.
  const aliases = new Set(
    state.rows.filter((r) => r.mode !== "drop").map(aliasOf),
  );
  let extrasLeft = 0;
  for (const extra of state.extras) {
    const taken = aliases.has(extra.emote.name);
    if (!taken) extrasLeft++;
    extra.el.hidden =
      taken || (!!q && !extra.emote.name.toLowerCase().includes(q));
  }
  els.extrasSection.hidden = extrasLeft === 0;
}

function defaultSetName() {
  return `${state.setName}-${els.event.value}`;
}

function targetSetName() {
  return els.targetName.value.trim() || defaultSetName();
}

// Custom names are remembered per base set and event.
const targetNameKey = () =>
  `emote-switcher:target:${state.setName}:${els.event.value}`;

function restoreTargetName() {
  els.targetName.value = localStorage.getItem(targetNameKey()) || "";
}

function updateSummary() {
  const changing = state.rows.filter((r) => r.mode === "change").length;
  const dropping = state.rows.filter((r) => r.mode === "drop").length;
  const renamed = state.rows.filter(
    (r) => r.mode !== "drop" && isRenamed(r),
  ).length;
  const removing = state.extras.filter((x) => !x.keep).length;
  els.summary.textContent = state.rows.length
    ? `${changing} of ${state.rows.length} will be replaced` +
      (dropping ? `, ${dropping} dropped` : "") +
      (renamed ? `, ${renamed} renamed` : "") +
      (removing ? `, ${removing} extras removed` : "")
    : "";
  els.targetName.placeholder = state.setName ? defaultSetName() : "Set name";
  els.save.textContent = "Save";
  els.save.disabled = state.busy || state.rows.length === 0;
  updateCopyButton();
}

function updateCopyButton() {
  copyEls.copy.disabled =
    state.busy ||
    sourceEmotes.length === 0 ||
    !state.channel ||
    !copyEls.name.value.trim();
  copyEls.copy.textContent = state.channel
    ? `Copy to ${state.channel}`
    : "Copy";
}

function setOptions(select, sets, selectedId, activeId) {
  select.replaceChildren(
    ...sets.map((set) =>
      el(
        "option",
        { value: set.id, selected: set.id === selectedId },
        set.name + (set.id === activeId ? " (active)" : ""),
      ),
    ),
  );
}

async function loadSourceSets() {
  const channel = copyEls.channel.value.trim();
  if (!channel) return;
  copyEls.load.disabled = true;
  setStatus(`Loading emote sets of ${channel}...`);
  try {
    const { userId, activeSet } = await getChannel(channel);
    const sets = await getUserEmoteSets(userId);
    sourceSets.clear();
    for (const set of sets) sourceSets.set(set.id, set);
    setOptions(copyEls.set, sets, activeSet?.id, activeSet?.id);
    copyEls.set.disabled = sets.length === 0;
    setStatus(`${channel} has ${sets.length} emote sets`);
    await previewSourceSet();
  } catch (err) {
    setStatus("Error: " + err.message, true);
  } finally {
    copyEls.load.disabled = false;
  }
}

async function previewSourceSet() {
  const id = copyEls.set.value;
  sourceEmotes = [];
  copyEls.preview.hidden = true;
  updateCopyButton();
  if (!id) return;
  copyEls.name.value = sourceSets.get(id)?.name || "";
  try {
    const set = await getEmoteSet(id);
    if (copyEls.set.value !== id) return;
    sourceEmotes = set.emotes;
    const hidden = set.emotes.length - PREVIEW_LIMIT;
    copyEls.count.textContent =
      `${set.emotes.length} emotes` +
      (hidden > 0 ? ` (showing the first ${PREVIEW_LIMIT})` : "");
    copyEls.strip.replaceChildren(
      ...set.emotes.slice(0, PREVIEW_LIMIT).map((e) =>
        el("img", {
          src: emoteImg(e.id, "1x"),
          alt: e.name,
          title: e.name,
          loading: "lazy",
        }),
      ),
    );
    copyEls.preview.hidden = false;
  } catch (err) {
    setStatus("Error: " + err.message, true);
  }
  updateCopyButton();
}

async function copySet() {
  const name = copyEls.name.value.trim();
  if (name.length > 100)
    return setStatus("Set name can be at most 100 characters", true);
  if (!token()) return setStatus("Enter your 7TV token first", true);
  const source = sourceSets.get(copyEls.set.value);
  let message = `Copy ${sourceEmotes.length} emotes from "${source?.name}" (${copyEls.channel.value.trim()}) into "${name}" on ${state.channel}?\nAn existing set with that name will be overwritten.`;
  if (name === state.setName)
    message += `\n\nWARNING: "${name}" is the emote set you're currently editing.`;
  if (!confirm(message)) return;

  setBusy(true);
  const label = `Copying into ${name}`;
  showProgress(label);
  try {
    const { created } = await syncEmoteSet(
      token(),
      state.userId,
      name,
      sourceEmotes,
      new Set(),
      (done, total) => showProgress(label, done, total),
    );
    hideProgress();
    setStatus(
      `${created ? "Created" : "Updated"} ${name} on ${state.channel} with ${sourceEmotes.length} emotes`,
    );
    if (name === state.setName) loadChannel(state.setId);
    else loadExtras();
  } catch (err) {
    hideProgress();
    setStatus("Error: " + err.message, true);
  } finally {
    setBusy(false);
  }
}

// Without setId the channel from the input is loaded with its active set; with one, that set of the current channel.
async function loadChannel(setId = "") {
  const name = setId ? state.channel : els.channel.value.trim();
  if (!name) return;
  setBusy(true);
  setStatus(`Loading ${name}...`);
  try {
    const { userId, activeSet } = await getChannel(name);
    const sets = await getUserEmoteSets(userId);
    const chosenId = setId || activeSet?.id || sets[0]?.id;
    if (!chosenId) throw new Error(`${name} has no 7TV emote sets`);
    const set =
      chosenId === activeSet?.id ? activeSet : await getEmoteSet(chosenId);

    state.channel = name;
    state.userId = userId;
    state.setId = set.id;
    state.setName = set.name;
    restoreTargetName();
    localStorage.setItem(LAST_CHANNEL_KEY, name);
    setOptions(els.baseSet, sets, set.id, activeSet?.id);

    const names = loadAliases();
    state.rows = set.emotes.map((e) => ({
      original: e,
      alias: names[e.id] || "",
      options: [],
      selected: null,
      mode: "keep",
      exact: false,
      searched: false,
      error: "",
    }));
    rendered = 0;
    renderAll();
    setStatus(`Loaded ${set.emotes.length} emotes from ${set.name}`);
  } catch (err) {
    setStatus("Error: " + err.message, true);
  } finally {
    setBusy(false);
  }
  await loadExtras();
}

function mergeVariants(row, found, exact) {
  const kept = row.options.filter((o) => o.current || o.custom);
  const keepSelection =
    row.mode === "change" && kept.some((o) => o.id === row.selected);
  const current = kept.find((o) => o.current);
  const candidates = found.filter((c) => !kept.some((o) => o.id === c.id));
  row.options = [
    ...kept.filter((o) => o.current),
    ...candidates,
    ...kept.filter((o) => o.custom),
  ];
  row.exact = exact;
  row.searched = true;
  if (!keepSelection && !row.touched && row.mode !== "drop") {
    row.selected = current ? current.id : (candidates[0]?.id ?? null);
    row.mode = current || exact ? "change" : "keep";
  }
}

async function findVariants() {
  if (state.rows.length === 0) await loadChannel();
  if (state.rows.length === 0) return;

  const event = els.event.value;
  const tags = EVENT_TAGS[event];
  const label = `Searching ${event} variants`;
  let withVariants = 0;
  setBusy(true);
  try {
    for (const [i, row] of state.rows.entries()) {
      showProgress(label, i, state.rows.length);
      const { exact, partial } = await findVariantCandidates(
        row.original,
        tags,
      );
      const found = exact ? [exact] : partial.slice(0, 10);
      mergeVariants(row, found, !!exact);
      if (found.length) withVariants++;
    }
    hideProgress();
    setStatus(`Found ${event} variants for ${withVariants} emotes`);
  } catch (err) {
    hideProgress();
    setStatus("Error: " + err.message, true);
  } finally {
    renderAll();
    setBusy(false);
  }
}

async function save() {
  if (!token()) return setStatus("Enter your 7TV token first", true);

  const entries = [];
  const seen = new Map();
  let changed = 0,
    dropped = 0,
    renamed = 0;
  for (const row of state.rows) {
    if (row.mode === "drop") {
      dropped++;
      continue;
    }
    const alias = aliasOf(row);
    if (/\s/.test(alias) || alias.length > 100)
      return setStatus(
        `"${alias}" is not a valid name: no spaces, max 100 characters`,
        true,
      );
    if (seen.has(alias))
      return setStatus(
        `${seen.get(alias)} and ${row.original.name} both use the name "${alias}"`,
        true,
      );
    seen.set(alias, row.original.name);

    const replace = row.mode === "change" && row.selected;
    if (replace) changed++;
    if (isRenamed(row)) renamed++;
    entries.push({ id: replace ? row.selected : row.original.id, name: alias });
  }
  const keepExtras = new Set(
    state.extras.filter((x) => x.keep).map((x) => x.emote.name),
  );
  const removing = state.extras.length - keepExtras.size;
  const name = targetSetName();
  if (name.length > 100)
    return setStatus("Set name can be at most 100 characters", true);
  const parts = [`${changed} replaced`];
  if (dropped) parts.push(`${dropped} dropped`);
  if (renamed) parts.push(`${renamed} renamed`);
  if (removing) parts.push(`${removing} extras removed`);
  let message = `Save "${name}" with ${parts.join(", ")}?\nAn existing set with that name will be overwritten.`;
  if (name === state.setName)
    message += `\n\nWARNING: "${name}" is your base emote set, it will be overwritten.`;
  if (!confirm(message)) return;

  setBusy(true);
  const label = `Saving ${name}`;
  showProgress(label);
  try {
    const { created } = await syncEmoteSet(
      token(),
      state.userId,
      name,
      entries,
      keepExtras,
      (done, total) => showProgress(label, done, total),
    );
    hideProgress();
    setStatus(
      `${created ? "Created" : "Updated"} ${name}: ${changed} replaced, ${dropped} dropped`,
    );
    loadExtras();
  } catch (err) {
    hideProgress();
    setStatus("Error: " + err.message, true);
  } finally {
    setBusy(false);
  }
}

els.channelForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loadChannel();
});
copyEls.form.addEventListener("submit", (e) => {
  e.preventDefault();
  loadSourceSets();
});
copyEls.set.addEventListener("change", previewSourceSet);
copyEls.name.addEventListener("input", updateCopyButton);
copyEls.copy.addEventListener("click", copySet);
els.find.addEventListener("click", findVariants);
els.save.addEventListener("click", save);
els.event.addEventListener("change", () => {
  restoreTargetName();
  updateSummary();
  loadExtras();
});
els.targetName.addEventListener("change", () => {
  const custom = els.targetName.value.trim();
  if (custom) localStorage.setItem(targetNameKey(), custom);
  else localStorage.removeItem(targetNameKey());
  loadExtras();
});
els.baseSet.addEventListener("change", () => loadChannel(els.baseSet.value));
els.filter.addEventListener("input", applyFilter);
els.tabs.addEventListener("click", (e) => {
  const tab = e.target.closest("button")?.dataset.tab;
  if (!tab) return;
  state.tab = tab;
  for (const b of els.tabs.children)
    b.classList.toggle("active", b.dataset.tab === tab);
  applyFilter();
});

// ?channel=name&event=christmas preselects; otherwise the last loaded channel is reused.
const params = new URLSearchParams(location.search);
const startEvent = params.get("event");
if (startEvent && EVENT_TAGS[startEvent]) els.event.value = startEvent;
els.channel.value =
  params.get("channel") || localStorage.getItem(LAST_CHANNEL_KEY) || "";
renderAll();
if (els.channel.value) loadChannel();
