# Lecture → Anki (MP4 → Flashcards)

Minimal web app to turn a lecture `.mp4` into Anki cards using AI.

## Stack
- Frontend: React + Vite + TypeScript + TailwindCSS
- Backend: Node.js + Express + TypeScript
- AI: OpenAI Whisper for transcription, GPT-4o family for sectioning + card generation

## Features
- Upload `.mp4` (max 2GB, configurable)
- Card Type: Basic | Cloze
- Amount: Few (~15) | Normal (~35) | A lot (~70)
- Progress steps: Transcribing → Structuring → Writing Cards
- Preview & inline edit (Q/A/Tags/Timestamp), delete, undo
- Export TSV/CSV/JSON with tags and `mm:ss-mm:ss` source timestamps
- Anki cloze syntax `{{c1::...}}`

## 1) Setup
```bash
# root
pnpm i || npm i

# backend
cd backend
cp .env.example .env
# put your OpenAI key in .env
pnpm i || npm i
pnpm dev    # or npm run dev

# frontend (in a second terminal)
cd ../frontend
pnpm i || npm i
pnpm dev    # or npm run dev
```

- Backend runs on `http://localhost:3001`
- Frontend runs on `http://localhost:5173`

## 2) Environment
`backend/.env`:
```
OPENAI_API_KEY=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
OPENAI_TRANSCRIBE_MODEL=whisper-1
OPENAI_SECTIONS_MODEL=gpt-5-mini
OPENAI_CARDS_MODEL=gpt-5-mini
PORT=3001
MAX_UPLOAD_MB=2048
```

## 3) Importing into Anki
Export **TSV** and import into Anki with fields:
- Basic/Cloze notes: `Question` (Front), `Answer` (Back), `Tags`, `SourceTimestamp`
- Ensure UTF-8 encoding (default).

## 4) Testing
- Try a short `.mp4` first.
- Switch between Basic/Cloze + card amount; preview updates.
- Ensure ≥95% cards have timestamps and no TSV formatting issues.
- Import TSV to Anki without manual cleanup.

## 5) License
MIT
