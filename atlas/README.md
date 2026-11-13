# Atlas — Interactive Political Map

A Next.js 16 App Router application rebuilt from the supplied `wim-main` project. It has a responsive neumorphic interface, a vector world map, a historical people timeline, and a personal customization panel.

The original `../wim-main` folder is preserved. Application development happens here, in `atlas/`.

## Run the application

Requires Node.js 22.13 or newer.

```bash
cd atlas
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. Sign-in is required before the map can be opened. This workspace has a local demo account enabled; its email and password are in `.env.demo.local`. If dependencies are already installed, just run `npm run dev` from this directory.

Without a configured local account or Supabase connection, authentication fields remain editable and submitting the form explains that account access is not enabled. Map access stays closed. There is no guest or public demo entry route.

## Local demo account

The local demo uses a fixed email and password and works without Supabase, database migrations, or email confirmation. Run it with `npm run dev`. The map uses the bundled collection, and preferences, bookmarks, notes, custom characters, marker positions, and the display name are saved in this browser. Portraits whose original source is remote still need internet access; unavailable images use initials.

To set up the account on a fresh checkout, run:

```bash
npm run demo:setup
npm run dev
```

The setup command generates a strong random password in the ignored `.env.demo.local` file. It reuses that file when it already exists. It writes the email, a scrypt password hash, and a random session signing secret into the ignored `.env.local`, preserving existing Supabase connection settings. On a fresh setup, the email defaults to `demo@atlas.local`; set `ATLAS_DEMO_EMAIL` when running the setup command to choose another address. No email is sent.

New demo passwords are 29 characters; setup accepts 16-32 characters. If an older credentials file has a longer password, setup stops without changing it. An operator must choose a compatible password before rerunning setup.

Local access is enabled by `ATLAS_LOCAL_AUTH_ENABLED=true` and takes precedence over Supabase in development. Credentials are checked on the Next.js server, which issues an HttpOnly signed cookie valid for eight hours. Both the proxy and workspace check that cookie; changing browser storage cannot grant access. Signing out removes it, and rerunning setup invalidates existing local sessions. Local personal data stays in browser storage after sign-out and is restored when the same account signs in again.

To return to Supabase, set `ATLAS_LOCAL_AUTH_ENABLED=false` in `.env.local` and restart the server. Local authentication is always disabled in production builds. The default dev server binds to `127.0.0.1`. This mode uses the local Next.js server; it is not a static HTML export.

## Geographic basemaps

The map-type menu keeps the bundled political atlas as the default and adds four online Leaflet 1.9.4 basemaps: **Physical Map** (Esri World Physical, native zoom 0–8), **Topographic Map** (OpenTopoMap, 0–17), **Satellite Imagery** (Esri World Imagery, 0–19), and **Political Map** (OpenStreetMap, 0–19, with cities and administrative boundaries). The menu also appears in the fullscreen toolbar. Public HTTPS tile sources and their visible credits are configured in `lib/map-layers.ts`; no API key is embedded. The original bundled map needs no tile service. Online basemaps require internet access and show retry/default-map actions if tiles fail.

The geographic layers use Web Mercator, with portraits, country selection, NATO overlay, drawing, ruler, highlighting, laser and timeline above the tiles. Stored portrait positions are converted to/from the original projection so switching maps preserves the account's local data. The timeline filters people; provider imagery and borders describe the provider's current geographic snapshot. The physical source is limited to zoom 8 rather than requesting nonexistent detailed tiles. Tiles load only for the visible view, with normal browser caching and no offline download or prefetch facility; follow the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/) and the selected provider's terms when deploying.

`ATLAS_MAP_ONLY=1 ATLAS_LAYERS_ONLY=1 node scripts/browser-qa.mjs` exercises all four sources, coordinate alignment, native zoom limits, portrait selection, fullscreen tools, retry recovery and Persian phone/landscape layouts using intercepted test tiles. Set `ATLAS_CHROME_BIN` to the local Chrome executable when needed. The coordinate/zoom checks also run in `npm test` (`NODE_OPTIONS=--experimental-strip-types` on Node 22).

## What works

The login page has a separate account section with readable text and a full-width **Create an account** action. Login, signup and password-update inputs allow 8-32 characters, including when passwords are visible. Native maximum length limits typing/paste; a separate pre-submit length check rejects out-of-range DOM/autofill values before any authentication request. The limit applies to these forms; the external Supabase service retains its own server policy. With an isolated local server, `node scripts/auth-ux-browser-qa.mjs` checks the account action, keyboard use, password boundaries, paste, and Persian/mobile layouts without creating accounts or sending emails.

- English and Persian interfaces, with an always-available language switch on sign-in and workspace pages, right-to-left Persian layouts, bundled Vazirmatn typography, localized labels and errors, and Persian names for all bundled countries, people, and offices.
- Bundled world geometry: pan, zoom up to 64×, reset, native browser fullscreen, country selection, keyboard navigation, and clustered portrait markers. Portrait markers can be dragged with a mouse or touch, or moved with arrow keys while focused; their positions persist for the signed-in account in this browser. Use Reset portrait positions to restore the original locations. No map API key or tile service is required. Fullscreen uses the browser API with an expanded in-page fallback when unavailable; the exit button and Escape restore the normal layout. On phones, fullscreen fits the map to both screen dimensions in portrait and landscape; cropped regions remain reachable by panning. Two-finger pinch gestures zoom around the fingers and support panning, including when a gesture starts on a portrait. The fullscreen clock button hides or restores the timeline while preserving its date and playback state. The fullscreen map controls button hides or restores the inspector; selecting a country or portrait opens it again. On desktop, the inspector matches the map card height and scrolls internally.
- Fullscreen drawing tools: open the pencil icon to sketch with a mouse, pen or finger. Select the pencil to choose a palette color or a custom color; each stroke keeps its original color. Use the eraser to remove touched pencil strokes, the ruler to measure between two or more tapped points, or the hand to pan. The ruler shows each segment and the total approximate great-circle surface distance in kilometers (meters below 1 km), with Undo and Clear controls. It measures geographic distance rather than a driving route. Drawings and measurements follow the map during zoom, pan and screen rotation; two fingers still zoom without adding ruler points. The eraser only affects pencil strokes and cannot remove measurements, countries, portraits, geopolitical layers or stored marker positions. Drawings and measurements remain for the current map session and are not saved after reloading the page.
- All 156 original people records, with local portraits where supplied and initials for missing or unavailable images.
- Search by name, country, or title; country search suggestions; region and role filters.
- Search previews group countries, people, personal tags and groups into separate sections, each capped at three results. Tag/group previews open exact membership filters, retained in search URLs. Country/person result links use `/workspace#country-276` or `/workspace#person-…` targets: selecting a result scrolls to the map, zooms to it and restores the relevant historical date for a person. Direct links, reload and Back/Forward restore the same selection after sign-in and browser data restoration.
- Country profiles use only the active language for their name and capital. Annual capital names, area, population and local flag paths come from one file per country in `data/country-history/`. The 183-entry catalog includes the small sample countries absent from the original geometry, which can still be searched and centered. Only the exact timeline year is read; missing years and fields show unavailable values and no invented historical flag. Existing reference figures seed 2025.
- A month-by-month timeline from 1900 to one calendar year after the current month, playback, previous/next month controls, and historical term filtering. During playback, the clock control offers 0.5x, 1x, 1.5x and 2x speed; the selected speed is retained when pausing and resuming. These speeds advance approximately 1, 2, 3 and 4 months per second, respectively, on half-second beats (fractional months carry into the next beat).
- Map controls show the people and geopolitical layers directly, without tabs. Appearance settings live in My workspace. The original NATO boundary overlay is available in the layer controls.
- My workspace appearance settings: Soft light, Quiet dark, Warm sand and Midnight blue themes; sage, blue, lavender, amber and rose accents; and a 90%-130% font-size slider that scales desktop and mobile text. Preferences persist with the existing account settings and Reset appearance restores the defaults.
- A people directory and bookmarks. Use **Add character** at the top of **My workspace** to open the authenticated `/workspace/characters` page, which adds personal characters with a name, role, country, optional dates and a portrait. Characters, their bookmarks and marker positions are stored in account-scoped browser storage in both local and Supabase modes; Personal drafts remain in browser storage. Explicit publication requests are saved in Supabase for administrative review. Clearing site data removes them, and they do not sync to other browsers or devices.
- Display name, portrait visibility, continent labels, and marker size.
- Supabase email/password sign-in, sign-up, confirmation, recovery, password update, sign-out, verified server-side route protection, and database-backed personal data when connected.

## Install as an app (PWA)

Atlas includes a web app manifest, standalone display, home-screen icons (including maskable and Apple touch icons), and a production service worker. On an HTTPS deployment, use **Install app** in Chrome/Edge or **Share → Add to Home Screen** in Safari on iPhone/iPad. The installed app opens at `/` and keeps the usual sign-in requirement.

When a navigation fails without internet, a public offline page appears in English or Persian with a retry button. The map and sign-in still require internet. Only the offline page, its font and app icons are cached; account pages, authentication responses, API data and server component payloads are never stored by the service worker. Closing and reopening the app uses the latest server content when online. Worker upgrades activate after existing app windows close, and remove older Atlas PWA caches.

Service worker registration is disabled in development. To verify it locally, use `npm run build` followed by `npm start` on localhost, which browsers treat as a secure context. On Windows, regenerate the globe icons with `powershell -File scripts/generate-pwa-icons.ps1`. The implementation follows the [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

With the local production server running, run `node scripts/pwa-browser-qa.mjs` to check Chrome installability, worker registration, public-only caching, both offline languages, mobile layout and sign-in protection after reconnecting. Set `ATLAS_TEST_ORIGIN` or `ATLAS_CHROME_BIN` for a different local port or browser path.

## Android app (TWA)

The [`android/`](./android/README.md) project wraps the PWA as a Trusted Web Activity for `https://atlas-peyma.ir`, using the package `ir.atlas_peyma.twa`. It includes release signing support, app links, native launcher icons and a public Digital Asset Links file. The initial signing key and password were generated locally in the Git-ignored `android/signing/` directory; back up that entire directory securely. See the Android README for build commands, domain verification and Google Play signing setup. The web app must be deployed with the asset links before Android can verify trusted mode.

## Languages

Country names appear in a floating label next to the mouse when hovering over the map. On touch screens, hold a country for about half a second to preview its name, then release to dismiss it. Short taps still select countries; dragging or adding a second finger cancels the preview. Labels stay within the map and use the selected interface language in regular and fullscreen views.

Use the **فارسی / English** control on the sign-in page or workspace header. Your explicit choice is saved in the `atlas-locale` cookie for one year and is read during server rendering, including page metadata and the document's language and direction. On a first visit, a supported browser language is selected; English is the fallback. Changing languages preserves the signed-in session, current page, filters, viewport, and entered form values.

Persian uses right-to-left layouts and Persian digits. Historical dates remain **Gregorian** so their years still match the imported timeline and term dates. The map geometry and pan/zoom coordinates retain their geographic orientation. Country and person searches accept their original English names as well as the Persian names shown in Persian mode, with normalization of Arabic/Persian variants of ی and ک. User-written names, notes, and custom character text are preserved as entered.

Interface translations live in `lib/i18n/dictionary.ts`; Persian presentation names and office titles are in `data/locales/fa-data.json`, with common country-based office titles composed by `lib/i18n/index.ts`. Original records, IDs, database columns, and filter values stay unchanged. The [Vazirmatn font](https://github.com/rastikerdar/vazirmatn) is bundled under `public/fonts` with its SIL Open Font License, so loading Persian typography requires no third-party font service.

## Guided tour

The first authenticated visit opens a welcome dialog explaining Atlas's purpose: understanding people, places and political roles across time. **Start tour** introduces search, navigation, the map, map types, layers, timeline and profile. The final step invites the user to open the fullscreen map and begin a new journey. Its **Open map** button enters native fullscreen (or the existing fallback) and starts the separate tools tour on its first use. Each step offers Skip and Next; Tab/Shift+Tab stay inside the dialog and Escape dismisses it. Targets update on resize/scroll; missing or hidden targets are skipped.

The fullscreen tour teaches the toolkit toggle, pencil/color selection, eraser, multi-point ruler with Undo/Clear, map settings, roles/layers, timeline toggle, date controls and playback speeds. It opens the relevant panels for each step and restores their prior states when dismissed or completed. It never draws, erases, changes measurements, starts playback or changes saved filters. The dialog lives inside the fullscreen root so native fullscreen and the fallback both support it.

The tours have independent `atlas-tour-v1=done` and `atlas-map-tour-v1=done` markers in localStorage and one-year SameSite cookies. Finishing, skipping or declining a tour marks only that tour as seen. Either storage method prevents automatic replay. **About this atlas → Replay tour** clears both tours' cookies and localStorage markers and restarts the site welcome; the tools welcome is then available on the next fullscreen entry. Content supports Persian/English and RTL.

With a local demo server and Chrome, run `node scripts/tour-browser-qa.mjs` and `node scripts/map-tour-browser-qa.mjs` (optional `ATLAS_TEST_ORIGIN` and `ATLAS_CHROME_BIN`). Checks cover persistence, independent markers, replay, storage fallback, keyboard focus, missing targets, safe controls, state restoration, native/fallback fullscreen and Persian portrait/landscape layouts. Screenshots are saved in `outputs/`.

## Global search

The centered header search finds people (including historical records and your account's custom characters) and countries in the atlas. Places currently mean the countries in the bundled dataset. Typing offers keyboard-accessible suggestions without changing map filters. Press Enter to see all results, or select a suggestion to open it on the map. Selecting a historical person also aligns the map timeline to their term. Ctrl/Cmd+K focuses the search field.

The local bilingual index normalizes Persian/Arabic letter variants, diacritics, half spaces and Persian digits. It uses conservative stemming, a curated vocabulary of political roles and country aliases, and bounded edit distance for misspellings. Domain intent supports queries such as `presidents of Iran in 2024`, `نظامیان ایرانی`, and `USA`. This is vocabulary-based intent matching within the atlas, with no external AI service. Exact matches take priority; zero-result searches offer spelling alternatives, example queries and a way to remove restrictive filters.

The protected `/workspace/search` page supports result type, region, role, active year and relevance/name/term-date sorting. Query and filter state are kept in the URL for reloads, copied links and browser back/forward navigation. Results load in groups of 24.

Search engine tests are part of `npm test`. With a local demo server running, test keyboard suggestions, search behavior, filters, pagination, URL restoration and Persian/mobile layouts with:

```bash
node scripts/search-browser-qa.mjs
```

The browser runner uses Chrome and `.env.demo.local` against loopback origins only. It accepts `ATLAS_TEST_ORIGIN` and `ATLAS_CHROME_BIN` and saves screenshots in the ignored `outputs/` directory.

## Connect Supabase

A hosted Supabase project must be connected before account registration and map access are available. The complete schema and imported-data migrations are included.

1. Create a Supabase project. Copy its Project URL and **public publishable key** from the Connect dialog.
2. Copy `.env.example` to `.env.local` and fill in both values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

   The app does not need a service-role key. These public values are intended for the browser; database permissions and row-level security control data access. Partial configuration fails; missing configuration never grants map access.
3. In the Supabase SQL Editor, execute these files **in order**, once:

   - `supabase/migrations/20261017000100_atlas_schema.sql`
   - `supabase/migrations/20261017000200_import_wim_data.sql`
   - `supabase/migrations/20261020000100_remove_saved_views.sql` (removes the retired saved-map-view table)

4. In **Authentication → URL Configuration**, set the Site URL to `https://atlas-peyma.ir`, and add these Redirect URLs:

   ```text
   https://atlas-peyma.ir/auth/callback
   https://atlas-peyma.ir/auth/callback?next=/auth/update-password
   ```

   Confirmation and password recovery emails always return to this public domain, including when requested from localhost or a preview. The shared URLs are defined in `lib/auth/urls.ts`. Supabase's Site URL must also use this domain: templates using `{{ .SiteURL }}` and redirects rejected by the allow list otherwise fall back to the configured Site URL. After updating these settings, request a new email; links in previously sent emails are unchanged. For the default PKCE emails, request and open the link using the same browser on `https://atlas-peyma.ir` so the verification cookie is available.
5. Enable the Email provider and email confirmation in Supabase Authentication. The default confirmation and recovery emails work with the PKCE callback when opened in the browser that requested them. To support token-hash confirmation links, the app also implements `/auth/confirm`:

   ```html
   <!-- Confirm signup template -->
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email</a>
   <!-- Reset password template -->
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
   ```

6. Set `ATLAS_LOCAL_AUTH_ENABLED=false` if a local demo account was enabled. Restart the development server, open `/login`, create an account, confirm its email, and sign in. The database trigger creates the user's profile and preferences automatically.

`/` and the retired `/demo` route always redirect to `/workspace`. The workspace verifies the active provider's session on the server before reading or rendering map data; unsigned visitors go to `/login`. Missing authentication configuration also redirects to sign-in. Browser storage cannot grant access. In Supabase mode, each signed-in user’s preferences, bookmarks and notes are stored under their account in the database.

The setup follows [Supabase's SSR authentication guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs) and [row-level security documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Administration and character publication

After creating a character under **My characters**, an online user can select **Publish character** (انتشار کاراکتر). The browser draft remains private while the submitted snapshot is reviewed in Supabase. Rejected requests show the review note and can be resubmitted. Users can edit their own local drafts from **My characters** or the directory; edits made during review do not overwrite the submitted snapshot. New characters require English and Persian names and descriptions, and both languages survive publication and administrative editing. Existing single-language drafts remain readable and can be completed when edited.

Once an approval is received, Atlas removes the local draft to prevent duplicate directory/map entries. Its browser bookmarks, portrait position, tags and group memberships move to the shared character ID. This cleanup also runs on reload and across storage updates; pending reviews refresh every 30 seconds while visible and when returning to the tab. Clearing browser storage does not remove submitted snapshots. Local demo accounts cannot submit to the hosted review queue.

The **People directory** supports private tags and custom groups for any character. Use **Tags and groups** on a card to add/edit/remove comma-separated tags or change group membership. Create, rename and delete groups and filter the directory by group or tag. These settings use the existing account-scoped browser storage and do not sync across devices. Deleting a group keeps its characters. In fullscreen, the highlighter toolbar button opens a searchable character picker; highlighted portraits have a gold ring and remain separate from clusters for the map session.

The directory search and global search also match your personal tag and group names, using only the current account's browser data. Selecting a person replaces their cluster's initial portrait with the selected person's portrait and paints it above all other markers. Fullscreen map tools include a red laser cursor for presenting without drawing and a 1–12 px pencil-width slider. Each stroke keeps the color and width chosen when it was started. The short-screen toolbar uses two columns to keep the timeline controls reachable. Text-link buttons have larger text across desktop, mobile and Persian layouts.

**Contact administrators** in the sidebar lets signed-in online accounts send suggestions, bug reports or other messages. Messages are stored in Supabase with the verified author's account; local demo mode explains that an online account is needed. Administrators and the owner can open **User messages** in the administration panel, search the inbox, and mark messages as read, resolved or new. The inbox loads up to 200 messages, prioritizing new ones; Refresh fetches the latest list. Submissions are limited to 10 per account per hour. Only authors and staff can read stored messages, and only staff can list sender email addresses or change message status.

The **Administration panel** (پنل مدیریتی) appears in the sidebar for administrators and the owner, at `/workspace/admin`:

- **User**: existing map and personal-character features, plus publication requests and their own review status.
- **Administrator**: review and approve/reject publication requests; add, edit or delete shared map characters. Editing preserves imported dataset provenance.
- **Owner**: all administrator features, plus account search by email/name and appointing or removing administrators. The owner role cannot be granted or removed through the application.

### Enable on the existing Supabase project

1. Run `supabase/migrations/20261030000100_administration.sql` **once**, after the three existing migrations. This creates the role table, review queue, audited RPCs and row-level policies.
2. Run `supabase/migrations/20261030000200_fix_account_email_return_type.sql`. Supabase Auth stores emails as `varchar(255)`; this patch casts the account RPC's email output to its declared `text` type. It can also be run on an existing installation without recreating tables or changing data, and is safe to rerun.
   Then apply `supabase/migrations/20261106000100_bilingual_characters.sql` before deploying this version. It adds the Persian name/description columns and updates the validated publication/admin write functions without changing existing records or permissions.
   Apply `supabase/migrations/20261106000200_user_feedback.sql` to enable the contact form and administrator inbox. It creates the message table, row-level policies and authenticated submit/list/status RPCs. No email delivery service or service-role browser key is needed.
3. The account `aliahm8102@gmail.com` must already exist with a confirmed email. Run `supabase/bootstrap-owner.sql` in SQL Editor to appoint that account as the initial owner. It refuses to replace a different existing owner and is never callable through the application.
4. Sign in with that account and open **Administration panel**. Use **Manage administrators** to find existing registered accounts and grant/revoke administrator access.

A public publishable key cannot execute these setup steps. Use the Supabase SQL Editor as the project owner; no service-role key belongs in the browser or this repository. Until the migration is applied, existing map/account features continue working, publication is marked unavailable and no administration link is shown.

Authorization is checked in every server action and again inside the SQL mutation functions. Roles are read from protected database records, not user metadata or client props; revocation affects subsequent requests without issuing a new JWT. Authenticated users have no direct write grant on roles, submissions, shared people or audit records. Authors see only their own requests; staff can review the pending queue; only the owner can read account email search results. Review locks and an atomic transaction prevent duplicate publication, including concurrent approval attempts. Requests are limited to 200 per account and portraits to 300,000 characters.

Run `npm run test:db` with PostgreSQL 16 installed (`ATLAS_PG_BIN` can override its location). It creates a temporary local cluster on loopback port 55439, runs the migrations and role/isolation/concurrency tests, then stops and removes that cluster. It does not connect to production or the existing PostgreSQL service. Run `node scripts/admin-preview.mjs` for the role-aware component preview on localhost. Component previews in `scripts/` use in-memory fixtures and do not grant access to the application.

## Database

| Table | Purpose | Access |
| --- | --- | --- |
| `datasets` | Imported collection provenance | Signed-in readers; administrative writes |
| `countries` | Country names, regions, and coordinates | Signed-in readers; administrative writes |
| `people` | People, roles, portraits, and term dates | Signed-in readers; administrative writes |
| `geopolitical_layers` | Original NATO GeoJSON and its source note | Signed-in readers; administrative writes |
| `profiles` | User display names | Owner reads and display-name updates |
| `user_preferences` | Validated appearance and map settings | Owner only |
| `bookmarks` | User-to-person bookmarks | Owner only |
| `country_notes` | Private notes attached to a country | Owner only |

All tables have row-level security enabled. Foreign keys, indexes, length/range checks, timestamp triggers, and profile initialization are included. User-owned records cascade on account deletion. The client never uses a privileged database credential.

## Data limitations and provenance

Country identity metadata is stored in `data/country-profiles.json`; annual facts are in `data/country-history/<code>.json`. See the [Persian editing guide](data/country-history/README.md) and [empty template](data/country-history/template.json). Each year has `capitalFa`, `capitalEn`, `areaKm2`, `population`, and `flagPath`. Current reference figures were moved to the 2025 key by request; this assignment does not establish their observation year. No other year falls back to that seed. Run `npm run data:index-countries` after adding/removing a country file; editing years in existing files needs no index regeneration. Missing Persian capital translations are null rather than English text in a Persian field. All 44 user-supplied sample records are preserved exactly in `data/source/country-profile-samples.json`, including Vatican City's 0.49 km² area. Other reference facts come from a pinned [REST Countries dataset](https://github.com/restcountries/restcountries/blob/bfadee4f951682c29970e53677707bc558e80b74/src/main/resources/countriesV3.1.json). Observation years vary and the supplied sample did not specify them; these are not live population estimates. Existing map identities and Persian country names are preserved. Character creation and administration continue using the database's supported country list.

Flags are local SVG assets under `public/flags/`, from a pinned [country-flags collection](https://github.com/hampusborgos/country-flags/tree/c09927e63705529bbf59ca6684cd9b23225dddad) and Wikimedia Commons for the two map-specific territories. Exact source URLs and the reference import date are recorded in `data/source/country-profiles-provenance.json`. Normal page views make no country-data or flag-service requests. To regenerate metadata and missing seed files/assets, run `node scripts/import-country-profiles.mjs`; it never overwrites an existing annual country file and does not modify `data/countries.json` or the hosted database.

- This is an **imported snapshot**, not a verified current political database. Original names, office titles, and term dates are preserved, including potentially outdated or approximate records.
- Term ends are exclusive: a record ending in 2025 is hidden when the timeline reaches 2025. Monthly precision is derived from the original decimal-year dates.
- Boundaries and the NATO layer remain static at every timeline date. The app does not reconstruct historical borders or historical alliance membership.
- Country assignment prefers an explicit country in an original office title, then geographic containment, with a nearest-centroid fallback for small territories or coastal coordinates. It is approximate and does not make a political statement about borders.
- The original `political` role is normalized to `member` (Government), `military` to `army`, and the business collection to `business`. Raw source files remain in `data/source`.
- Natural Earth geometry comes from the `world-atlas` package. The original NATO GeoJSON and images come from `wim-main`. Original remote Wikimedia portrait URLs are retained and may require internet access; every unavailable image has an initials fallback. Review source asset licenses before external redistribution.

Regenerate the normalized JSON and data migration from the preserved sources with:

```bash
npm run data:import
```

This is a development operation: apply a new follow-up migration to update an already deployed database rather than modifying its migration history.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

The project uses Next.js's webpack compiler because this execution environment blocks the local worker port used by Turbopack. Production still uses standard Next.js rendering.

Database integration checks use a temporary **PostgreSQL 16** cluster with a minimal stand-in for Supabase's `auth` schema:

```bash
npm run test:db
```

Set `ATLAS_PG_BIN` if your PostgreSQL binaries are in another directory. These checks apply both migrations and verify profile creation, owner CRUD, denial of cross-user reads/writes, denial of anonymous access, and read-only shared datasets. They do not replace testing email delivery or the Supabase Auth service against a live project.

With the dev server running and Chrome installed, browser checks run with:

```bash
node scripts/browser-qa.mjs
```

For only the new bilingual character, tagging/grouping, publication cleanup and highlighting checks, set `ATLAS_MAP_ONLY=1` and `ATLAS_CHARACTERS_ONLY=1`. These run against an isolated component fixture. `ATLAS_TEST_CREDENTIALS_FILE` can select a separate ignored credentials file when testing an isolated local-auth server, keeping the developer's demo account unchanged. Node 22 versions before 22.18 need `NODE_OPTIONS=--experimental-strip-types` for `npm test`.

Set `ATLAS_MAP_ONLY=1` and `ATLAS_PRESENTATION_ONLY=1` for the laser cursor, pencil widths, selected portrait stacking, private tag/group search, larger RTL/mobile text and user-to-admin feedback browser checks. The feedback fixture uses in-memory messages and never contacts a real administrator. `npm run test:db` separately tests the feedback RPCs, authorization, isolation, rate limit and status persistence against the temporary PostgreSQL cluster.

Optional variables: `ATLAS_CHROME_BIN` and `ATLAS_TEST_ORIGIN`. For an isolated local server, use `ATLAS_NEXT_DIST_DIR=.next-qa npm run dev -- --port 3001` and set `ATLAS_TEST_ORIGIN=http://127.0.0.1:3001` for the browser command. The script checks required sign-in on `/`, `/demo`, and `/workspace`, including rejection of old demo browser storage. In local mode, it reads `.env.demo.local` on the test runner and checks wrong-password rejection, real sign-in, HttpOnly cookies, map access, persistence of profiles/bookmarks and appearance preferences, all four themes and five accents, keyboard font-size limits and reset, mobile/Persian appearance layouts, the Add character entry in My workspace, and removal of the private-note inspector, sign-out, forged-cookie rejection, and re-login without Supabase requests. The local credentials are tested only against a loopback origin. In Supabase mode, checks exercise editable sign-in, signup, recovery, and password-update fields without submitting forms, creating accounts, or sending emails. Without either provider, they also verify that submissions show the setup error. Set `ATLAS_AUTH_ONLY=1` to run just the authentication checks. Map interactions run in an isolated, temporary Vite component fixture, never a public Next.js route. Checks include the 64× zoom limit, native fullscreen entry/exit, Escape synchronization, the unsupported-browser fallback, mobile fullscreen controls, inspector visibility toggling, equal desktop map/inspector heights for layers and person details, layer-only controls without tabs, real playback timing at all four speeds, pause/resume and end/restart behavior, and keyboard-accessible clock controls at 130% font size, and responsive overflow. Character checks also cover single-click navigation on fresh/cached visits and direct loads, mobile drawer closure, account isolation, local portrait upload, storage quota failures, reload persistence, mouse/touch/keyboard dragging and deletion cleanup. Set `ATLAS_MAP_ONLY=1` to run these checks without the Next.js authentication server. Screenshots are saved under the ignored `outputs/` directory.

## Deploy a connected application

Deploy this directory to a host that supports **Next.js server rendering**, such as Vercel or a Node.js server. Add the two public Supabase variables before building, apply the migrations, and configure the final origin in Supabase Authentication. Do not use a static-only export for the authenticated application.

```bash
npm run build
npm start
```

The app requires an authenticated account to access the map; no public deployment has been made. Optional Sites scaffolding is retained from the development starter, but the default development and production commands run native Next.js.

## Main files

- `app/`: routes, authentication callbacks, protected workspace, and global theme.
- `components/atlas/`: map, user workspace, authentication forms, timeline, preferences, and persistence hook.
- `lib/atlas.ts`: domain types, preference and viewport validation, 1×–64× zoom bounds, and date/role/search filters.
- `lib/supabase/`: browser/server clients and environment configuration.
- `proxy.ts`: cookie refresh and an initial authentication check, backed by the workspace's own verification.
- `data/`: normalized people, countries, geometry, and original source JSON.
- `supabase/`: database migrations and isolation tests.
