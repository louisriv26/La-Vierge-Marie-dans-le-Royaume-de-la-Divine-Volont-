# La Vierge Marie dans le Royaume de la Divine Volonté

Progressive Web App for *La Vierge Marie dans le Royaume de la Divine Volonté* by Luisa Piccarreta: **31 main days + 6 appendices**.

## Current release

- App version: **v2.17.11**
- Corpus version: **1.0.0**
- Corpus structure: **37 units / 753 paragraphs**
- Architecture: plain static files; no npm, bundler, login, server, or cloud database
- User data: localStorage only

## Deployment

GitHub Pages publishes the repository from **branch `main`, folder `/root`**.

Live origin: `https://louisriv26.github.io/La-Vierge-Marie-dans-le-Royaume-de-la-Divine-Volont-/`

## Release/version contract

Every app-code release must keep these live version strings synchronized:

1. `sw.js`: `const VERSION = 'X.Y.Z'` → shell cache `mjv-shell-vX.Y.Z`
2. `index.html`: `const APP_VERSION = 'X.Y.Z'`
3. `index.html`: mobile visible badge `vX.Y.Z`
4. `index.html`: wide visible badge `vX.Y.Z`

Do **not** use a blind global replacement of old version strings: historical data-shape comments intentionally retain the version ranges to which they refer.

Current cache buckets:

- `mjv-shell-v2.17.11` — release-specific app shell
- `mjv-content-v1` — corpus content; bump only when the governed corpus changes
- `mjv-fonts-v1` — cached webfonts

The service worker deletes only `mjv-`-prefixed obsolete caches.

## Current user-facing features

- 31-day calendar plus six appendices
- distinct today, read/completed, and active-practice-day states
- “Pour aujourd’hui” devotional card/modal
- 37-unit reader with previous/next navigation and explicit completion
- four semantic reader sizes: **Petit 16 px / Normal 19 px / Grand 22 px / Très grand 26 px**, with live preview
- one-time/idempotent migration from legacy 14–22 px integer text-size settings
- explicit theme picker: **Automatique / Clair / Sombre**
- full-text search across titles and all 753 paragraphs, with marked snippets and paragraph deep-targeting
- notes attached to stable paragraph IDs
- five-colour highlights; exact selected-text ranges on supported Apple/desktop paths and whole-paragraph highlighting on Android by policy
- Mon Espace for highlights and notes
- per-unit reading-position persistence
- first-run onboarding, cycle reset, cross-tab storage reconciliation, midnight rollover
- mobile/wide responsive layouts sharing one implementation per concern
- installable/offline-capable PWA after a successful initial online load/cache
- debug panel via triple-tap on the version badge

Favourites are intentionally retired: legacy favourites migrate once into gold highlights and are not a current write model.

## Data and corpus contract

`corpus/days.json` is read-only in app-harmonisation work.

- `unit_id` and `paragraph_id` are stable identifiers and must not be renamed casually.
- Paragraph order and meditative sequence are protected.
- User state must never be written into the corpus.
- Any source-text or segmentation change belongs to a separate corpus-governance stage.

## Engineering invariants

- Mobile and wide layouts share common render/update functions through config objects.
- Corpus lookup uses prebuilt `unitIndex`, `seqIndex`, and `paraIndex` indexes.
- Range-highlight offsets are stored in original paragraph-text coordinates.
- `offsetsFromRange()` must continue excluding `BUTTON` subtrees.
- Overlapping ranges resolve first-wins; nested `<mark>` elements are not allowed.
- A range commit rerenders only the affected paragraph (`renderParagraph(pid)`), not the whole reader.
- Android exact-range highlighting remains disabled unless physical-device evidence supports a future redesign.
- Pure logic lives behind the `Pure` test seam. `App.selfTest()` currently contains **122 assertions**.

## Pre-deploy checks

Run the encoding guard first, then syntax/self-tests and version checks:

```bash
python scripts/run_exact_encoding_guard.py
# Then verify the live strings deliberately, not by global replace:
grep -n "APP_VERSION = \|mobile-version\|version-badge" index.html
grep -n "const VERSION = " sw.js
```

Also verify JavaScript/service-worker syntax, corpus counts/IDs, and `App.selfTest()` before release.

## Device-validation boundary

Static/browser-harness checks do not prove physical Safari or installed-PWA behaviour. Release reports must state explicitly when real iPhone/iPad/Samsung, installed-PWA, offline, or live-origin verification has not been performed.

## File structure

```text
.
├── index.html
├── sw.js
├── manifest.json
├── 404.html
├── .nojekyll
├── corpus/
│   ├── days.json
│   └── manifest.json
└── icons/
```

## Local backup / restore (v2.11.0)

Mon Espace now provides three explicit local actions:

- **Sauvegarder** — downloads a versioned, validated JSON restore file containing local reading state and settings.
- **Restaurer** — validates the whole file first, previews counts, and supports **Replace** only. A transaction journal and rollback protect against partial writes or interruption.
- **Exporter le journal** — downloads a human-readable Markdown journal. It is deliberately not accepted as restore input.

No cloud service is used and no user data is uploaded automatically. The last successful machine-backup timestamp is stored only on the current device.

## Notes / Mon Espace data model (v2.12.0)

MJV-C migrates `mjv_notes` from the historical one-note-per-paragraph object to a versioned record store. Each record has its own stable note ID plus `paragraph_id`, `unit_id`, exact note text, `created_at`, `updated_at`, and optional selection/range fields. The migration is deterministic and preserves every accepted historical note text byte-for-byte.

- A paragraph can now hold multiple independent notes.
- The primary note flow is contextual: select text (or target a paragraph on Android) and choose **Note**. Existing notes expose ID-specific edit/delete actions. A keyboard/fine-pointer paragraph-note fallback remains available without being permanently visible.
- Mon Espace lists every note (no silent cap), newest first, with day/appendix context and separate edit/delete actions.
- Note deletion retains the existing Undo flow and only changes in-memory state after persistence succeeds.
- MJV-C introduced machine backup schema v2. Current v2.17.11 uses schema v4 because reading positions are semantic records; v2.11.0/MJV-B schema-v1, v2.12.0/MJV-C schema-v2 and v2.13.0/MJV-D schema-v3 backups remain accepted and normalized during validation.
- Human-readable journal export lists every record separately.
- Favourites remain retired; cycle reset still preserves notes and highlights.

## Highlight resilience / stale handling (v2.13.0)

MJV-D preserves the existing range-highlight engine and adds resilience metadata around it. New records store the paragraph SHA-256 fingerprint (SHA-256 of exact UTF-8 `para.text`), corpus version, status, saved-text snapshot and recovery evidence. Legacy records are enriched after corpus load. If paragraph text changes, exact offsets are reused only when the saved phrase still matches; otherwise recovery occurs only when the saved phrase has exactly one match. Ambiguous/missing matches become `stale`, are not rendered at guessed offsets, and remain visible/removable in Mon Espace and journal export. Android remains whole-paragraph highlighting; iPhone/iPad/desktop keep exact-range selection. Backup schema v3 carries the metadata while v1/v2 backups remain accepted.


## Semantic reading position, search links and support (v2.14.0)

MJV-E replaces pixel-only reading resume with a stable paragraph anchor plus within-paragraph fraction, unit-level fraction and historical pixel fallback. Position is captured before text-size/layout changes and restored after layout settles. Search uses a common French normalizer covering accents, œ/oe, æ/ae, apostrophe variants, NBSP/narrow spaces and case; returning from a mobile search result restores the query and result-list scroll position. Stable `?open=unit&id=...&pid=...` and `?open=search&q=...` routes fail recoverably on invalid targets. The reader exposes Copy link, each paragraph can prepare a privacy-safe text-issue report, and Aide/debug can copy diagnostics that deliberately exclude notes and highlight contents. Backup schema v4 carries semantic reading positions while v1-v3 backups remain accepted.


## MJV-F navigation harmonisation — v2.15.0

- Mobile primary navigation is now **Accueil · Jours · Recherche · Mon Espace**.
- **Aide** remains available as a secondary `?` topbar action and returns to the prior context when closed.
- The existing shared list/search renderer is retained: `Jours` shows the 31 days + 6 appendices, while `Recherche` opens a dedicated search mode over the same indexed content.
- Search back-context from a result remains preserved (query and result-list position).
- Wide layout promotes **Recherche** to the primary navigation alongside Jours and Mon Espace; Aide is a secondary utility.
- No corpus, stable ID, note, highlight, backup, theme, text-size, PWA or storage schema change is introduced by MJV-F.
- Production promotion remains subject to the roadmap's owner/user staging-acceptance gate and inherited unresolved physical-device gates.


## MJV-G PWA / offline / fonts / orientation — v2.16.0

- The three-cache architecture established in MJV-G remains: release-specific `mjv-shell-v<APP_VERSION>` (currently `mjv-shell-v2.17.11`), plus `mjv-content-v1` and `mjv-fonts-v1`; cleanup remains scoped to `mjv-` cache names only.
- Install-time **required shell** requests (`./`, `index.html`, `manifest.json`) now use `cache: reload` and are atomic: a failed required fetch prevents the new worker from activating, leaving the previous working worker in control. Icons remain optional cosmetic precache assets.
- The corpus bucket is retained across code-only releases. If an essential corpus asset is absent from that bucket, the install must fetch it successfully before activation.
- Runtime shell navigations use network-first with a 3.5 s bound and `cache: no-store`, then the versioned shell cache as fallback. This avoids normal HTTP-cache staleness while preserving offline startup.
- Google Fonts remain an **optional enhancement**, not a reader dependency. The install step now attempts to cache the Google Fonts stylesheet and all referenced `fonts.gstatic.com` resources; failure is non-fatal because the reader retains `Georgia, serif` fallback. No font-face change was made.
- `manifest.json` intentionally remains `orientation: portrait`. MJV-G does **not** change it to `any` without the roadmap-required physical iPhone/iPad rotation/Split View evidence.
- Local Chromium service-worker/offline tests are evidence for browser/runtime behavior only. They do not substitute for installed physical-device Safari/Android testing or live GitHub Pages update testing.

## MJV-H accessibility / touch / responsive conformance — v2.17.0

- Frequent touch-primary controls are at least 44×44 CSS px in the MJV-H measured browser matrix, including paragraph tools, mobile/wide navigation utilities, reader navigation, appendices, calendar cells, colour controls and modal actions.
- Search and note editable fields remain 16px. The note sheet retains the synchronous-focus and opener/focus-restoration code paths; physical iOS keyboard/focus behaviour remains a device-test requirement.
- The 200% phone-equivalent reflow path wraps the four reader actions instead of creating an internal horizontal overflow. All four semantic reading sizes remain 16/19/22/26.
- A dedicated `--prayer-text` token keeps jaculatory-prayer text AA-readable through every tested highlight tint in light and dark themes.
- Reduced-motion handling, modal Escape/Tab trapping, focus-visible, ARIA states and safe-area code paths remain in place.
- Real iPhone/iPad safe-area/keyboard/picker behavior, real screen-reader operation and physical-device 200%/orientation behavior remain release evidence requirements; static/headless checks do not substitute for them.

## MJV-H deep four-pass audit reconciliation — v2.17.1

- A fresh package-wide audit found that the v2.17.0 evidence system had missed one stale deploy-facing README cache identity and retained pre-final wording inside the locked evidence package. Those report-integrity defects are corrected in this patch.
- The same audit expanded 200%-equivalent testing beyond the reader. At a 195px CSS viewport, the seven-column home calendar collapsed below the 44px touch target and the appendix/hero areas clipped; the diagnostic overlay also contained 19px/33px buttons and overflowed. v2.17.1 adds an extreme-width three-column calendar, wrapping appendix/hero/dialog layouts, responsive toasts, and 44px diagnostic actions.
- No corpus, stable-ID, note/highlight schema, backup schema, search/deep-link, navigation, or service-worker strategy change is introduced.
- Physical iPhone/iPad/Samsung, installed-PWA, live-origin and real screen-reader gates remain outstanding, so the stage remains LIMITED_PASS until those are executed.

## MJV-H second independent deep recheck — v2.17.2

A second fresh audit of the locked v2.17.1 package found two runtime reproducibility defects and several evidence-harness weaknesses that the earlier four-pass audit had not exposed. v2.17.2 supersedes v2.17.1 as the MJV-H controlled-test candidate.

- **Semantic reading position race fixed.** A text-size reflow could emit a scroll event before the previous semantic position had been restored, causing the saved paragraph anchor to drift. Programmatic semantic restores are now generation-tokened; restore-induced scroll events are ignored while the token is active, and an explicit user pointer/touch/wheel gesture cancels a pending restore.
- **Rotation / Split View hand-off fixed.** During a mobile↔wide breakpoint flip, CSS can hide the old reader before the debounced reconciliation callback. Some browsers then report `scrollTop = 0` and emit a scroll event. The app no longer samples the hidden old scroller in `checkLayoutBucket()`, and `recordScroll()` ignores the inactive layout scroller. The already-saved semantic paragraph/fraction is the hand-off between layouts.
- **Accessibility coverage expanded beyond buttons.** Search input height is now at least 44px, the note textarea has an explicit accessible name, topbar utility buttons cannot flex-shrink below 44px, and wide mode exposes one visible `main` landmark rather than nested main landmarks.
- **Evidence scripts are self-contained.** Current regression, conformance, SW, 200%-surface and touch scans default to the package tree that contains them instead of obsolete `/mnt/data/...` work directories. Historical v2.17.0/v2.17.1 builders are retained under `scripts/historical/` only.
- The governed corpus remains byte-identical. No note/highlight/backup/search/navigation/PWA schema contract changed.
- Physical iPhone/iPad/Samsung, installed-PWA/live-origin and real VoiceOver/TalkBack/NVDA gates remain **NOT_TESTED** and release-critical; this package cannot be promoted to full MJV-H PASS from static/headless evidence alone.





## MJV-H.1 deep four-pass correction — v2.17.6

v2.17.6 supersedes v2.17.5 after a fresh four-pass audit of the immutable v2.17.5 package.

- The wide/iPad `Jours` title list remains removed, and its now-empty shared results surface is **fully collapsed** instead of leaving a large blank flex spacer above `Pour aujourd’hui`.
- `Recherche` still reactivates the same results surface on demand; the mobile 37-unit `Jours` list remains unchanged.
- Current QA evidence is rebuilt from the v2.17.6 package; the independent four-pass audit script is package-relative and executable against the actual evidence layout.
- Active reports now include a line-by-line claims audit and a recursive stale/contradiction scan.
- Corpus, stable IDs, notes, highlights, semantic reading position and PWA behaviour remain protected.
- Real iPhone/iPad/Samsung, installed-PWA/live-origin and assistive-technology validation remain external release-critical gates.

## MJV-H.1 wide-layout simplification — v2.17.5

v2.17.5 is a narrow UX patch on the v2.17.4 controlled-test baseline.

- On wide/iPad/desktop `Jours`, the persistent **Méditations du mois** title list is no longer rendered in the sidebar. The 31-day calendar and appendix buttons remain the direct navigation surface.
- The shared sidebar scroller is retained only for **Recherche** results, so wide search continues to work without reintroducing the cramped title list.
- The mobile `Jours` destination remains unchanged and still exposes the complete 37-unit list.
- The wide `Pour aujourd’hui` card, progress, calendar, search, corpus, stable IDs, notes, highlights, reading position and PWA logic are unchanged.
- Physical iPhone/iPad/Samsung, installed-PWA/live-origin and assistive-technology evidence remain separate release-critical gates.

## MJV-H.1 owner-test correction — v2.17.4

v2.17.4 supersedes v2.17.3 as the MJV-H physical-test candidate after owner testing found the reader interaction was not fully harmonised with 24 Heures and the permanent paragraph `!` report control was distracting and could fail silently when Web Share rejected.

- On iPhone/iPad/desktop, selecting text now exposes one contextual bar: **Surligner · Note · Copier**.
- On Android/Samsung, tapping a paragraph opens the same actions; Surligner remains whole-paragraph only.
- Notes created from a text selection retain the existing schema's `selected_text` and `range` context; no storage-schema migration was introduced.
- The repeated paragraph `!` control is removed. Text-issue reporting remains available from Aide for the current passage and now falls back to clipboard feedback if Web Share fails.
- The paragraph pencil is hidden on coarse-pointer/touch devices and is not persistently visible on fine-pointer desktop; the fallback appears only on paragraph hover or keyboard focus.
- Corpus text, stable IDs, backup schema v4, highlight algorithm, reading-position/PWA fixes and existing user data remain protected.

## MJV-H third adversarial deep recheck — v2.17.3

v2.17.3 supersedes v2.17.2 after a fresh package-level audit found two runtime/release-engineering gaps that earlier H evidence had not exercised:

- offline startup through stable `?open=unit` / `?open=search` deep links now falls back to the canonical cached app shell instead of requiring an exact query-string cache entry;
- the service-worker update guard tracks whether the note editor is **dirty relative to its exact initial value**, so clearing an existing note or entering whitespace cannot be mistaken for “no unsaved draft”; duplicate update banners are suppressed;
- current evidence scripts are orchestrated from the package tree and the governing builder no longer depends on an obsolete external `/mnt/data/deep2` baseline;
- the exact uploaded encoding guard remains byte-identical and is executed through `scripts/run_exact_encoding_guard.py`, which verifies the guard's frozen SHA-256 and invokes its unchanged detection logic against this package's `index.html`, `manifest.json`, and `sw.js`.

The protected corpus is unchanged. Physical iPhone/iPad/Samsung, installed-PWA, and real assistive-technology evidence remain separate release-critical gates.


## MJV-H.1 Aide / À propos reconciliation — v2.17.7

v2.17.7 supersedes v2.17.6 for controlled testing. It audits and reconciles the complete Aide / À propos content against the current runtime.

- Adds explicit App/Corpus version and local-data/privacy information.
- Corrects platform-specific Aujourd’hui and Terminé instructions.
- Adds reading-position resume, stale-highlight explanation and clear 37-unit versus 31-day cycle wording.
- Adds a dedicated Partager versus Lien explanation.
- Fixes Partager so non-cancel share failures fall back to clipboard feedback instead of failing silently.
- Makes Partager, Lien and text reporting resolve the paragraph actually being read, with the arrival/deep-link target only as fallback.
- Clarifies first-online-load, offline/PWA and update behaviour, including protection of an unsaved note draft.
- Corpus text and IDs are unchanged.


## MJV-H.2 interaction closure — v2.17.8

v2.17.8 supersedes v2.17.7 for controlled testing. This is a deliberately narrow ecosystem-alignment stage.

- Contextual passage actions are now **Surligner · Note · Copier · Fermer**. `Fermer` dismisses the contextual bar and clears the temporary native selection without changing saved notes, highlights, read state or reading position.
- The five user-facing highlight colour names are **Jaune · Bleu · Vert · Violet · Rose**. The internal `gold` storage key remains an implementation detail so no unnecessary user-state schema migration is introduced.
- Aide remains the single help surface and retains À propos as an internal section.
- Current Partager/Lien behaviour is preserved.
- Android/Samsung highlighting policy and manifest `orientation: portrait` are intentionally unchanged pending physical-device evidence.
- Corpus text, IDs and paragraph order are unchanged.



## MJV-H.4R iPad contextual-bar deep recheck — v2.17.11

v2.17.11 re-executes the iPad contextual-action repair from the exact v2.17.9 governed baseline after an adversarial four-pass review invalidated the v2.17.10 evidence lock.

- The iPadOS selection menu remains OS-owned near selected words. Marie's `Surligner · Note · Copier · Fermer` bar is separate, fixed at the bottom of the reading area **above** the reader navigation.
- The earlier v2.17.10 candidate placed this bar only 14px above the viewport bottom; laid-out browser reconstruction found a 51px overlap with the wide reader navigation. The first v2.17.11 internal candidate then exposed a second mobile-specific overlap because mobile has both the reader navigation and a 4-action reader bar. The final v2.17.11 uses a safe-area-aware 152px mobile offset and 78px wide offset, leaving the contextual bar above the full reader controls.
- The bar uses a stable dark `#1C1830` surface and light `#F8F6FC` action text in both themes.
- The iOS selection-interaction guard preserves the captured exact range while toolbar touch collapses the native selection.
- Help/onboarding now says the app bar appears above the reader navigation and separately from the system selection menu.
- Corpus, stable IDs/order, highlight schema/range algorithm, notes/backup schema, Android/Samsung paragraph policy, Partager/Lien, navigation architecture, manifest identity/orientation and locked icon family remain unchanged.
- Exact physical iPad Safari/PWA retesting is still required.


## Final locked Collection Luisa icon family v1 — v2.17.9

v2.17.9 is a narrow visual-identity release on the exact v2.17.8 governed runtime.

- Replaces the previous Marie icon set with the final locked Collection Luisa **Marie** identity across browser favicon, Apple touch and PWA surfaces.
- Uses a dedicated `icon-maskable-512.png` for the manifest `maskable` purpose instead of reusing the ordinary 512px icon.
- Precaches the nine platform-ready icon assets in the release-specific shell cache.
- Removes the obsolete unreferenced `icons/icon.svg` and superseded `icons/icon-32.png`.
- Preserves `orientation: portrait`, `start_url`, `scope`, corpus, stable IDs, local-data schema, reader interactions, Help/About, Partager/Lien and Android/Samsung policy unchanged.
- Full physical-device, installed-PWA/live-origin and real assistive-technology validation remains external; this release must remain LIMITED_PASS until those exact-byte gates are executed.
