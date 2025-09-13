# Biochemistry Flashcard Generator (Lecture → Anki; Slides & MP4 → Flashcards)

A streamlined web app that transforms a lecture **.pdf/.pptx slides**, **.mp4 lecture recording** and/or **.txt transcript** into high‑yield Anki flashcards.
Slides are the **primary source**: every content slide creates cards, while admin slides (title, bibliography, housekeeping) are skipped.

#### Video demo: https://youtu.be/di6jP5BLiZY?si=Lf6KEcwFkpFIyOAc

---

## Overview

- **Slides‑first:** Every content slide generates at least one card. Learning objectives are included, admin slides are skipped.
- **Timestamps:** Cards include `{mm:ss–mm:ss}` windows aligned to audio when possible.
- **Card types:** Basic Q/A and Cloze (`{{c1::...}}`).
- **User experience:** Resizable columns, inline editing, undo, dark mode, progress bar with time tracking.
- **Exports:** TSV / CSV / JSON for Anki import.

---

## Tech Stack

- **Frontend:** React, Vite, TypeScript, TailwindCSS
- **Backend:** Node.js, Express, TypeScript
- **AI models:**
  - Transcription: Whisper (`whisper-1`) or `gpt-4o-transcribe`
  - Slide/section analysis: GPT‑4o, `gpt-5-mini`
  - Visual slide analysis: GPT‑4o (multimodal)

---

## File Roles

- **frontend/src/** — React components (`App.tsx`, `CardTable.tsx`, `ProgressBar.tsx`) handle uploads, progress, and card table editing.
- **frontend/src/hooks/** — Custom hooks like column resizer.
- **backend/src/routes/** — Express routes for `/transcribe`, `/slides`, `/sections`, `/cards`, `/export`.
- **backend/src/utils/** — Helpers for parsing, alignment, and text cleanup.
- **backend/.env.example** — Template for environment variables.
- **backend/.env** *(create this file locally, not in Git)* — Holds your OpenAI API key and server config.

---

## Installation & Running

### Requirements
- Node.js **20+**
- `ffmpeg` (installed via `ffmpeg-static`)
- An **OpenAI API key**

### Setup

```bash
# clone repository
git clone https://github.com/zhuojin05/lecture-to-anki.git
cd lecture-to-anki

# backend
cd backend
cp .env.example .env   # create .env with your API key
npm install
npm run dev

# frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

- Backend runs on: http://localhost:3001
- Frontend runs on: http://localhost:5173

---

## Usage

1. Upload **slides (.pdf/.pptx)**, **video (.mp4)**, and/or **transcript (.txt)**.
2. Choose card type (Basic or Cloze).
3. Click **Generate** — progress shows *Upload → Transcribe → Structure → Write Cards*.
4. Edit cards inline, resize columns, delete or undo.
5. Export deck to **TSV/CSV/JSON** for Anki.

**Anki import:** Use TSV. Map Question → Front, Answer → Back, Tags → Tags.

---

## Design Choices

- **Slides‑first rule:** Ensures each slide yields cards, even if transcript alignment fails.
- **Timestamp alignment:** Keyword overlap aligns slide text with transcript segments; fallback leaves timestamps blank but cards still generate.
- **Outside‑reading (optional):** Detects references in transcript and adds extra `outside-reading` cards.
- **Progress feedback:** Dynamic dots while processing; green tick when finished. Total elapsed time is shown with per‑stage breakdown.

---

## AI Assistance

AI tools were used to assist with boilerplate and refactors.
- Tools: ChatGPT (GPT‑5), GitHub Copilot
- Areas: Express routes scaffolding, Tailwind styling, resizer logic.
- All AI outputs were reviewed, tested, and adapted manually.
- No private keys or secrets were shared.

---

## License

MIT
