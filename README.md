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

The site is plain HTML/CSS/JS with no build step. ES modules don't load from `file://`, so serve the folder:

```powershell
python -m http.server 8090 --directory docs
```

Then open http://127.0.0.1:8090.

## Project structure

```
docs/
  index.html   page markup
  styles.css   styling
  app.js       UI and page state
  seventv.js   7TV / decapi.me API calls, variant matching, emote set syncing
.github/workflows/pages.yml   deploys docs/ to GitHub Pages on push to main
```

To add an event, add its tags to `EVENT_TAGS` in [docs/seventv.js](docs/seventv.js) and an `<option>` to the event dropdown in [docs/index.html](docs/index.html).

## Notes

- Uses the 7TV v3 REST and GraphQL APIs, and [decapi.me](https://decapi.me) to resolve Twitch usernames.
- 7TV rate-limits requests; the app retries automatically, but searching variants for large sets can take a while.
