# Whisper Flow

Whisper Flow is a full-stack voice dictation app modelled on Wispr Flow. Hold a shortcut in any Windows app, speak, let go, and clean, formatted text is typed where your cursor is. The hub app keeps your history, personal dictionary, snippets, writing styles, notes and usage insights in sync through a real API and database.

> Independent learning project. Not affiliated with or endorsed by Wispr, Inc. No Wispr code or assets are included. The app's behaviour, screens and data model were studied and then rebuilt from scratch.

## Core Features

**Dictate anywhere.** Hold `Ctrl + Win` to talk, release to paste. `Ctrl + Win + Space` switches to hands-free, `Ctrl + Win + Alt` opens Command Mode, `Esc` cancels, and `Shift + Alt + Z` pastes the last transcript again. A floating **Flow Bar** shows a live waveform. Your clipboard and system audio are restored afterwards.

**Speech-to-text with no API key.** Whisper runs on your machine through transformers.js. Groq or OpenAI Whisper can be switched on for higher accuracy.

**Smart cleanup.** Removes fillers ("um", "you know"), stutters and self-corrections ("Tuesday, no wait, Wednesday" becomes "Wednesday"). It follows spoken commands ("new line", "scratch that"), builds lists, and adapts to the app you're in: formal for work, casual for chat, a laid-out email for Gmail or Outlook. An optional LLM pass (Claude, OpenAI or Groq) adds AI polish.

**Personal dictionary and snippets.** Teach Flow names and jargon it should always spell right, or have it learn them from your corrections. Say a cue phrase ("my calendar link") to insert a saved snippet. Both can be shared with your team.

**Notes, Transforms and Command Mode.** Write notes in a scratchpad with version history. Rewrite selected text with one-click Transforms ("make it concise", "fix grammar") or with a spoken instruction.

**Insights and plans.** See words per day, streaks, an activity heatmap and your top apps. Flow Basic has a weekly word limit, and Pro has a 14-day trial, student plan, team seats and referrals. Checkout is simulated, so no real payments are taken.

**Privacy controls.** Privacy Mode (recordings are never kept), a "never store history" option, auto-delete after 24 hours, a full data export, and account deletion.

## Tech Stack

| Backend | Frontend (hub) | Desktop |
| --- | --- | --- |
| Node.js 24 + Express 5 | React 19 | Electron 44 |
| PostgreSQL 18 | Vite 8 | FlowHelper.exe (C#, Win32 keyboard hook) |
| Sequelize 6 + Umzug migrations | Tailwind CSS 3 | AudioWorklet recorder (16 kHz WAV) |
| Zod validation | Axios | Windows UI Automation (browser URL) |
| JWT + bcrypt auth | react-router-dom 7 | Core Audio (mute while dictating) |
| transformers.js (local Whisper) | lucide-react | safeStorage (DPAPI) for the session |
| Anthropic SDK / OpenAI-compatible LLMs | Server-Sent Events (live sync) | electron-builder (NSIS installer) |

## 📁 Project Structure

The project is a monorepo with the backend, the hub UI and the desktop app, each organised by responsibility.

```
prem-whisper-flow/
├── backend/
│   ├── app/
│   │   ├── api/          # API Endpoints (Express routers)
│   │   ├── core/         # Config, Security, Dependencies, Rate limits
│   │   ├── crud/         # Database Functions
│   │   ├── db/           # Sequelize connection + migrator
│   │   ├── models/       # Sequelize DB Models
│   │   ├── schemas/      # Zod Validation Schemas
│   │   └── services/     # Business Logic (ASR, LLM, formatting, billing...)
│   ├── migrations/       # Versioned schema (0001-0007)
│   ├── scripts/          # db:setup, migrate, seed, model:download
│   ├── tests/            # node:test suites (API + formatting engine)
│   └── server.js         # App Entrypoint
│
├── frontend/
│   └── src/
│       ├── api/          # Central API Client (Axios)
│       ├── auth/         # Login, Register Components
│       ├── components/   # Shared UI (Sidebar, Modals, Waveform)
│       ├── context/      # Signed-in user, preferences, plan
│       ├── Home/         # History & Dictation Feature Module
│       ├── Dictionary/   # Dictionary Feature Module
│       ├── Snippets/     # Snippets Feature Module
│       ├── Style/        # Writing Styles Feature Module
│       ├── Notes/        # Scratchpad Feature Module
│       ├── Transforms/   # Transforms & Polish Feature Module
│       ├── Insights/     # Analytics Feature Module
│       ├── Settings/     # Settings, Plans, Team, Privacy
│       ├── App.jsx       # Main Component & Routing
│       └── main.jsx      # Entry point
│
├── desktop/
│   ├── main/             # Electron main process (dictation, tray, windows)
│   ├── preload/          # Safe bridges for the hub and the Flow Bar
│   ├── renderer/         # Flow Bar UI + recorder, offline page
│   ├── helper/           # FlowHelper.cs (global shortcuts, paste, mute)
│   └── assets/           # App and tray icons
│
├── Dockerfile.backend
├── docker-compose.yml
├── DOCUMENTATION.md      # Full technical documentation
└── README.md
```

## Quick Start (Windows)

You need Node.js 20+ (24 recommended) and PostgreSQL 15+ (18 recommended). The desktop app also needs Windows 10/11 with the .NET Framework 4.x compiler, which is built into Windows.

```bash
# 1. Backend: API on http://localhost:8000
cd backend
npm install
cp .env.example .env          # set DATABASE_URL, DATABASE_ADMIN_URL, SECRET_KEY
npm run db:setup              # creates the database role + database
npm run seed                  # optional: demo@whisperflow.local / Demo12345
npm run dev                   # applies migrations, downloads Whisper on first run

# 2. Hub UI: hot reload on http://localhost:5173 (or `npm run build` and let the API serve it)
cd ../frontend
npm install
npm run dev

# 3. Desktop app: global shortcuts + Flow Bar
cd ../desktop
npm install                   # also compiles FlowHelper.exe
npm run dev                   # hub from Vite; use `npm start` for the API-served build
```

Sign in from the desktop window, then hold `Ctrl + Win` in any app and speak.

With Docker: `cp .env.example .env`, set the two secrets, then run `docker compose up --build` and open http://localhost:8000.

See [DOCUMENTATION.md](DOCUMENTATION.md) for the architecture, database schema, API reference and configuration.

## Security

**Password security:** Passwords are hashed with bcrypt and never stored in plain text. Five failed logins lock the account for 15 minutes.

**Authentication:** Sessions use JSON Web Tokens. "Log out everywhere" and password changes revoke every token immediately through a per-user token version.

**Data isolation:** Every query is scoped to the signed-in user. Only what you share with your team (members, shared dictionary words and snippets) is visible to that team's members.

**Desktop:** The session token is encrypted with Windows DPAPI. The hub runs sandboxed with context isolation and talks to the desktop only through a small, validated IPC bridge. The microphone is opened only while you dictate.
