// Talks to the 7TV and decapi.me APIs directly from the browser; both allow cross-origin requests.
const REST = "https://7tv.io/v3";
const GQL = "https://7tv.io/v3/gql";

export const EVENT_TAGS = {
  christmas: [
    "christmas",
    "xmas",
    "holiday",
    "holidays",
    "santa",
    "santahat",
    "navidad",
    "festive",
    "reindeer",
  ],
  halloween: ["halloween", "spooky", "spoopy", "pumpkin", "ween"],
  easter: ["easter", "páscoa", "pascoa", "egg", "eggs"],
};

const channelPattern = /^[A-Za-z0-9_]{1,25}$/;
// Bare 7TV emote ID, or one inside a 7tv.app / cdn.7tv.app URL.
const emoteIDPattern = /(?:^|\/)([0-9A-Za-z]{24,26})(?:$|[/?#])/;

const SEARCH_QUERY = `query SearchEmotes($query: String!, $page: Int, $limit: Int, $filter: EmoteSearchFilter) {
  emotes(query: $query, page: $page, limit: $limit, filter: $filter) {
    items { id name tags }
  }
}`;
const CREATE_SET_MUTATION = `mutation CreateEmoteSet($user_id: ObjectID!, $data: CreateEmoteSetInput!) {
  createEmoteSet(user_id: $user_id, data: $data) { id }
}`;
const ADD_EMOTE_MUTATION = `mutation AddEmote($set_id: ObjectID!, $emote_id: ObjectID!, $name: String) {
  emoteSet(id: $set_id) { emotes(id: $emote_id, action: ADD, name: $name) { id } }
}`;
const REMOVE_EMOTE_MUTATION = `mutation RemoveEmote($set_id: ObjectID!, $emote_id: ObjectID!) {
  emoteSet(id: $set_id) { emotes(id: $emote_id, action: REMOVE) { id } }
}`;

export const hooks = { onRateLimit: null };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(doRequest) {
  let backoff = 2000;
  for (let attempt = 1; ; attempt++) {
    const result = await doRequest();
    if (!result.rateLimited || attempt === 6) return result;
    hooks.onRateLimit?.(backoff);
    await sleep(backoff);
    backoff *= 2;
  }
}

async function rest(path) {
  const { res } = await withRetry(async () => {
    const res = await fetch(REST + path);
    return { res, rateLimited: res.status === 429 };
  });
  if (res.status === 404) throw new Error("Not found on 7TV");
  if (!res.ok) throw new Error(`7TV returned status ${res.status}`);
  return res.json();
}

async function gql(query, variables, token = "") {
  const { res, body } = await withRetry(async () => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(GQL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => null);
    const message = body?.errors?.[0]?.message || "";
    return {
      res,
      body,
      rateLimited:
        res.status === 429 || message.includes("RATE_LIMIT_EXCEEDED"),
    };
  });
  const message = body?.errors?.[0]?.message;
  if (message) throw new Error(`7TV: ${message}`);
  if (res.status === 401) throw new Error("7TV rejected the token");
  if (!res.ok) throw new Error(`7TV returned status ${res.status}`);
  return body.data;
}

export function parseEmoteID(input) {
  const match = emoteIDPattern.exec(input.trim());
  if (!match) throw new Error("Not a 7TV emote URL");
  return match[1];
}

async function resolveTwitchID(username) {
  if (!channelPattern.test(username)) throw new Error("Invalid channel name");
  const res = await fetch(
    `https://decapi.me/twitch/id/${encodeURIComponent(username)}`,
  );
  const text = (await res.text()).trim();
  if (!res.ok || !/^\d+$/.test(text))
    throw new Error(`Twitch user "${username}" not found`);
  return text;
}

const toEmote = (e) => ({ id: e.id, name: e.name });
const toSet = (s) => ({
  id: s.id,
  name: s.name,
  emotes: (s.emotes || []).map(toEmote),
});

// Returns the channel's 7TV user ID and its active emote set (with emotes), if any.
export async function getChannel(username) {
  const twitchID = await resolveTwitchID(username);
  let data;
  try {
    data = await rest(`/users/twitch/${twitchID}`);
  } catch (err) {
    if (err.message === "Not found on 7TV")
      throw new Error(`${username} has no 7TV account`);
    throw err;
  }
  return {
    userId: data.user.id,
    activeSet: data.emote_set ? toSet(data.emote_set) : null,
  };
}

export async function getUserEmoteSets(userId) {
  const data = await rest(`/users/${encodeURIComponent(userId)}`);
  return (data.emote_sets || []).map((s) => ({ id: s.id, name: s.name }));
}

export async function getEmoteSet(id) {
  return toSet(await rest(`/emote-sets/${encodeURIComponent(id)}`));
}

export async function getEmote(id) {
  return toEmote(await rest(`/emotes/${encodeURIComponent(id)}`));
}

export async function findEmoteSetByName(userId, name) {
  const sets = await getUserEmoteSets(userId);
  return sets.find((s) => s.name === name) || null;
}

// Festive variants of emote: an exact (case-insensitive) name match if one exists, otherwise names containing it.
export async function findVariantCandidates(emote, tags) {
  const data = await gql(SEARCH_QUERY, {
    query: emote.name,
    page: 1,
    limit: 100,
    filter: { exact_match: false, ignore_tags: true },
  });
  const name = emote.name.toLowerCase();
  const wanted = tags.map((t) => t.toLowerCase());
  const partial = [];
  for (const item of data.emotes.items) {
    if (!(item.tags || []).some((t) => wanted.includes(t.toLowerCase())))
      continue;
    const itemName = item.name.toLowerCase();
    if (item.id === emote.id || !itemName.includes(name)) continue;
    if (itemName === name) return { exact: toEmote(item), partial: [] };
    partial.push(toEmote(item));
  }
  return { exact: null, partial };
}

// Makes the user's set called name contain exactly emotes (each id under its name), creating it if needed.
// Emotes only in the existing set are removed unless their name is in keepExtras.
export async function syncEmoteSet(
  token,
  userId,
  name,
  emotes,
  keepExtras,
  onProgress,
) {
  if (!token) throw new Error("Enter your 7TV token first");

  const found = await findEmoteSetByName(userId, name);
  let setId,
    existing = [],
    created = false;
  if (found) {
    setId = found.id;
    existing = (await getEmoteSet(setId)).emotes;
  } else {
    const data = await gql(
      CREATE_SET_MUTATION,
      { user_id: userId, data: { name } },
      token,
    );
    setId = data.createEmoteSet.id;
    created = true;
  }

  const wanted = new Map(emotes.map((e) => [e.name, e.id]));
  const present = new Set();
  const toRemove = [];
  for (const emote of existing) {
    if (wanted.get(emote.name) === emote.id) {
      present.add(emote.name);
    } else if (wanted.has(emote.name) || !keepExtras.has(emote.name)) {
      toRemove.push(emote);
    }
  }
  const toAdd = emotes.filter((e) => !present.has(e.name));

  const total = toRemove.length + toAdd.length;
  let done = 0;
  onProgress?.(done, total);
  for (const emote of toRemove) {
    try {
      await gql(
        REMOVE_EMOTE_MUTATION,
        { set_id: setId, emote_id: emote.id },
        token,
      );
    } catch (err) {
      throw new Error(`Removing ${emote.name}: ${err.message}`);
    }
    onProgress?.(++done, total);
  }
  for (const emote of toAdd) {
    try {
      await gql(
        ADD_EMOTE_MUTATION,
        { set_id: setId, emote_id: emote.id, name: emote.name },
        token,
      );
    } catch (err) {
      throw new Error(`Adding ${emote.name}: ${err.message}`);
    }
    onProgress?.(++done, total);
  }
  return { setId, created };
}
