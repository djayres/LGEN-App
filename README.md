# LGEN phone app (Android)

Swipe between seven pages: Chart, Signal, Levels, Watchlist, Dates, Test 4, News.

- **Install / update:** on your phone open
  https://github.com/djayres/LGEN-App/releases/latest/download/LGEN-App.apk
- **Live prices:** Yahoo Finance, when the app opens and every 15 minutes while the London market is open.
- **Buy/sell status, watchlist, Test 4:** read from `data/` in this repo, which the 7:30am online check updates.
  The app keeps the last good copy, and one is built into the APK, so it still opens offline.
- **Extra company dates** (trading updates, AGMs): add them to `data/events.js` on GitHub. The app reads it each
  time it opens, so no new APK is needed.
- **Build:** every push to `main` (except changes in `data/`) builds a new APK with GitHub Actions and
  replaces the "latest" release. You can also run **Build Android app** by hand from the Actions tab.
- `signing/debug.keystore` is a throwaway debug key kept fixed so each new build installs over the old one.
