# Murmur

Murmur is a personal voice dictation app. Hold a shortcut in any Windows app, speak, let go, and clean, formatted text is typed where your cursor is. A hub app keeps your history, personal dictionary, snippets, writing styles and transforms in sync through a real API and database.

**[Download for Windows](https://github.com/kapil13007/murmur/releases/latest/download/Murmur-Setup.exe)** · [Website](https://murmur-site.onrender.com) · Free: bring your own [Groq key](https://console.groq.com/keys)

> Independent personal project inspired by Wispr Flow. Not affiliated with or endorsed by Wispr, Inc., and no Wispr code or assets are included.

## Core Features

**Dictate anywhere.** Hold `Ctrl + Win` to talk, release to paste. `Ctrl + Win + Space` switches to hands-free, `Ctrl + Win + Alt` opens Command Mode, `Esc` cancels, and `Shift + Alt + Z` pastes the last transcript again. A floating **Murmur bar** shows a live waveform. Your clipboard and system audio are restored afterwards.

**Accurate speech-to-text.** Groq's `whisper-large-v3-turbo` transcribes in about 0.3 s and is primed with your name and dictionary, so names come out right. If Groq is unreachable, Whisper runs locally instead.

**Smart cleanup.** Groq's `qwen3.8-27b` (or Claude or OpenAI) removes fillers ("um", "you know"), applies self-corrections ("by 3pm, actually make it 4pm" becomes "by 4 PM"), follows spoken commands ("new line", "scratch that"), builds lists, and adapts to the app you're in. A built-in rule engine does the same offline.

**Knows where you're typing.**
- Email and web addresses come out exactly as typed: "kapil dot sharma at gmail dot com" becomes `kapil.sharma@gmail.com`.
- In a To/Cc box only addresses are produced; subject lines and search boxes get no trailing period.
- Back-to-back dictations get a space between them automatically.

**Personal dictionary and snippets.** Teach Murmur names and jargon it should always spell right, or let it learn them from your corrections. Say a cue phrase ("my calendar link") to insert a saved snippet.

**Transforms and Command Mode.** Rewrite text with one-click transforms ("Make it concise", "Fix grammar") or with a spoken instruction applied to the selected text.

**Privacy controls.** Privacy Mode (recordings are never kept), a "never store history" option, auto-delete after 24 hours, a full data export, and account deletion.

## Tech Stack

| Backend | Frontend (hub) | Desktop |
| --- | --- | --- |
| Node.js 24 + Express 5 | React 19 | Electron 44 |
| PostgreSQL 18 | Vite 8 | MurmurHelper.exe (C#: keyboard hook, UI Automation) |
| Sequelize 6 + Umzug migrations | Tailwind CSS 3 | AudioWorklet recorder (16 kHz WAV) |
| Zod validation | Axios | Core Audio (mute while dictating) |
| JWT + bcrypt auth | react-router-dom 7 | safeStorage (DPAPI) for the session |
| Groq (Whisper + Qwen), local Whisper fallback | lucide-react | electron-builder (NSIS installer) |
| Anthropic SDK / OpenAI-compatible LLMs | Server-Sent Events (live sync) | |

## 📁 Project Structure

The project is a monorepo with the backend, the hub UI and the desktop app, each organised by responsibility.

```
murmur/
├── backend/
│   ├── app/
│   │   ├── api/          # API Endpoints (Express routers)
│   │   ├── core/         # Config, Security, Dependencies, Rate limits
│   │   ├── crud/         # Database Functions
│   │   ├── db/           # Sequelize connection + migrator
│   │   ├── models/       # Sequelize DB Models
│   │   ├── schemas/      # Zod Validation Schemas
│   │   └── services/     # Business Logic (speech-to-text, LLM, formatting...)
│   ├── migrations/       # Versioned schema (0001-0008)
│   ├── scripts/          # db:setup, migrate, seed, model:download
│   ├── tests/            # node:test suites (API + formatting engine)
│   └── server.js         # App Entrypoint
│
├── frontend/
│   └── src/
│       ├── api/          # Central API Client (Axios)
│       ├── auth/         # Login, Register Components
│       ├── components/   # Shared UI (Sidebar, Modals, Waveform)
│       ├── context/      # Signed-in user and preferences
│       ├── Home/         # History & Dictation Feature Module
│       ├── Dictionary/   # Dictionary Feature Module
│       ├── Snippets/     # Snippets Feature Module
│       ├── Style/        # Writing Styles Feature Module
│       ├── Transforms/   # Transforms & Polish Feature Module
│       ├── Notifications/# Notifications drawer
│       ├── Settings/     # General, System, Account, Privacy
│       ├── App.jsx       # Main Component & Routing
│       └── main.jsx      # Entry point
│
├── desktop/
│   ├── main/             # Electron main process (dictation, tray, windows)
│   ├── preload/          # Safe bridges for the hub and the Murmur bar
│   ├── renderer/         # Murmur bar UI + recorder, offline page
│   ├── helper/           # MurmurHelper.cs (global shortcuts, paste, mute, focused field)
│   └── assets/           # App and tray icons
│
├── Dockerfile.backend
├── docker-compose.yml
├── DOCUMENTATION.md      # Full technical documentation
└── README.md
```

## Quick Start (Windows)

You need Node.js 20+ (24 recommended), PostgreSQL 15+ (18 recommended) and a free Groq API key from console.groq.com. Without a Groq key, Murmur still works fully offline, just with lower accuracy. The desktop app also needs Windows 10/11 with the .NET Framework 4.x compiler, which is built into Windows.

```bash
# 1. Backend: API on http://localhost:8000
cd backend
npm install
cp .env.example .env          # set DATABASE_URL, DATABASE_ADMIN_URL, SECRET_KEY, GROQ_API_KEY,
                              # and ASR_PROVIDER=groq / LLM_PROVIDER=groq
npm run db:setup              # creates the database role + database
npm run dev                   # applies migrations and starts the API

# 2. Hub UI: hot reload on http://localhost:5173 (or `npm run build` and let the API serve it)
cd ../frontend
npm install
npm run dev

# 3. Desktop app: global shortcuts + Murmur bar
cd ../desktop
npm install                   # also compiles MurmurHelper.exe
npm run dev                   # hub from Vite; use `npm start` for the API-served build
```

Sign in from the desktop window, then hold `Ctrl + Win` in any app and speak.

With Docker: `cp .env.example .env`, set the secrets and your Groq key, then run `docker compose up --build` and open http://localhost:8000.

See [DOCUMENTATION.md](DOCUMENTATION.md) for the architecture, database schema, API reference and configuration.

## Security

**Password security:** Passwords are hashed with bcrypt and never stored in plain text. Five failed logins lock the account for 15 minutes.

**Authentication:** Sessions use JSON Web Tokens. "Log out everywhere" and password changes revoke every token immediately through a per-user token version.

**Data isolation:** Every query is scoped to the signed-in user.

**Updates:** Installed copies check GitHub releases and update themselves; see *Releasing an update* in DOCUMENTATION.md.

**Desktop:** The session token is encrypted with Windows DPAPI. The hub runs sandboxed with context isolation and talks to the desktop only through a small, validated IPC bridge. The microphone is opened only while you dictate, and the focused text box is read only for its name and the two characters before the cursor.

**API keys:** Provider keys live only in `backend/.env`, which git ignores.
