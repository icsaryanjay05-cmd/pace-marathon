# PACE Marathon Training Hub V5 — Deployment and migration guide

**Architecture:** static GitHub Pages frontend + Google Identity Services (Sign in with Google) + Apps Script HTML-service iframe bridge + your existing private Google Sheet. The running journal stays local-first.

**Read this first:** this is a personal-use application starter, **not** a fully audited multi-user authentication platform. Apps Script validates ID tokens using Google's `tokeninfo` endpoint, which Google recommends primarily for development/debugging rather than high-volume production. For commercial or multi-user use, move to a dedicated backend using a supported Google Auth JWT-verification library and a proper database.

## A. Backup V4.1 before changing anything

1. Open V4.1 on every device that might have unsynced entries and click **Backup**. Store the resulting JSON exports safely. If devices differ, do not assume the last device has all records.
2. In your existing Google Sheet, choose **File → Make a copy** and keep that copy separate.
3. Verify your original Google Sheet contains the `Runs`, `Meals`, `Tasks`, `Water`, `Plan`, `Recovery`, `Races`, and `RaceChecks` sheets. Take note of their contents and the current `Meta!B2` revision.
4. Close all old PACE V3/V4/V4.1 tabs during migration. V5's backend deliberately **rejects old-version saves**.
5. Don't delete any of your earlier GitHub or Apps Script projects. This is an in-place update, not a new spreadsheet.

## B. Create a Google OAuth web client ID (required for V5)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Under **Google Auth Platform**, configure **Branding** and **Audience** for an app named `PACE Marathon Training Hub`. For a personal test app, external Testing is fine; add your Google account to the **Test users** list if prompted. Google changes its UI periodically.
3. Create an **OAuth client ID** with application type **Web application**.
4. In **Authorized JavaScript origins**, add the *origin* where PACE is hosted, for example `https://YOUR_GITHUB_USERNAME.github.io`. Do **not** add `/pace-repo/` or a trailing slash. If using a custom domain, add its exact HTTPS origin too.
5. Copy the Client ID ending in `.apps.googleusercontent.com`. A client **ID is public**; never put the OAuth **client secret** in GitHub or in the browser. No OAuth redirect URL is required for the on-page Google Identity Services button used here.

Reference: [Google Sign in button setup](https://codelabs.developers.google.com/codelabs/sign-in-with-google-button).

## C. Upgrade Google Apps Script **before GitHub Pages**

1. Open your existing PACE Google Sheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with the new `apps-script/Code.gs` from this release.
3. Replace the contents of existing HTML file `Bridge` with `apps-script/Bridge.html` (in the Apps Script sidebar, the file is named `Bridge.html`; create with **+ → HTML → Bridge** if necessary).
4. Under **Project Settings → Script Properties**, set these EXACT property names:

   | Script property | Example / purpose |
   |---|---|
   | `PACE_GOOGLE_CLIENT_ID` | `1234567890-abcde.apps.googleusercontent.com` (must match Google Cloud and the website) |
   | `PACE_ALLOWED_EMAILS` | `your-google-account@gmail.com` (comma-separated list, strictly controlled) |
   | `PACE_ALLOWED_ORIGINS` | `https://YOUR_GITHUB_USERNAME.github.io` (exact origin without path) |
   | `PACE_ALLOWED_SUBS` | Optional comma-separated Google `sub` identifiers, recommended instead of email for third-party/non-Gmail Google identities |
   | `PACE_SHEET_ID` | Automatically set by `initializePace`; do not enter a different spreadsheet |

   **Important:** the V4 private `PACE_ACCESS_KEY` is **no longer used**. Remove it once you confirm V5 works; don't expose the old key in the frontend.

5. Select `initializePace` in the Apps Script editor → **Run**. Authorize the script, including permission to access the bound spreadsheet and make external requests (Google token verification). It **appends** the new `Runs.humidity` column and adds optional `Settings.heatTemp` and `Settings.heatHumidity` records when saved; it does not delete existing user data.
6. In **Deploy → Manage deployments**, edit your existing Web app deployment and select **New version → Deploy**. Keep **Execute as: Me** and **Who has access: Anyone** for this bridge pattern. Anyone may reach the HTML endpoint, but backend `paceRpc` requires a valid Google ID token issued to your specific OAuth client ID and an allowlisted account. **Restrict your Sheet sharing separately.**
7. Copy the Apps Script `/exec` web app URL, such as `https://script.google.com/macros/s/.../exec`. The spreadsheet URL is NOT the deployment URL. Editing the existing deployment usually preserves the URL; creating a fresh deployment produces a new URL.

The bridge uses `ALLOWALL` so GitHub Pages can embed it. It checks the exact origin inside the bridge and verifies Google identity server-side for every load/save. `ALLOWALL` removes frame restrictions; Google advises site owners to implement their own clickjacking protection. Do **not** embed arbitrary interactive content in `Bridge.html`.

## D. Update GitHub Pages

Upload these items from **PACE_V5_GitHub_Frontend.zip** to the **same folder** in your existing GitHub Pages repository:

```
index.html
styles.css
motion.css
v4.css
race.css
v5.css                   NEW
plan.js
importers.js
v5.js                    NEW
app.js                   UPDATED
motion.js
cloud.js                 UPDATED
pwa.js                   NEW
sw.js                    NEW
manifest.webmanifest     NEW
icons/icon-192.png       NEW
icons/icon-512.png       NEW
```

Commit the files. In repository **Settings → Pages**, continue to publish from `main` / `/ (root)` or your preexisting configured branch/folder. All paths are relative, so a normal GitHub Pages repo subpath works. Load the site over **HTTPS**; service workers cannot be installed on ordinary `file://` pages.

**Service worker update note:** V5 caches the website code for offline access. After subsequent releases, bump the cache name in `sw.js` and refresh. Do not cache private API responses or Google auth scripts.

## E. Connect Google Sign-in and choose your data copy

1. Open the updated site and confirm the splash screen reads **V5**.
2. Open **Cloud sync**. Enter the `/exec` URL and your Google Web Client ID.
3. Click **Prepare Google sign-in**. Click the resulting official **Sign in with Google** button and choose the exact allowlisted account.
4. The server verifies the Google ID token's claims and access rights. If the Sheet contains a copy, the interface shows a summary before you decide what to keep. On the **first connection**, choose either **Use cloud data** (existing Google Sheet) or **Upload browser data** (local snapshot). **Upload browser data overwrites the entire cloud snapshot** after explicit confirmation; it does not merge field-by-field.
5. After an edit, wait for **Cloud synced**. Check the Google Sheet tab and refresh the site to confirm that data reloads. Test `Runs.humidity` and `Settings.heatTemp`/`Settings.heatHumidity` by logging a run/weather scenario.
6. Sign in on your phone with the same allowlisted Google account and choose the cloud copy the first time. The data is one private Sheet, not per-user Sheets.

### Offline edit and conflict rules

- Running, meals, recovery, schedule, races and heat scenarios save in the browser's localStorage even without internet. They do not require a running backend to be entered.
- App assets are pre-cached by the service worker after the first online HTTPS visit. External Google Sign-in cannot work while offline.
- When edits are pending and the user returns online **while a valid Google session is still available**, PACE checks the cloud revision. If it still matches this device's last successfully synced version, PACE uploads the pending local snapshot; otherwise **it blocks the overwrite** and asks for manual resolution.
- After page reload, the Google ID token is no longer stored. You must select your account again to resume sync. No token, password, or access key is committed to GitHub or stored long-term.
- If two local tabs or devices edited divergent copies, the app does **not** automatically merge individual records. Export both JSON backups before choosing either copy. Avoid running multiple editing tabs on the same device.
- `localStorage` is **not encrypted** and can be cleared by browser settings or private-browsing behavior. Export routine JSON backups and protect private GPS route locations.

## F. What V5 adds and how to use it

**Training coach:** evaluates 7-day mileage versus prior 7 days, recorded sleep, soreness, fatigue and logged session-RPE. Produces explainable *suggestions* rather than diagnoses or automatic workout prescriptions. Missing data are not treated as normal.

**GPS & splits:** import an activity using Run journal → FIT/GPX/CSV. GPS chart is a relative route shape, *not* a street basemap. If splits are available, V5 compares first/later split groups, split variation and per-km pace. No valid heart-rate time series → no cardiac-drift estimate.

**Installable PWA:** in Chrome/Edge on Android and desktop, use the install prompt when offered. On iPhone Safari, use **Share → Add to Home Screen**. After the first online visit, the app shell can open offline. Data changes sync later as described above; Google Sign-in itself requires internet.

**Weekly reports:** choose a Monday–Sunday week, inspect distance, completion, load, meal and check-in coverage, and print or download a Markdown report. Reports are on-demand; V5 does not email them or schedule notifications automatically.

**Heat & humidity assistant:** manually enter air temperature and humidity. The rough heat-index model is only displayed for 27 °C+ and 40%+ relative humidity; it is **not** a WBGT forecast and does not quantify personalized safe pace. Stop exercising and seek assistance for concerning heat-illness symptoms.

**Unchanged V4.1 capabilities:** animated opening, 2026 marathon calendar, strength days, COROS file import, nutrition, hydration, recovery, goals, run journal, editable Race Dashboard with split targets/checklists, JSON backup and Google Sheets version checks.

## G. Troubleshooting

| Issue | What to check |
|---|---|
| Google sign-in button doesn't appear | Internet, OAuth client ID, Google Identity Services script, browser extensions, authorized JavaScript origin |
| `This Google account is not allowlisted` | Signed-in email matches `PACE_ALLOWED_EMAILS` exactly, or its Google subject ID is in `PACE_ALLOWED_SUBS` |
| `Google token is not valid for this PACE app` | Google Cloud Web Client ID must match `PACE_GOOGLE_CLIENT_ID`; sign in again if expired |
| `PACE V5 client required` | Old V4/V4.1 browser tab still trying to save. Close it and reload V5; export its local data first if necessary |
| Bridge timeout / unavailable | Correct `/exec` URL, web app deployment access, `PACE_ALLOWED_ORIGINS` exact, browser iframe protections / third-party cookie restrictions |
| Google Apps Script permissions | Re-run Apps Script authorization, then redeploy a **new version**. UrlFetchApp needs external-request permissions |
| App offline fails on first visit | Open once while online over HTTPS so service worker can cache assets. `file://` is not supported |
| Blank or stale site after upgrade | Check GitHub Pages deployment, hard-refresh, then inspect `sw.js` cache version and service worker updates |
| Another device has newer data | Export the browser snapshot, review cloud snapshot, resolve conflict manually; never discard a copy before backing it up |

### Security and deployment scope

This is a **single-tenant personal app**: all allowlisted accounts have full read/write access to the owner's Google Sheet. Account identity is verified on each RPC via Google `tokeninfo`, including audience, issuer, expiry and verified-email/subject checks; the method is not designed for high-volume use. If you eventually publish PACE as a public service, migrate to a dedicated backend (e.g., Cloud Run/Firebase Auth with official JWT libraries), per-user authorization and datastore, audit logging, rate limiting, and encrypted server-side storage.

## H. Verification checklist

- [ ] V4.1 JSON backups downloaded and Sheet copied
- [ ] OAuth consent configuration and Web Client ID created
- [ ] `PACE_GOOGLE_CLIENT_ID`, `PACE_ALLOWED_EMAILS`, `PACE_ALLOWED_ORIGINS` saved in Apps Script properties
- [ ] `initializePace` run successfully; no old records lost
- [ ] Apps Script redeployed to **new version**
- [ ] V5 files committed and GitHub Pages deployed
- [ ] Google sign-in succeeds using allowlisted account
- [ ] A test run saves to `Runs` with the appended humidity column
- [ ] Heat settings persist after reload from Sheets
- [ ] Race checklist and prior workouts still appear
- [ ] PWA installs on HTTPS and loads its cached shell offline
- [ ] Make one offline test edit; reconnect and confirm no conflict before uploading

**Testing performed in this package:** JavaScript syntax, simulated Apps Script account authorization and Sheet read/write, legacy schema guard, revision conflicts, browser DOM interface checks at 1440px and 390px, and file-manifest checks. A live Google OAuth session, real Script deployment, and end-to-end network/service-worker behavior still require your own hosted environment.
