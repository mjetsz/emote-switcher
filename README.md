# Emote Switcher

Swap your 7TV emotes for festive variants (Christmas, Halloween, Easter) and save them as a separate emote set, without touching your main set.

**Live:** https://mjetsz.github.io/emote-switcher/

## Features

- **Festive variants**: searches 7TV for every emote in your set and suggests tagged variants with the same name. Exact name matches are picked automatically; similar names are shown for you to choose.
- **Keep / Change / Drop** per emote: keep the original, swap in a variant, or leave it out of the festive set.
- **Custom emotes**: paste any 7TV emote URL to use it as a replacement.
- **Rename**: give an emote a different name in the festive set.
- **Picks up where you left off**: an existing festive set is read on load, so its current emotes are preselected and saving again doesn't undo earlier choices.
- **Copy sets**: copy any emote set from another channel into your account.
- **Any base set**: choose which of your emote sets to make festive.

Festive sets are named `<base set>-<event>` by default, e.g. `mjets-christmas`; you can pick another name in the **Save as** field. Saving to a name that already exists updates that set in place.

## Usage

1. Enter your Twitch channel and click **Load**.
2. Pick an event and click **Find festive variants**.
3. Review the cards and choose Keep / Change / Drop.
4. Paste your 7TV token and click **Save**.

You can preselect a channel and event with URL parameters:

```
https://mjetsz.github.io/emote-switcher/?channel=mjets&event=christmas
```

### Getting your 7TV token

1. Open [7tv.app](https://7tv.app) and log in.
2. Press `F12` and open the **Console** tab.
3. Run `localStorage.getItem("7tv-token")` and copy the result without the quotes.

Treat the token like a password: anyone with it can edit your 7TV account. The page keeps it in memory only and sends it nowhere but `7tv.io` (enforced by a Content Security Policy).

## Running locally

Built with [Preact](https://preactjs.com) + [Signals](https://preactjs.com/guide/v10/signals) and [Vite](https://vite.dev). Requires Node.js.

```powershell
npm install
npm run dev       # dev server with live reload
npm run build     # production build into dist/
npm run preview   # serve the production build (with the Content Security Policy)
```

The Content Security Policy is only added to the production build, since the dev server needs inline styles and a websocket.

## Project structure

```
index.html               page shell, Vite entry
vite.config.js           Vite config, injects the Content Security Policy at build time
public/logo.svg          logo and favicon
src/
  main.jsx               mounts the app
  App.jsx                page layout: header, logo and the sections below
  api/seventv.js         7TV / decapi.me API calls, variant matching, emote set syncing
  state/
    model.js             card logic (names, targets, variant merging), pure functions
    store.js             app state as signals, plus actions (load, search, save, copy)
  lib/cx.js              joins class names
  styles/base.css        global: theme variables, layout (.container, .panel, .grid, .field), inputs and buttons
  sections/              page areas, used once by App:
    Controls             channel / set / event / token panel
    CopyPanel            copy a set from another channel
    Toolbar              search, tabs, count
    ExtrasSection        "Only in <set>" section and the add-emote form
    EmoteGrid            paged grid of base emotes
    SaveBar              bottom bar: changes vs base, changes on save, status and save button
  components/            reusable UI pieces:
    EmoteCard            one emote card (base or festive-only)
    EmoteFigure          emote image with caption
    OptionButton         pickable emote tile
    Segmented            Keep / Change / Drop switch
    NameField            "Name in set" input
    UrlForm              "Paste a 7TV emote URL" form
    Hint                 coloured status line

Every .jsx in sections/ and components/ has a scoped CSS Module (*.module.css) next to it.
.github/workflows/pages.yml   builds and deploys to GitHub Pages on push to main
```

To add an event, add its tags to `EVENT_TAGS` in [src/api/seventv.js](src/api/seventv.js) and an entry to `EVENTS` in [src/sections/Controls.jsx](src/sections/Controls.jsx).

## Notes

- Uses the 7TV v3 REST and GraphQL APIs, and [decapi.me](https://decapi.me) to resolve Twitch usernames.
- 7TV rate-limits requests; the app retries automatically, but searching variants for large sets can take a while.
