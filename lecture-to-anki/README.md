# Lecture → Anki (Slides-First MP4 → Flashcards)

A minimal, focused web app that turns a lecture **.mp4** (plus optional **.pdf/.pptx slides** and/or **.txt transcript**) into high-yield Anki flashcards. Cards include slide index, precise timestamps, and sensible tags. **Slides are treated as the primary source** (never skipped).

---

## Overview

- **Slides-first generation** — Every content slide produces ≥ 1 card (prefer 2–4 if warranted). Admin slides (title, refs/bibliography, course admin/housekeeping/outline) are auto-skipped. Learning objectives/outcomes are **kept**.
- **Accurate timestamps** — Each card includes a **10–40s** `{mm:ss–mm:ss}` window aligned to the lecture audio when possible (keyword/TF-IDF alignment). If alignment fails, cards still get created (timestamp may be empty).
- **Outside-reading (optional)** — Detects explicit reading suggestions in the transcript and adds extra cards tagged `outside-reading`, using results from Semantic Scholar/Crossref/Brave/SerpAPI (configurable).
- **Quantity modes** —  
  - **Exhaustive (default):** As many cards as the material supports.  
  - **Exact count:** Provide a positive integer to generate precisely that many (still ≥1 per content slide; proportional distribution).
- **Card types** — Basic (Q/A) or Cloze (`{{c1::...}}` syntax).
- **Great UX** — Resizable columns (persisted), wide Question/Answer by default, inline editing with Undo, filter, per-row delete (trash icon), dark mode, progress + status labels.
- **Exports** — TSV / CSV / JSON (UTF-8). TSV/CSV columns: `Question<TAB>Answer<TAB>Tags<TAB>SourceTimestamp`.

---

## Stack

- **Frontend:** React + Vite + TypeScript + TailwindCSS  
- **Backend:** Node.js + Express + TypeScript  
- **AI:**  
  - Transcription: OpenAI Whisper (`whisper-1`) or `gpt-4o-transcribe`  
  - Sectioning + Cards: GPT-4o family or `gpt-5-mini`  
  - Visual slide analysis (optional path): GPT-4o with image inputs

---

## Data Model

```ts
type SourceType = "slides" | "transcript" | "outside";

export type Card = {
  question: string;
  answer: string;
  tags: string[];                 // includes lecture:{slug}, type:{basic|cloze}, slide:{n} when available
  source_timestamp: string;       // "mm:ss–mm:ss" or ""
  slide_index?: number | null;    // slide number if from slides
  source_type: SourceType;        // slides | transcript | outside
  citations?: {                    // only for outside-reading
    title: string;
    authors: string;
    year: number;
    doi?: string;
    url?: string;
  }[];
};
```

---

## API Endpoints

- `POST /api/transcribe`  
  Multipart upload of `.mp4`/audio → Whisper segments with timestamps. If using `gpt-4o-transcribe`, segments may be absent; the app falls back gracefully.

- `POST /api/slides`  
  Upload `.pdf` or `.pptx`. Returns:
  ```json
  {
    "slides": [{ "index": 1, "title": "string?", "text": "string" }, ...],
    "text": "joined text for backward compatibility"
  }
  ```

- `POST /api/sections`  
  Groups transcript into coherent sections (2–5 min) with key points (LLM pre-processing), strict JSON output.

- `POST /api/cards`  
  **Slides-first card generation**. Accepts slides array, transcript sections, `cardType`, optional `targetCount`, and optional `slidesText`/`transcriptText`. Uses:
  - Concurrency limiter (4)
  - Exponential backoff for 429/5xx/network
  - `max_completion_tokens` (⚠️ not `max_tokens`)
  - Strict `response_format: { "type": "json_object" }`

- `POST /api/slides-image` *(optional visual path)*  
  Upload `.pdf`/`.pptx`; server converts pages to images and asks GPT-4o (vision) to produce per-slide cards using the same schema/prompt discipline. Helpful when text extraction is lossy.

- `GET /api/export/{tsv|csv|json}`  
  Downloads the current cards. TSV/CSV columns are `Question<TAB>Answer<TAB>Tags<TAB>SourceTimestamp` (UTF-8).

> Outside-reading is invoked internally when the transcript suggests references. Provider is configurable (`semanticscholar`, `crossref`, `brave`, `serpapi`).

---

## AI Assistance

I used AI tools to **assist** (not replace) parts of this project:

- Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
- Where used:
  - Drafting and refactoring some Express routes (slides-first generation, retries)
  - Suggesting Tailwind class names and the column-resizer approach for the table
  - Writing scaffolding for timestamp alignment (I completed and tested the final code)
- How I used them:
  - I wrote the specs/prompts, generated suggestions, then **reviewed, edited, and tested** all outputs.
  - I removed inaccuracies and adapted code to the existing architecture.
- No proprietary or private data (e.g., API keys) was shared with AI tools.

---

## Install & Run

### Requirements

- Node **20+** (or Node 18+ with `--experimental-fetch`)
- `ffmpeg` (bundled via `ffmpeg-static`)
- An **OpenAI API key**

### 1) Install

```bash
# repo root
pnpm i || npm i

# backend
cd lecture-to-anki/backend
cp .env.example .env           # fill in your keys (DO NOT COMMIT)
pnpm i || npm i
pnpm dev   # or: npm run dev

# frontend (new terminal)
cd ../frontend
pnpm i || npm i
pnpm dev   # or: npm run dev
```

- Backend: http://localhost:3001  
- Frontend: http://localhost:5173

### 2) Environment (backend/.env)

```env
# OpenAI
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

# Models
OPENAI_TRANSCRIBE_MODEL=whisper-1          # or gpt-4o-transcribe (no segments)
OPENAI_SECTIONS_MODEL=gpt-5-mini           # or gpt-4o-mini / gpt-4o
OPENAI_CARDS_MODEL=gpt-5-mini              # or gpt-4o / gpt-4o-mini

# Server
PORT=3001
MAX_UPLOAD_MB=2048

# Outside reading (optional)
OUTSIDE_READING_ENABLED=true
LITERATURE_PROVIDER=semanticscholar        # semanticscholar|crossref|brave|serpapi
BRAVE_API_KEY=                             # optional (for brave)
SERPAPI_KEY=                               # optional (for serpapi)
OUTSIDE_READING_MAX=20                     # hard cap (default 20)
```

> Keep `.env` local and untracked. Push protection will block secrets if they slip into Git.

---

## Usage

1. Open the frontend and upload any of:
   - **.mp4** (lecture), **.pdf/.pptx** (slides), **.txt** (transcript)
2. Choose **Card type** (Basic/Cloze).
3. Optional: **Exact number of cards** — enter a positive integer; leave blank for the exhaustive mode.
4. Click **Generate**. Progress: *Transcribing → Structuring → Writing Cards*.
5. Review/edit in the table:
   - **Resizable columns** (persisted): Question ~50%, Answer ~35–40%, Tags ~10%, Source ~5%
   - Inline editing, filter, Undo (Cmd/Ctrl+Z), Delete (trash).
   - Slide # and Source-type chips per row.
6. Export **TSV** (recommended for Anki), or CSV/JSON.

### Importing into Anki

- Import TSV (UTF-8). Map fields:
  - Front: **Question**
  - Back: **Answer**
  - Tags: **Tags**
  - Extra/optional: **SourceTimestamp**
- Cloze cards use standard Anki cloze syntax: `{{c1::...}}`.

---

## Design Notes

### Slides-first rule

- For each **content** slide, generate ≥ 1 card (prefer 2–4 if warranted by content density).
- Admin slides are skipped when titles include: “References”, “Bibliography”, “Reading list”, “Course info”, “Assessment”, “Housekeeping”, “Outline”.  
  *“Learning objectives/outcomes” are treated as content, not admin.*
- When slide vs transcript conflict, **prefer slides**; transcript enriches with examples/clarifications only.
- If alignment fails (e.g., early minutes), slide-based cards are still created; timestamps may be blank.

### Timestamp alignment

- Fast keyword/TF-IDF overlap between slide text and transcript segments picks the best **10–40s** window.
- If no confident match, timestamp is omitted — but the card is still generated.

### Outside-reading

- Triggered by lecturer phrases like “see paper by…”, “read the review…”, etc.
- Fetches 2–5 peer-reviewed items; generates extra cards tagged `outside-reading` with `citations`.
- Capped by `OUTSIDE_READING_MAX`.

### Prompting hygiene

- Uses `response_format: { "type": "json_object" }` for strict parsing.
- Uses `max_completion_tokens` (not `max_tokens`).
- Omits `temperature` for models that only accept defaults (prevents 400s).

---

## Troubleshooting

- **“Unsupported parameter: max_tokens”** → switch to `max_completion_tokens`.
- **“temperature not supported”** → remove `temperature` for that model (defaults to 1).
- **Transcription 400** → `gpt-4o-transcribe` may return only text (no segments); fallback logic creates a single segment so you still get sections/cards.
- **ECONNRESET/429** → automatic retries/backoff are built-in; re-try or reduce file size/length.
- **No early-lecture cards** → upload slides; slides-first ensures ≥ 1 card per content slide even with missing timestamps.
- **Tags column too wide** → table now defaults to wide Q/A; columns are draggable and remembered.

---

## Security / Git Hygiene

- Never commit `.env` or secrets.  
- Keep only `backend/.env.example` (placeholders) in Git.  
- If push protection blocks a secret, rotate the key and rewrite history if needed.

---

## License

MIT