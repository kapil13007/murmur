# Murmur — Project Documentation

> **Source of truth** for understanding, developing and deploying this application. Read this before touching the code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Desktop App Deep Dive](#7-desktop-app-deep-dive)
8. [Database Schema](#8-database-schema)
9. [API Reference](#9-api-reference)
10. [Authentication Flow](#10-authentication-flow)
11. [Key Business Logic](#11-key-business-logic)
12. [Local Development Setup](#12-local-development-setup)
13. [Deployment (Docker)](#13-deployment-docker)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [Testing](#15-testing)
16. [Password Management](#16-password-management)
17. [Project History](#17-project-history)
18. [Converting This Document to Word (.docx)](#18-converting-this-document-to-word-docx)

---

## 1. Project Overview

**Murmur** is a personal voice dictation app inspired by Wispr Flow. A desktop app listens for a global shortcut. While the shortcut is held it records the microphone, and on release it sends the audio to the API. The API transcribes it, cleans it up for the app and text box you're in, and returns text that the desktop app pastes at your cursor. A web "hub", the same React app shown inside the desktop window, manages everything around that loop: history, dictionary, snippets, styles, transforms, notifications and settings.

It is a single-person product. Every row belongs to one user and nothing is shared between accounts.

This is an independent project, not affiliated with Wispr, Inc. No Wispr code or assets are used.

### Core Features

| Area | What it does |
| --- | --- |
| **Dictation** | Push-to-talk (`Ctrl+Win`), hands-free (`Ctrl+Win+Space`), Command Mode (`Ctrl+Win+Alt`), cancel (`Esc`), paste last (`Shift+Alt+Z`), copy last (`Shift+Alt+X`). Every shortcut can be remapped. |
| **Speech-to-text** | Groq `whisper-large-v3-turbo`, primed with your name and dictionary. Local Whisper (transformers.js) is the offline fallback, or can be the default. OpenAI Whisper is optional. |
| **Cleanup** | Groq `qwen/qwen3.8-27b` (or Claude or OpenAI) for AI cleanup, with a deterministic rule engine as the offline fallback. Covers fillers, stutters, self-corrections, spoken commands, lists, times, per-app tone and email layout. |
| **Addresses** | Spoken or mis-split email and web addresses are written as typed (`kapil.sharma@gmail.com`, `www.youtube.com`) and are never capitalised, split or given a period. |
| **Field awareness** | The desktop reports the focused text box. To/Cc boxes get addresses only, subject lines and search boxes get no final period, and back-to-back dictations are separated by a space. |
| **Personalisation** | Dictionary (vocabulary + misspelling corrections, auto-learned from your edits), snippets (spoken cue → saved text), writing style per app category, polish instructions, email signature. |
| **History** | Search, archive, edit (teaches the dictionary), retry from stored audio, delete, copy, feedback. Home shows streak, total words and words per minute. |
| **Transforms & Command Mode** | One-click rewrites (built-in and custom) and spoken instructions applied to selected text. |
| **Privacy** | Privacy Mode (recordings never kept), "never store history", auto-delete after 24 hours, JSON export, account deletion. |
| **Realtime sync** | Server-Sent Events keep the hub and desktop in step. |

---

## 2. Architecture

### Components

```
┌──────────────────────────── Windows PC ─────────────────────────────┐
│                                                                      │
│  MurmurHelper.exe ──JSON lines──►  Electron main process             │
│  (keyboard hook, Ctrl+V,            ├─ DictationController (state    │
│   UI Automation: browser URL,       │   machine, smart spacing)      │
│   focused field, text before        ├─ Murmur bar window (recorder + │
│   the caret; Core Audio)            │   waveform)                    │
│                                     ├─ Hub window (React app) ◄─IPC─►│
│                                     │   preload `flowDesktop`        │
│                                     └─ Tray icon                     │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ HTTP(S)  (JWT bearer)
                                    ▼
                    ┌───────────────────────────────┐
                    │  Express API  (Node.js)       │──► Groq Whisper (or local
                    │  /api/v1/*   + hub static     │    Whisper fallback)
                    │  SSE /api/v1/sync/events      │──► Groq Qwen / Claude /
                    └───────────────┬───────────────┘    OpenAI (or rules)
                                    │ Sequelize
                                    ▼
                    ┌───────────────────────────────┐
                    │  PostgreSQL (13 tables)       │
                    └───────────────────────────────┘
```

### Local Development

| Process | Command | URL |
| --- | --- | --- |
| API | `cd backend && npm run dev` | http://localhost:8000 |
| Hub (hot reload) | `cd frontend && npm run dev` | http://localhost:5173 (proxies `/api` → 8000) |
| Desktop | `cd desktop && npm run dev` | loads the hub from :5173 |

Without the Vite dev server, run `npm run build` in `frontend/`. The API then serves `frontend/dist` at http://localhost:8000 (`SERVE_FRONTEND=true`), and `npm start` in `desktop/` points the desktop app there.

### Request Lifecycle: One Dictation

```
1. User holds Ctrl+Win in Gmail (Chrome)
2. MurmurHelper hook matches the binding  ──►  {"type":"hotkey","action":"push_to_talk","phase":"down"}
3. DictationController.start()
     ├─ asks MurmurHelper for the foreground app, browser URL, focused field name
     │  ("To recipients", "Message Body") and the 2 characters before the caret
     ├─ Murmur bar opens the mic (getUserMedia → 16 kHz AudioWorklet), plays the start chime
     └─ mutes system audio (Core Audio) if "mute while dictating" is on
4. User releases  ──►  phase "up"  ──►  DictationController.finish()
     ├─ unmutes, recorder returns a 16-bit PCM WAV
     ├─ presses shorter than 350 ms are discarded as accidental taps
     └─ POST /api/v1/dictation/transcribe  (audio + app_name, url, window_title, field_name, mode…)
5. API: decode WAV → voice activity check → Groq Whisper (prompted with the user's name and
   dictionary) → field type (address / short / text) → AI cleanup or rules → corrections →
   vocabulary → snippets → signature → final pass (addresses, periods, style ending)
   → persist transcript (+ audio unless Privacy Mode) → usage rollups → milestones → SSE event
6. Desktop: adds a leading space if the caret follows text, snapshots the clipboard, writes
   the text, MurmurHelper sends Ctrl+V, restores the clipboard
7. Any open hub window receives `transcript.created` and shows it in History
```

Typical timings with Groq: speech-to-text 200–450 ms, cleanup 130–220 ms.

---

## 3. Tech Stack

### Backend

| Library | Purpose |
| --- | --- |
| Node.js 24 (ESM) | Runtime |
| Express 5 | HTTP server and routing (async errors handled natively) |
| PostgreSQL 18 | Database (`pg_trgm` for transcript search, `pgcrypto` for UUIDs on old servers) |
| Sequelize 6 | ORM, models and associations |
| Umzug 3 | Versioned migrations, tracked in `schema_migrations` |
| Zod 4 | Request validation (body, query, params) and env validation |
| jsonwebtoken + bcryptjs | JWT sessions and password hashing |
| multer | Multipart audio uploads (memory storage, 25 MB cap) |
| helmet, cors, express-rate-limit | Security headers, CORS allowlist, rate limits |
| Groq API (OpenAI-compatible) | `whisper-large-v3-turbo` speech-to-text and `qwen/qwen3.8-27b` cleanup |
| @huggingface/transformers | Local Whisper (ONNX Runtime): offline speech-to-text fallback |
| @anthropic-ai/sdk | Claude as an alternative LLM provider |
| supertest + node:test | API and unit tests |

### Frontend (Hub)

| Library | Purpose |
| --- | --- |
| React 19 | UI |
| Vite 8 | Dev server and build (proxy `/api` → `:8000`) |
| Tailwind CSS 3 | Styling with CSS-variable theme tokens (light/dark) |
| react-router-dom 7 | Routing, including the Settings modal route |
| Axios | API client with auth and error interceptors |
| react-hot-toast | Notifications |
| lucide-react | Icons |
| @fontsource Figtree + EB Garamond | Typography |

### Desktop

| Technology | Purpose |
| --- | --- |
| Electron 44 | App shell: hub window, Murmur bar, tray |
| MurmurHelper.exe (C# 5, .NET Framework 4) | `WH_KEYBOARD_LL` global hook, `SendInput` paste/copy, UI Automation (browser URL, focused field, text before the caret), Core Audio mute |
| AudioWorklet + Web Audio | 16 kHz microphone capture, waveform, synthesised chimes |
| safeStorage (DPAPI) | Encrypts the stored session token |
| electron-builder | Windows installer (NSIS) |

---

## 4. Repository Structure

```
murmur/
├── backend/
│   ├── app/
│   │   ├── api/              # 15 Express routers + entry_routes.js + api_router.js (/api/v1)
│   │   ├── core/             # config, security (JWT/bcrypt), deps (auth, uploads),
│   │   │                     # validators (Zod), limiter, errors, logger, dates
│   │   ├── crud/             # Database functions, one file per aggregate
│   │   ├── db/               # session.js (Sequelize), migrator.js (Umzug), helpers
│   │   ├── models/           # 13 Sequelize models + associations (index.js) + constants
│   │   ├── schemas/          # Zod request schemas + response shapers (toXOut)
│   │   ├── services/
│   │   │   ├── asr/          # local_whisper.js, remote_whisper.js (Groq/OpenAI), index.js
│   │   │   ├── audio/        # wav.js: decode, resample, voice-activity analysis
│   │   │   ├── formatting/   # rules.js, addresses.js, dictionary.js, text_utils.js, index.js
│   │   │   ├── llm/          # openai_compatible_provider (Groq/OpenAI), anthropic_provider, prompts
│   │   │   └── *.js          # dictation, command, transform, dictionary, style, stats,
│   │   │                     # notification, realtime, retention, export, auth, app_category
│   │   └── main.js           # Express app: middleware, routers, static hub, errors
│   ├── migrations/           # 0001 … 0008
│   ├── scripts/              # setup_db.js, migrate.js, seed.js, download_model.js
│   ├── tests/                # api.test.js, formatting.test.js, text_instruction.test.js
│   ├── .env.example
│   └── server.js             # Entry: DB check → migrations → speech-to-text warm-up → listen
│
├── frontend/
│   ├── public/               # logo.svg, recorder-worklet.js
│   └── src/
│       ├── api/apiClient.js  # The only place that talks to the API
│       ├── auth/             # Login, Register, ProtectedRoute, PasswordStrength
│       ├── components/       # Sidebar, MainLayout, DictateButton, HelpModal
│       │   ├── ui/           # Modal, ConfirmModal, Toggle, Tabs, Menu, KeyCombo, Waveform…
│       │   └── entries/      # Shared list UI for Dictionary + Snippets
│       ├── context/          # AppContext: user, preferences, unread count
│       ├── desktop/bridge.js # `window.flowDesktop` when running inside Electron
│       ├── hooks/            # useRecorder, useServerEvents, useDebounce
│       ├── utils/            # shortcuts, languages, formatter, audio/wavEncoder
│       ├── Home/ Dictionary/ Snippets/ Style/ Transforms/
│       ├── Notifications/ Onboarding/ Settings/
│       ├── App.jsx           # Routes
│       └── main.jsx
│
├── desktop/
│   ├── main/                 # index (entry), dictation, flowbar, windows, tray,
│   │                         # helper, clipboard, api, store, config
│   ├── preload/              # hub.js (flowDesktop), flowbar.js (flowBar)
│   ├── renderer/             # flowbar/ (pill UI + recorder), offline page
│   ├── helper/               # MurmurHelper.cs + build.js (csc.exe → bin/MurmurHelper.exe)
│   ├── scripts/              # start.js, make-icons.js, capture-screens.js
│   └── assets/               # icon.ico/png, tray icons (generated)
│
├── .github/PULL_REQUEST_TEMPLATE.md
├── Dockerfile.backend        # Builds the hub, then the API image that serves it
├── docker-compose.yml        # PostgreSQL + API
├── .env.example              # docker compose variables
├── DOCUMENTATION.md
├── LICENSE
└── README.md
```

---

## 5. Backend Deep Dive

The backend follows a strict layering: **router → schema (validation) → service (business rules) → crud (queries) → model**. Routers stay thin, services never touch `req`/`res`, and only `crud/` builds queries.

### `server.js` — Process Entry Point

1. Verifies the database connection, with a clear message if PostgreSQL is down.
2. Applies pending migrations (`migrator.up()`), so a fresh database works on first boot.
3. Logs the speech-to-text and AI providers in use. With `ASR_PROVIDER=local` the Whisper model is loaded before the first request.
4. Starts the hourly retention job.
5. Listens on `PORT` and shuts down gracefully on SIGINT/SIGTERM.

### `app/main.js` — Express App

- `X-Response-Time-Ms` timing header, plus a per-request timing log line for `/api/*`.
- `helmet` with a strict CSP: the hub's own scripts, self-hosted fonts, and `blob:` URLs for audio playback.
- CORS allowlist from `CORS_ORIGINS`. Requests with no origin, such as the desktop app or curl, are allowed.
- 1 MB JSON body limit, `/api/v1` router, a 404 for unknown API paths, and the central `errorHandler`.
- When `SERVE_FRONTEND=true` and `../frontend/dist/index.html` exists, it serves the built hub with an SPA fallback.

### `app/api/` — Route Handlers

| Router | Mount | Responsibility |
| --- | --- | --- |
| `auth_router` | `/auth` | register, login, change password, log out everywhere |
| `users_router` | `/users` | profile, onboarding, account deletion |
| `preferences_router` | `/preferences` | read/update every setting (shortcut conflict checks) |
| `devices_router` | `/devices` | desktop installs registered per user |
| `dictation_router` | `/dictation` | transcribe audio, Command Mode, format typed text |
| `history_router` | `/history` | transcript list/search, edit, retry, audio, delete |
| `stats_router` | `/stats` | Home stat pills |
| `dictionary_router` / `snippets_router` | `/dictionary`, `/snippets` | built from the shared `entry_routes.js` |
| `styles_router` | `/styles` | per-category writing style + apps |
| `transforms_router` | `/transforms` | transforms, playground runs, undo, Command Mode history |
| `notifications_router` | `/notifications` | inbox, read/archive |
| `data_router` | `/data` | export, clear history |
| `sync_router` | `/sync` | Server-Sent Events stream |
| `system_router` | `/system` | health (database, speech-to-text, LLM status) |

### `app/models/` — Sequelize Models

All models use `underscored: true` with explicit `created_at`/`updated_at`. Associations live in `models/index.js`, and enum-like values (styles, modes, sources, notification types) live in `models/constants.js`, shared by models, schemas and migrations.

### `app/schemas/` — Zod Schemas

Each schema file holds the request validators for one area, plus `toXOut()` functions that shape responses. Password hashes, internal flags and audio bytes never leave the API. `core/validators.js` exposes `validate({ body, query, params })`. Validated query values land on `req.validatedQuery`, because Express 5 makes `req.query` read-only.

### `app/crud/` — Database Operations

One module per aggregate (`user_crud`, `transcript_crud`, `dictionary_crud`…). Examples:

- `transcript_crud`: keyset pagination (`before=<created_at>`) and trigram search on `formatted_text`.
- `dictionary_crud`: case-insensitive uniqueness per user and type, usage counters.
- `user_crud`: failed-login counting and lockout (5 attempts → 15 minutes).

### `app/services/` — Business Logic

| Service | What it owns |
| --- | --- |
| `dictation_service` | The dictation pipeline (§11.1), retry from stored audio, typed-text formatting |
| `asr/` | Provider selection, Groq/OpenAI Whisper with a vocabulary prompt, automatic fallback to local Whisper (one inference at a time), short-clip hallucination filter |
| `audio/wav.js` | WAV parsing (PCM 8/16/24/32, float), down-mixing, resampling to 16 kHz, speech-span detection |
| `formatting/` | Rule engine, address handling, LLM cleanup with an "it answered instead of cleaning" guard, dictionary corrections, vocabulary casing, snippets, signature, final pass |
| `llm/` | Groq/OpenAI client (reasoning switched off per model family), Claude via the Anthropic SDK, prompts, typed errors |
| `text_instruction_service` | Runs an instruction on text with the LLM, or rule-based for tone, cleanup, lists, case and summaries |
| `command_service` | Command Mode: transcribe the spoken instruction, apply it to the selection, log `command_runs` |
| `transform_service` | Built-in and custom transforms, playground runs, undo |
| `style_service` / `app_category_service` | Style profiles; mapping an app, URL or window title to personal/work/email/other; classifying the focused field |
| `dictionary_service` | Words and snippets, import, learning new words from transcript edits |
| `stats_service` | Totals, words per minute, streaks, time saved |
| `notification_service` | Idempotent notifications (`UNIQUE(user_id, key)`), milestones, tips |
| `realtime_service` | In-memory SSE hub keyed by user |
| `retention_service` | Hourly expiry of audio and auto-deleted history |
| `export_service` | Full JSON export of a user's data |
| `auth_service` | Registration (plus default styles, transforms, welcome note), login, password change |

### `app/core/` — Cross-Cutting Concerns

`config.js` validates the environment with Zod at boot. If a provider is selected but its key is missing, it falls back to local Whisper / rules and logs a warning. `deps.js` holds `getCurrentActiveUser` (verifies the JWT, loads the user, checks `token_version`) and `audioUpload`. `errors.js` holds `HttpError` and the JSON error handler (`{ detail, code }`). `limiter.js` holds the rate limits (§10).

### `app/db/` — Database Setup

`session.js` creates the Sequelize instance (pool, UTC, global `underscored` + timestamp names) and `withTransaction()`. `migrator.js` wires Umzug to `migrations/*.js`, recording applied migrations in `schema_migrations`. `migration_helpers.js` provides `uuidPk`, `fk`, `timestamps` and `checkIn` (CHECK constraints for enum columns).

---

## 6. Frontend Deep Dive

### `src/App.jsx` — Routes

| Path | Screen |
| --- | --- |
| `/login`, `/register` | Auth pages |
| `/onboarding` | First-run flow: intent, typing locations, mic test, shortcut, privacy, try it |
| `/` | Home: stat pills, dictation card (browser only), history |
| `/dictionary`, `/snippets` | Entries pages (shared `components/entries`) |
| `/style` | Styles per category + auto-cleanup level |
| `/transforms` | Transforms list, playground, run history, polish settings |
| `/settings/:section?` | Settings modal over the current page: General, System, Account, Data and Privacy |

`ProtectedRoute` redirects to `/login` when signed out and to `/onboarding` until onboarding is complete.

### Sidebar and layout

`MainLayout` is exactly one viewport tall (`h-dvh`), and the sidebar and page scroll independently. The sidebar has the logo, the main pages (Home, Dictionary, Snippets, Style, Transforms) in a scrollable middle section, then Notifications (with unread count) and Settings, and the profile row pinned at the bottom. The profile row opens a menu (Account, Help & shortcuts, Log out) upwards, so it stays reachable at any window height or zoom level.

### `src/api/apiClient.js` — The API Layer

A single Axios instance. It sets the base URL to `window.flowDesktop.apiBaseUrl` inside the desktop app and `/api/v1` otherwise, and attaches the bearer token. A response interceptor turns a 401 into a clean sign-out, also clearing the desktop session. Every endpoint has a named function, so screens never build URLs themselves. `errorMessage()` turns API errors into readable text.

### `src/context/AppContext.jsx`

Loads the signed-in user, unread count and preferences. It exposes `savePreferences()` (optimistic update with rollback), applies the theme, and pushes the session and preferences to the desktop app. It subscribes to SSE events (`preferences.updated`, `notification`…) so changes made elsewhere appear immediately.

### Feature Modules

- **Home/**: `StatsPills` (streak, words, WPM), `DictationCard` (in-browser dictation with `useRecorder`; the desktop app shows the shortcut instead), `HistorySection` and `HistoryItem` (copy, edit, retry, play audio, archive, delete, feedback).
- **Dictionary/** and **Snippets/**: both built on `components/entries/EntriesPage` (search, sort, star, bulk select and delete, import).
- **Style/**: `StyleCard` per category, `AppsModal` to assign apps, and `AutoCleanup` (none/light/medium/high).
- **Transforms/**: `TransformRow` (toggle, edit, delete), `Playground` (run any transform on pasted text, with undo), `RunHistory` (transforms + Command Mode), `PolishSettings`.
- **Notifications/**: a drawer with read and archive actions.
- **Settings/**: General (shortcuts, microphone, languages, theme), System (sounds, mute, Murmur bar, startup, taskbar, notification categories), Account (profile, password, devices, log out everywhere, delete account), Data and Privacy (retention, export, clear history).

### `src/hooks/`

- `useRecorder`: mic → 16 kHz AudioWorklet → WAV, with a smoothed level for the waveform.
- `useServerEvents`: an SSE client over `fetch`, so it can send the bearer header, with reconnect and backoff.
- `useDebounce`.

### `src/desktop/bridge.js`

Exports `window.flowDesktop` when running inside Electron. Shortcut dialogs then capture keys through the native helper (browsers can't see the Win key), and onboarding can confirm that the desktop app heard your shortcut.

---

## 7. Desktop App Deep Dive

### Main Process (`desktop/main/`)

| Module | Responsibility |
| --- | --- |
| `index.js` | Single-instance lock, permission handlers (microphone + clipboard write for trusted origins only), window/tray creation, IPC handlers, applying preferences, fallback shortcuts when the helper is unavailable |
| `dictation.js` | `DictationController`: `idle → starting → recording → processing → idle`. Covers push-to-talk, conversion to hands-free, Command Mode, cancel, the 6-minute cap, tap debounce, mute timing, error messages and smart spacing (§11.3) |
| `flowbar.js` | Request/response protocol to the Murmur bar renderer (`bar:state`, `bar:record`, `bar:sound`, `bar:toast` ↔ `bar:reply`) |
| `windows.js` | Hub window (sandboxed; external links open in the browser; closing hides to tray; offline page when the API is down) and the Murmur bar (transparent, frameless, never focusable, always on top, click-through except over the pill) |
| `helper.js` | Spawns MurmurHelper.exe, request IDs and timeouts, auto-restart (up to 5 times) |
| `clipboard.js` | Paste without losing the user's clipboard: snapshot all formats, write, Ctrl+V, restore. Selection read for Command Mode via a sentinel and Ctrl+C |
| `api.js` | Desktop API client (bearer token, timeouts, `ApiError`, 401 handling) |
| `store.js` | `flow-settings.json` in the app's data folder (`%APPDATA%\Murmur`). Device UID, and the session token encrypted with DPAPI (`safeStorage`) |
| `tray.js` | Tray menu: account, open Murmur, paste last, Murmur bar and sounds toggles, settings, quit. The icon shows a red dot while listening |

### MurmurHelper.exe Protocol

MurmurHelper reads tab-separated commands on stdin and writes one JSON object per line on stdout.

| Command | Effect |
| --- | --- |
| `bindings\tpush_to_talk:Ctrl+Win\|hands_free:Ctrl+Win+Space\|…` | Replace the shortcut table |
| `state\trecording` / `state\tidle` | Lets Esc cancel only while recording |
| `capture\tstart` / `capture\tstop` | Shortcut-recording mode (keys are swallowed, combos reported) |
| `paste\t<id>` / `copy\t<id>` | Send Ctrl+V / Ctrl+C to the focused app (tagged so the hook ignores its own input) |
| `foreground\t<id>` | Process, app name, window title, browser URL, and the focused text box: `field` (accessible name), `before` (2 characters before the caret; `null` if the app doesn't expose its text, `""` at the start of a field), `password` |
| `mute` / `unmute` | Default output device mute (only unmutes what it muted) |

Events: `ready`, `hotkey {action, phase: down|up|press|cancel}`, `capture {keys, final}`, `result {id, ok, …}`. A Win-key combo masks the Start menu by injecting a no-op key, so releasing `Ctrl+Win` does not open Start. UI Automation lookups run off the hook thread with a 400–450 ms cap, so a slow app can never stall typing.

### Murmur bar (`renderer/flowbar/`)

A 440×150 transparent window holding the pill. States are idle (a small bar), hover (a hint with your shortcut), recording (a live waveform; hands-free adds cancel and stop buttons; Command Mode is tinted lilac), processing, success, error and toast. The recorder runs here: the AudioContext is created once and suspended between dictations, and the microphone is opened only while recording. Chimes are synthesised with Web Audio, so there are no audio files.

### Preload Bridges

- `preload/hub.js` exposes `window.flowDesktop`: `apiBaseUrl`, `setSession`, `clearSession`, `preferencesChanged`, `onHotkey`, and (when the helper exists) `captureShortcut`, `cancelShortcutCapture`, `onShortcutPreview`.
- `preload/flowbar.js` exposes `window.flowBar` for the renderer protocol.

Every IPC handler checks which window sent the message.

### Preferences the Desktop Applies

`shortcuts` → helper bindings · `show_flow_bar` · `flow_bar_position` (bottom/top) · `show_in_taskbar` · `enable_sounds` · `mute_audio_while_dictating` · `microphone_device_id` (falls back to the default mic if unplugged) · `context_awareness` (app, URL, title and field name are only sent to the API when on) · `command_mode_enabled` · `open_at_login` (installed build only; starts hidden in the tray).

---

## 8. Database Schema

13 tables plus `schema_migrations`. Every primary key is a UUID (`gen_random_uuid()`) unless noted, every foreign key cascades on update, and every timestamp is `timestamptz`.

### Entity Relationship Diagram

```
users ──────────────────────────────────────────────────────────────────────
 │  id, email UNIQUE, password_hash, first_name, last_name, avatar_url,
 │  product_intent, onboarding_completed, token_version, failed_login_count, ...
 │
 ├── 1:1  user_preferences (user_id PK/FK)        every setting, JSONB shortcuts
 ├── 1:N  devices                                 UNIQUE(user_id, device_uid)
 ├── 1:N  transcripts (device_id → devices SET NULL)
 │         ├── 1:1 transcript_audio (transcript_id PK/FK)   WAV bytes
 │         └── command_runs.transcript_id (SET NULL)
 ├── 1:N  daily_activity                          PK(user_id, activity_date)
 ├── 1:N  app_usage                               PK(user_id, app_name)
 ├── 1:N  dictionary_entries                      words AND snippets (is_snippet)
 ├── 1:N  style_profiles                          UNIQUE(user_id, category)
 ├── 1:N  transforms                              UNIQUE(user_id, name)
 │         └── transform_runs (transform_id → SET NULL)
 ├── 1:N  command_runs
 └── 1:N  notifications                           UNIQUE(user_id, key)
```

### Table Details

#### `users`
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| email | varchar(255) | NOT NULL, UNIQUE (stored lower-case) |
| password_hash | varchar(255) | bcrypt |
| first_name / last_name | varchar(100) | last name optional; both are sent to Whisper as spelling hints |
| avatar_url | text | |
| product_intent | varchar(30) | onboarding answer |
| onboarding_completed / _at | boolean / timestamptz | |
| token_version | integer | bumped to revoke all JWTs |
| failed_login_count / locked_until | integer / timestamptz | lockout |
| last_login_at, created_at, updated_at | timestamptz | |

#### `user_preferences` (PK = `user_id`)
| Column | Type | Default |
| --- | --- | --- |
| ai_formatting / smart_formatting | boolean | true / true |
| auto_cleanup_level | varchar(10) CHECK none/light/medium/high | `light` |
| selected_languages | varchar(10)[] | `{en}` (empty = auto-detect) |
| ui_locale / timezone | varchar | `en` / `UTC` |
| microphone_device_id / microphone_label | text | null = system default |
| shortcuts | jsonb | `{push_to_talk:[Ctrl,Win], hands_free:[Ctrl,Win,Space], command_mode:[Ctrl,Win,Alt], paste_last:[Shift,Alt,Z], copy_last:[Shift,Alt,X], cancel:[Esc]}` |
| enable_sounds, mute_audio_while_dictating, open_at_login, show_flow_bar, show_in_taskbar | boolean | true |
| auto_add_to_dictionary, context_awareness, command_mode_enabled | boolean | true |
| email_auto_signature / email_signature | boolean / text | false / null |
| polish_instructions | jsonb | 7 toggles (concise, clarify, keep tone, …) |
| privacy_mode | boolean | false |
| data_retention | varchar(20) CHECK store/auto_delete_24h/never_store | `store` |
| notification_settings | jsonb | tips_and_suggestions, feature_highlights, milestones_and_progress |
| theme | CHECK light/dark/system | `light` |
| dictionary_sort / flow_bar_position | varchar | `newest` / `bottom` |
| user_information / typing_locations | jsonb / varchar(50)[] | onboarding answers |

#### `devices`
`id`, `user_id` FK, `device_uid` varchar(100), `platform`, `arch`, `device_name`, `app_version`, `last_seen_at`, timestamps. **UNIQUE(user_id, device_uid)**, so registering again is an upsert.

#### `transcripts`
| Column | Type | Notes |
| --- | --- | --- |
| user_id / device_id | uuid FK | device SET NULL |
| status | CHECK success/empty/no_audio/error/dismissed | |
| mode | CHECK push_to_talk/hands_free/command/web/retry | |
| asr_text / formatted_text / edited_text | text | raw → cleaned → user's edit |
| app_name, app_category, url, window_title | | context (null when context awareness is off) |
| language / detected_language | varchar(10) | |
| num_words, duration_seconds, speech_duration_seconds | | WPM uses the speech span |
| asr_provider / asr_model / formatter / llm_model | | which engines produced the text (`formatter` is `groq`, `rules`, `address`, …) |
| asr_latency_ms / format_latency_ms / e2e_latency_ms | integer | |
| personalization | jsonb | category, field type, style, cleanup level and toggles in effect |
| num_dictionary_replacements / num_snippets_expanded | integer | |
| mic_device, timezone_offset_minutes, app_version, platform | | client metadata |
| is_archived / has_reverted_ai / feedback / error_message | | |

Indexes: (user_id, created_at DESC), (user_id, is_archived, created_at), (user_id, app_name), **GIN trigram on formatted_text** for search.

#### `transcript_audio` (PK = `transcript_id`)
`mime_type`, `sample_rate`, `size_bytes`, `data` bytea, `created_at` (indexed for retention). Kept in its own table so history queries never load audio. Not written in Privacy Mode, and expired after `AUDIO_RETENTION_DAYS`.

#### `daily_activity` (PK user_id + activity_date) / `app_usage` (PK user_id + app_name)
Rollups updated after every dictation: words, dictations and duration per day; words, dictations, category and last use per app. They power the Home stat pills and survive history deletion.

#### `dictionary_entries`
| Column | Notes |
| --- | --- |
| user_id | owner (CASCADE) |
| phrase | the word, or the snippet's cue |
| replacement | correction target (words) or snippet text |
| is_snippet / is_starred | |
| source | CHECK manual/auto_learned/import/default |
| frequency_used / last_used_at | usage counters |

Unique index **(user_id, lower(phrase), is_snippet)**: case-insensitive, with separate namespaces for words and snippets. Index (user_id, is_snippet, created_at).

#### `style_profiles`
`category` CHECK personal/work/email/other, `name`, `app_names` varchar(100)[], `style` CHECK formal/casual/very_casual/excited. **UNIQUE(user_id, category)**; four rows are created per user at registration.

#### `transforms` / `transform_runs` / `command_runs`
- `transforms`: `name` (UNIQUE per user), `instruction`, `icon`, `is_builtin`, `is_enabled`, `sort_order`.
- `transform_runs`: `transform_id` (SET NULL), `instruction`, `input_text`, `output_text`, word counts, `app_name`, `status` CHECK success/no_changes/error, `provider`, `model`, `processing_ms`, `is_undone`.
- `command_runs`: `transcript_id` (SET NULL), `instruction`, `selected_text`, `output_text`, `app_name`, `status` CHECK success/error/unsupported, `provider`, `model`, `processing_ms`.

#### `notifications`
`type` CHECK milestone/tip/feature/system/learning, `key` (**UNIQUE per user**, which makes notifications idempotent, e.g. `milestone:words:1000`), `title`, `body`, `action_label`, `action_url`, `is_read`, `is_archived`.

### Key Design Decisions

1. **Words and snippets share one table.** They have the same shape (phrase → replacement) and the same import flow. `is_snippet` separates the namespaces in the unique index.
2. **Audio is split from transcripts**, so list queries stay fast and retention can drop audio while keeping text.
3. **Rollup tables** (`daily_activity`, `app_usage`) keep stats cheap and survive history deletion.
4. **CHECK constraints instead of PostgreSQL enums**, so adding a value is a one-line migration with no `ALTER TYPE`.
5. **`token_version` on users** gives instant revocation of every JWT without a session table.
6. **Idempotency keys on notifications** mean milestone checks can run on every dictation without duplicates.

---

## 9. API Reference

Base URL: `/api/v1`. All endpoints except `/auth/register`, `/auth/login` and `/system/health` need `Authorization: Bearer <token>`. Errors look like `{ "detail": "…", "code": "…" }`.

### Authentication
| Method | Path | Body / Notes |
| --- | --- | --- |
| POST | `/auth/register` | `first_name, last_name?, email, password, timezone?` → 201 `{ user, access_token, token_type, expires_at }` (signed in, remember-me length) |
| POST | `/auth/login` | `email, password, remember_me?` → `{ user, access_token, token_type, expires_at }` (60 min, or 30 days with remember me) |
| POST | `/auth/change-password` | `old_password, new_password` → new token; other sessions revoked |
| POST | `/auth/logout-all` | Revokes every token |

### Users & Preferences
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/users/me` | `{ user, unread_notifications }` |
| PATCH | `/users/me` | `first_name, last_name, avatar_url` |
| POST | `/users/me/onboarding` | `product_intent, role, writing_needs, typing_locations, selected_languages, timezone`: marks onboarding complete |
| POST | `/users/me/onboarding/reset` | Replay onboarding |
| DELETE | `/users/me` | `{ password }` |
| GET / PATCH | `/preferences` | Partial update; 422 `shortcut_conflict` if two actions share keys |
| GET / POST / DELETE | `/devices`, `/devices/:id` | Register (upsert by `device_uid`), list, remove |

### Dictation
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/dictation/transcribe` | multipart `audio` (WAV ≤ 25 MB) + `mode, app_name, url, window_title, field_name, language, device_uid, mic_device, app_version, platform, timezone_offset_minutes` → `{ status, text, transcript, timings }`; `status` is success/empty/no_audio |
| POST | `/dictation/command` | multipart `audio` or `instruction` + `selected_text` → `{ status, output, … }` |
| POST | `/dictation/format` | `{ text, app_name?, url?, window_title?, field_name?, style?, cleanup_level? }`: format typed text (not stored) |

### History
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/history` | `search, archived, app, limit (≤100), before` (keyset pagination) |
| GET | `/history/last` | Most recent successful transcript (paste/copy last) |
| GET / PATCH / DELETE | `/history/:id` | PATCH `edited_text, is_archived, feedback, has_reverted_ai`; edits can teach the dictionary |
| GET | `/history/:id/audio` | The stored WAV |
| POST | `/history/:id/retry` | Re-run speech-to-text + formatting on stored audio |
| DELETE | `/history` | Clear all history |

### Dictionary & Snippets (same shape)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dictionary`, `/snippets` | `search, sort (newest/oldest/alphabetical/starred)` |
| POST | same | Create (`phrase, replacement?`) |
| PUT / DELETE | `/:id` | Update (incl. `is_starred`) / delete |
| POST | `/bulk-delete` | `{ ids: [] }` |
| POST | `/import` | Bulk add, skipping duplicates |

### Styles, Stats
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/styles` | Four category profiles |
| PUT | `/styles/:category` | `style`, `app_names` |
| GET | `/stats/summary` | Total words/dictations/duration, average WPM, today, this week, apps, time saved, day streak, longest day streak, week streak |

### Transforms
| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/transforms` | List (built-in + custom) / create |
| PATCH / DELETE | `/transforms/:id` | Built-ins can be disabled but not renamed or deleted |
| POST | `/transforms/apply` | `{ transform_id or instruction, text, app_name? }` → output + run |
| GET | `/transforms/history` | Transform runs |
| POST | `/transforms/history/:id/undo` | Mark undone |
| GET | `/transforms/commands` | Command Mode history |

### Notifications, Data, Sync, System
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications` | Inbox (`include_archived=true` to show archived) |
| POST | `/notifications/read-all`, `/archive-all`, `/:id/read`, `/:id/archive` | |
| GET | `/data/export` | JSON download of everything (`murmur-export-<date>.json`) |
| DELETE | `/data/history` | Delete dictation, transform and command history |
| GET | `/sync/events` | SSE stream (see §11.8) |
| GET | `/system/health` | `{ status, database, asr: {provider, model, ready}, llm: {provider, model, enabled} }` |

---

## 10. Authentication Flow

### Registration
1. `POST /auth/register` is validated with Zod (password ≥ 8 characters with a letter and a number).
2. In one transaction: create the user (bcrypt hash), default preferences, four style profiles and the built-in transforms.
3. Then a welcome notification.
4. Returns a JWT. The hub sends the user through onboarding.

### Login
1. `POST /auth/login` (limited to 10 per minute per IP).
2. The bcrypt check runs even for unknown emails, so timing doesn't reveal which accounts exist. The error is the same generic message for both cases.
3. 5 wrong passwords lock the account for 15 minutes (`429 account_locked`).
4. JWT claims: `sub` (user id) and `ver` (token_version). Lifetime is 60 minutes, or 30 days with "Remember me".

### Authenticated Requests
`getCurrentActiveUser` verifies the signature and expiry, loads the user, and rejects the token if `ver ≠ users.token_version`. The hub keeps the token in localStorage ("Remember me") or sessionStorage. The desktop app keeps its own copy encrypted with DPAPI, which the hub hands over through `flowDesktop.setSession()`.

### Change Password / Log Out Everywhere
Both increment `token_version`, which invalidates every outstanding token immediately. Change password returns a fresh token for the current session.

### Rate Limits
| Limiter | Window | Max |
| --- | --- | --- |
| login | 1 min | 10 |
| register | 1 hour | 20 |
| password change | 1 min | 5 |
| dictation | 1 min | 120 |
| LLM (Command Mode, typed-text format, transforms) | 1 min | 60 |

---

## 11. Key Business Logic

### 11.1 Dictation Pipeline (`dictation_service.processDictation`)
1. **Decode**: parse the WAV, down-mix, resample to 16 kHz, and measure the speech span and level.
2. **No speech** → `status: no_audio` (stored for diagnostics).
3. **Context**: map the app, URL or window title to a category (§11.5) and that category's style. Classify the focused field (§11.4). Load cleanup level, toggles, dictionary and snippets.
4. **Speech-to-text**: Groq Whisper with a prompt of the user's first and last name, dictionary words and correction targets, which steers spelling of names and jargon. If Groq fails, local Whisper takes over automatically. Very short clips that come back as "Thank you." are treated as hallucinations.
5. **Format** (§11.2), then dictionary corrections, vocabulary casing, snippet expansion, the email signature and the final pass.
6. **Persist**: transcript (+ audio unless Privacy Mode; nothing at all with `never_store`), usage counters on matched entries, daily/app rollups, milestone notifications.
7. **Publish** `transcript.created` over SSE and return the text plus timings.

### 11.2 Formatting
**With an LLM** (Groq `qwen/qwen3.8-27b` by default, reasoning switched off, about 150–220 ms): the prompt covers the cleanup level, self-corrections, the style, addresses, fragments, the field type, lists and spoken commands, the user's name and dictionary, and "never answer the dictation". If the model's output is much longer than what was said, it answered instead of cleaning, so the rule-based result is used. Timeouts and errors also fall back to the rules.

**Rule engine** (`formatting/rules.js`), applied in order for English (other languages get whitespace cleanup only). Email and web addresses are masked before the sentence rules run and restored afterwards.

| Step | Example |
| --- | --- |
| Spoken commands | "new line", "new paragraph", "question mark", "exclamation point", "full stop", a final "period", "open quote" / "close quote" |
| Addresses (§11.4) | "kapil dot sharma at gmail dot com" → `kapil.sharma@gmail.com`, "gmail. Com" → `gmail.com` |
| Times | "4pm", "4 p.m." → "4 PM" |
| Fillers (light+) | "um", "uh", "er", "hmm" and their variants |
| Phrase fillers (medium/high) | "you know", "I mean", filler "like", "basically", "well", "so", "anyway", "kind of"; high also drops "honestly", "literally", "actually" |
| Stutters | "I I I think" → "I think" |
| Self-corrections | "Tuesday, no wait, Wednesday" → "Wednesday"; "by 3pm, actually make it 4pm" → "by 4 PM"; "scratch that" removes the previous sentence |
| Lists | "1. … 2. …", "number one … number two …" or "first … second … third …" → numbered list |
| Punctuation + capitalisation | sentence case, spacing, doubled punctuation, weekday/month names. A "." inside a word (`3.5`, `Node.js`) is never a sentence end |
| Style | formal: ends with a period · casual: no final period · very casual: lower-case starts, no final period, "4pm" · excited: ends with "!" |
| Email layout | greeting / body / sign-off on separate paragraphs in email apps (message body only) |

**Final pass** (`finalizeText`, every path): addresses re-normalised (the dictionary or an LLM may have re-capitalised one). No period after a lone address, a sentence ending in an address, a one- or two-word fragment ("YouTube", "Kapil") or anything in a short field. Otherwise the style's ending is enforced: formal adds a period, casual and very casual drop it.

### 11.3 Spacing Between Dictations (desktop)
Each dictation is pasted where the cursor is, so two in a row would run together ("…the transcript.Kapil"). At the start of a dictation MurmurHelper reads the two characters before the caret through UI Automation:
- After text that doesn't end in a space, an opening bracket or quote, `/`, `@`, `#` or `-`, a leading space is added, unless the dictation starts with punctuation.
- At the start of a field or after a space or newline, nothing is added.
- If the app doesn't expose its text (some Electron and legacy apps), a dictation that follows Murmur's own paste into the same window within a minute is treated as a continuation.

### 11.4 Addresses and Field Types
`formatting/addresses.js` turns spoken separators into symbols only where an address is clearly meant:
- **Domains:** "word dot word … dot <TLD>" → joined. A known TLD is required, and phrases like "the dot com bubble" are left alone.
- **Emails:** "<mailbox> at <domain>" or Whisper's own "<mailbox>@<domain>" are joined with any "dot / underscore / dash" parts of the mailbox. A word split off a spelled-out mailbox is re-attached ("kapil dot login hta@gmail.com" → `kapil.loginhta@gmail.com`). Words like "look", "I'm" and "home" never start a mailbox.
- **Split repair:** "gmail. Com" → `gmail.com`, only for endings that are never English words (com, org, net, io, edu, gov, xyz, biz), so "Delhi. In the morning" is untouched.
- **Case:** emails are lower-cased; for URLs only the host is.

`app_category_service.classifyField` maps the focused field's accessible name:

| Field type | Matches | Formatting |
| --- | --- | --- |
| `address` | exactly To, Cc, Bcc, "To recipients", Recipients, Email, Email address | if the words look like an address, they are joined into addresses (`john@gmail.com, sam@acme.io`) with no sentence formatting; anything else (a contact's name) is treated as `short` |
| `short` | subject, search, find, address bar, URL, title, name, username, phone, query | normal cleanup, no final period, no email layout or signature |
| `text` | everything else (e.g. Gmail's "Message Body") | full formatting |

### 11.5 Styles & App Categories
`app_category_service` checks the browser URL first (`mail.google.com` → email, `app.slack.com` → work, `web.whatsapp.com` → personal), then your own app lists on the Style page, then the window title ("Inbox - Gmail - Chrome"), then the process name (outlook, slack, whatsapp…). Anything else is "other", which includes dictation from the hub itself. Defaults: personal = casual, the others = formal.

### 11.6 Dictionary & Snippets
- **Corrections**: `phrase → replacement` (e.g. "couple" → "Kapil") use whole-word, case-insensitive matching.
- **Vocabulary**: entries without a replacement fix casing and close mis-spellings through fuzzy and phonetic matching, and are sent to Whisper and the LLM as hints.
- **Snippets**: when the cue phrase is spoken, it is replaced by the stored text (multi-line supported).
- **Auto-learn**: when you edit a transcript in History and "auto add to dictionary" is on, new names and unusual words become `auto_learned` entries, with a "Murmur learned…" notification.

### 11.7 Command Mode & Transforms
`text_instruction_service` runs an instruction on text:
- With an LLM: a Command or Transform prompt; wrapper text like "Here is the rewritten…" is stripped; refusals become friendly errors.
- Without an LLM: rule-based handlers for tone (formal/casual/excited), cleanup, bullet and numbered lists, upper/lower/title case, concise and summaries. Anything else returns a clear "needs an AI provider" message.

Built-in transforms: Polish, Make it concise, Fix grammar, Make it formal, Make it friendly, Bullet points, Summarize.

### 11.8 Notifications & Realtime Sync
Notifications: word milestones (100 up to 1,000,000), day streaks (3, 7, 14, 30, 50, 100, 365), a welcome tip and learned dictionary words. Each has a stable `key`, so creating it twice is a no-op, and categories can be muted in Settings > System.

`GET /sync/events` streams `transcript.created|updated|deleted|cleared`, `preferences.updated`, `dictionary.changed` and `notification`, with a heartbeat every 25 s. The hub uses `fetch` streaming, so the bearer header is sent, and reconnects with backoff.

### 11.9 Privacy & Retention
| Setting | Effect |
| --- | --- |
| Privacy Mode | Recordings are never stored (retry is unavailable) |
| `auto_delete_24h` | The hourly job deletes your transcripts older than 24 h |
| `never_store` | Transcripts are returned but never written to the database |
| Always | Audio older than `AUDIO_RETENTION_DAYS` (14) is deleted |
| Context awareness off | The desktop doesn't send the app, URL, window title or field name |

---

## 12. Local Development Setup

### Prerequisites
- **Node.js 20+** (24 recommended)
- **PostgreSQL 15+** (18 recommended), running locally
- **A Groq API key** (free at console.groq.com). Optional: without it Murmur uses local Whisper and the rule engine.
- **Windows 10/11** for the desktop app (MurmurHelper is compiled with the `csc.exe` that ships with .NET Framework 4)

### Step 1 — Backend
```bash
cd backend
npm install
cp .env.example .env
```
Edit `.env`:
- `DATABASE_ADMIN_URL`: your `postgres` superuser URL (only used by the next command).
- `DATABASE_URL`: the app role and database to create (pick a password).
- `SECRET_KEY`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `GROQ_API_KEY=…`, `ASR_PROVIDER=groq`, `LLM_PROVIDER=groq`

```bash
npm run db:setup        # creates the role + database (idempotent)
npm run migrate         # optional: the server also migrates on boot
npm run seed            # optional demo data: demo@murmur.local / Demo12345
npm run dev             # http://localhost:8000
```
Check: http://localhost:8000/api/v1/system/health should report `"database":"up"` and the providers in use.

### Step 2 — Hub
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173
```

### Step 3 — Desktop
```bash
cd desktop
npm install             # postinstall compiles helper/bin/MurmurHelper.exe
npm run dev             # hub from Vite (5173)
# or: npm start         # hub served by the API (after `npm run build` in frontend)
```
`scripts/start.js` removes `ELECTRON_RUN_AS_NODE` before launching. VS Code terminals set it, and it stops Electron from opening windows.

Sign in. The Murmur bar appears at the bottom of the screen. Hold `Ctrl+Win` in Notepad, say something, release.

### Useful scripts
| Where | Script | Does |
| --- | --- | --- |
| backend | `npm test` | 44 tests (API, formatting, instructions), always offline: local Whisper and rules |
| backend | `npm run migrate:status` | Inspect migrations |
| backend | `npm run seed -- --reset` | Recreate the demo account |
| backend | `npm run model:download` | Pre-fetch the local Whisper model (offline fallback) |
| frontend | `npm run lint` / `npm run build` | ESLint (React Compiler rules) / production build |
| desktop | `npm run build:helper` / `npm run icons` | Rebuild MurmurHelper.exe / regenerate icons |
| desktop | `npm run dist` | Windows installer in `desktop/dist/` |

---

## 13. Deployment (Docker)

`Dockerfile.backend` builds the hub with Vite, then builds the API image that serves it. By default it also bakes the local Whisper model into the image as the offline fallback (`--build-arg PRELOAD_MODEL=false` to skip). `docker-compose.yml` runs PostgreSQL 18 (database `murmur`, not exposed to the host) and the API, with Groq as the default providers.

```bash
cp .env.example .env        # set POSTGRES_PASSWORD, SECRET_KEY and GROQ_API_KEY
docker compose up --build
docker compose exec api node scripts/seed.js     # optional demo account
```

Open http://localhost:8000. Migrations run automatically on start. For a hosted deployment, put HTTPS in front of the API (browsers only allow the microphone on HTTPS or localhost). Point the desktop app at it with `API_URL=https://your-host`, plus `HUB_URL` if the hub is hosted elsewhere, and add that origin to `CORS_ORIGINS`.

The desktop installer is built separately on Windows: `cd desktop && npm run dist`. It bundles MurmurHelper.exe as an extra resource.

### Releasing an update

Installed copies of Murmur update themselves (`electron-updater` reads this repo's GitHub releases): they check 20 seconds after start-up and every 6 hours, download a newer installer in the background, and install it when the user chooses **Restart to update** in the tray menu or the next time Murmur quits.

To ship an app change:
1. Raise `version` in `desktop/package.json` (it must be higher than the last release).
2. Run `npm run release -- "What changed"` in `desktop/`. It builds the installer and publishes the GitHub release with the three files the updater needs: `Murmur-Setup.exe`, its `.blockmap` and `latest.yml`. It refuses to run if that version is already published.

Server and database changes need no release: pushing to `main` redeploys the API on Render. The first updater-enabled build is 1.0.2; older installs must be reinstalled once by hand.

---

## 14. Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | development | development / production / test |
| `PORT` | 8000 | HTTP port |
| `CORS_ORIGINS` | localhost:5173 | Comma-separated allowed browser origins |
| `SERVE_FRONTEND` | true | Serve `../frontend/dist` when it exists |
| `DATABASE_URL` | **required** | `postgres://user:pass@host:5432/db` |
| `DATABASE_ADMIN_URL` | – | Superuser URL used only by `npm run db:setup` |
| `SECRET_KEY` | **required** (≥ 16 chars) | JWT signing key |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 60 | Normal session length |
| `REMEMBER_ME_EXPIRE_DAYS` | 30 | "Remember me" session length |
| `ASR_PROVIDER` | local | groq (recommended) / local / openai |
| `GROQ_ASR_MODEL` | whisper-large-v3-turbo | Groq speech-to-text model |
| `LOCAL_WHISPER_MODEL` | onnx-community/whisper-base | Any transformers.js Whisper model |
| `LOCAL_WHISPER_DTYPE` | q8 | Quantisation (q8, fp16, fp32…) |
| `ASR_PRELOAD` | true | Load the local model at boot (only with `ASR_PROVIDER=local`) |
| `OPENAI_ASR_MODEL` | whisper-1 | OpenAI speech-to-text model |
| `LLM_PROVIDER` | none | groq (recommended) / anthropic / openai / none |
| `GROQ_LLM_MODEL` | qwen/qwen3.8-27b | Groq cleanup model (reasoning switched off automatically) |
| `ANTHROPIC_MODEL` | claude-opus-5-5 | Claude model |
| `OPENAI_LLM_MODEL` | gpt-4.1-mini | OpenAI model |
| `LLM_TIMEOUT_MS` | 12000 | Falls back to rules on timeout |
| `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | – | Only the providers you use; never commit them |
| `AUDIO_RETENTION_DAYS` | 14 | Audio expiry |

### Desktop (environment at launch)
| Variable | Default | Description |
| --- | --- | --- |
| `API_URL` | http://localhost:8000 | Backend origin |
| `HUB_URL` | = `API_URL` | Hub origin (`npm run dev` sets http://localhost:5173) |

### Docker compose (root `.env`)
`POSTGRES_PASSWORD`, `SECRET_KEY`, `API_PORT`, `CORS_ORIGINS`, `GROQ_API_KEY`, `ASR_PROVIDER`, `GROQ_ASR_MODEL`, `PRELOAD_MODEL`, `LLM_PROVIDER`, `GROQ_LLM_MODEL`, `ANTHROPIC_MODEL` and the other provider keys. See `.env.example`.

---

## 15. Testing

```bash
cd backend && npm test
```
The suite forces local Whisper and the rule engine whatever `.env` says, so it runs offline and gives the same result every time (`TEST_USE_PROVIDERS=1` uses the real providers). It runs against `<database>_test`.
- `formatting.test.js`: the rule engine (fillers, stutters, self-corrections including stacked cues, lists, styles, email layout, snippets, dictionary), addresses, recipient fields, fragments and field types.
- `text_instruction.test.js`: offline Command Mode and Transforms, learning from edits, app categories, streaks.
- `api.test.js`: end-to-end over HTTP with supertest. Covers register/login/lockout, dictation with a real WAV fixture (`tests/fixtures/lunch.wav`), no word limit, field-aware formatting, history editing and pagination, dictionary/snippets, removed endpoints returning 404, transforms, export and account deletion.

The frontend is checked with `npm run lint` (including the React Compiler hook rules) and `npm run build`. The desktop dictation path (recorder → WAV → API → paste) and the spacing rules are verified with Chromium's fake audio device playing the WAV fixture in an offscreen window.

---

## 16. Password Management

### Change Password While Signed In (Preferred)
Settings → Account → Change password. Other devices are signed out immediately, and the current session receives a fresh token.

### Reset a Forgotten Password (Admin)
There is no email delivery, so a forgotten password is reset directly in the database:
```bash
cd backend
node -e "import('bcryptjs').then(async b => console.log(await b.default.hash(process.argv[1], 12)))" "NewPassw0rd"
```
```sql
UPDATE users
SET password_hash = '<hash from above>', token_version = token_version + 1,
    failed_login_count = 0, locked_until = NULL
WHERE email = 'someone@example.com';
```

### Password Requirements
8–128 characters, with at least one letter and one number. The register page shows a live strength meter.

---

## 17. Project History

Murmur started as a full Wispr Flow clone (migrations 0001–0007) with teams, plans and billing, referrals, a Scratchpad for notes, and an Insights page. It was then narrowed to a personal app:

- **Removed:** teams and shared dictionaries, plans/checkout/trials and the weekly word limit, referrals ("Get a free month"), Scratchpad notes and their versions, the Insights page (heatmap, top apps).
- **Migration `0008_personal_edition`** drops `teams`, `team_members`, `team_invitations`, `referrals`, `subscriptions`, `billing_events`, `notes` and `note_versions`, the `team_id`, `note_id`, `referral_code`, `referred_by_user_id` and `notes_view` columns, and team/billing/usage notifications. It is **one-way**: back up an existing database (`pg_dump`) before upgrading it.
- **Added:** Groq speech-to-text and cleanup, address handling, field-aware formatting, smart spacing between dictations, and the Murmur name.

The first commit in git holds the full clone; the second holds the Murmur changes.

---

## 18. Converting This Document to Word (.docx)

### Option A — Pandoc (Recommended)
```bash
winget install --id JohnMacFarlane.Pandoc
pandoc DOCUMENTATION.md -o DOCUMENTATION.docx --toc
```

### Option B — Online
Paste the Markdown into any Markdown-to-Word converter, or open it in VS Code with a Markdown-to-Word extension.
