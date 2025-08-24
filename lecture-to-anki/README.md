# Lecture → Anki (Slides‑First MP4 → Flashcards)

A minimal, clean web app that turns a lecture **.mp4** (plus optional **.pdf/.pptx slides** and/or **.txt transcript**) into high‑yield Anki flashcards. Cards include tags, slide index, and precise timestamps. Slides are treated as the **primary source**.

## Stack
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **Backend:** Node.js + Express + TypeScript
- **AI:** OpenAI Whisper (or 4o‑transcribe) for transcription; GPT‑4o/“gpt‑5‑mini” family for sectioning + card generation

## Key Features
- **Slides‑first generation:** Every content slide (PDF/PPTX) yields ≥1 card (prefer 2–4 if warranted). Admin slides (title/refs/course admin/housekeeping/outline) are skipped automatically.  
- **Accurate timestamps:** Each card includes a 10–40s `{mm:ss–mm:ss}` window aligned to the lecture audio when possible.
- **Outside‑reading (optional):** Detects explicit reading suggestions in the transcript and adds cards tagged `outside-reading` using results from Semantic Scholar/Crossref/Brave/SerpAPI (configurable).
- **Quantity modes:**  
  - **Exhaustive (default):** As many cards as the material supports.  
  - **Exact count:** Provide a positive integer to generate precisely that many (still ≥1 per content slide; distributed proportionally).
- **Card types:** Basic (Q/A) or Cloze (Anki `{{c1::...}}`).
- **Inline editing:** Spreadsheet‑like table with Undo, filter, per‑row delete, chips for Slide # and Source type.
- **Resizable columns:** Q (~50%) and A (~35–40%) are wide by default; Tags/Source narrow; widths are draggable and saved to localStorage.
- **Dark mode + soft accents:** Modern, accessible UI; progress indicator and status labels.
- **Exports:** TSV / CSV / JSON (UTF‑8). TSV/CSV columns: `Question<TAB>Answer<TAB>Tags<TAB>SourceTimestamp`.

## Data Model (Cards)
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

## API Endpoints
- `POST /api/transcribe` — multipart upload of `.mp4`/audio, returns Whisper segments with timestamps.
- `POST /api/slides` — upload `.pdf` or `.pptx`; returns `{ slides: [{ index, title?, text }] }` and a joined `text` field for backward compatibility.
- `POST /api/sections` — groups transcript into coherent sections (2–5 min) with key points (LLM).
- `POST /api/cards` — **slides‑first** card generation. Accepts slides array, transcript sections, `cardType`, optional `targetCount`, and optional `slidesText`/`transcriptText`. Uses concurrency (4) + retries, `max_completion_tokens`, `response_format: { type: "json_object" }`.
- `GET /api/export/{tsv|csv|json}` — download current cards.

> Internally, outside‑reading can call a lightweight helper that queries **Semantic Scholar** or **Crossref** (no key), or **Brave/SerpAPI** if keys are provided.

## Setup

### 0) Requirements
- Node 20+ (or 18+ with `--experimental-fetch`)
- `ffmpeg` (bundled via `ffmpeg-static`)
- An OpenAI API key

### 1) Install
```bash
# repo root
pnpm i || npm i

# backend
cd lecture-to-anki/backend
cp .env.example .env         # fill with your keys (DO NOT COMMIT)
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
OPENAI_TRANSCRIBE_MODEL=whisper-1          # or gpt-4o-transcribe (no segments)
OPENAI_SECTIONS_MODEL=gpt-5-mini           # or gpt-4o-mini / gpt-4o
OPENAI_CARDS_MODEL=gpt-5-mini              # or gpt-4o / gpt-4o-mini

# Server
PORT=3001
MAX_UPLOAD_MB=2048

# Outside reading (optional)
OUTSIDE_READING_ENABLED=true
LITERATURE_PROVIDER=semanticscholar        # semanticscholar|crossref|brave|serpapi
BRAVE_API_KEY=                             # optional
SERPAPI_KEY=                               # optional
OUTSIDE_READING_MAX=20
```

> Keep **`.env` out of Git**. Commit only `backend/.env.example` with placeholders.

## Usage
1. Open the frontend, upload one or more of: **.mp4**, **.pdf/.pptx**, **.txt transcript**.  
2. Choose **Card type** (Basic/Cloze).  
3. Optional: set an **Exact number of cards** (leave blank for exhaustive).  
4. Click **Generate**. You’ll see: *Transcribing → Structuring → Writing Cards*.  
5. Review and edit in the table (wide Q/A columns, resizable).  
6. Export **TSV** for Anki (recommended), or CSV/JSON.

### Importing into Anki
- Use **TSV**, UTF‑8, fields mapped to:
  - Front: **Question**
  - Back: **Answer**
  - Tags: **Tags**
  - Extra field (optional): **SourceTimestamp**
- Cloze notes use Anki syntax `{{c1::...}}`.

## Design Details

### Slides‑first logic
- Every **content** slide (PDF/PPTX) produces ≥1 card.  
- Admin slides auto‑skipped by heuristics: “References”, “Bibliography”, “Reading list”, “Course info”, “Assessment”, “Housekeeping”, “Outline”.  
- “Learning objectives/outcomes” are **kept** as content.  
- If transcript alignment fails (e.g., early segments), slides still generate cards with blank/coarse timestamps.

### Timestamp alignment
- A fast keyword‑overlap/TF‑IDF matcher aligns slide text to transcript segments and picks a **10–40s** window.  
- If nothing matches confidently, timestamp may be empty.

### Outside‑reading
- Triggered by phrases like “see paper by…”, “read the review…”, etc.  
- Fetches 2–5 peer‑reviewed items; creates cards tagged `outside-reading` with citation list in `citations`.  
- Capped by `OUTSIDE_READING_MAX`.

### Robust prompting
- Uses `response_format: { type: "json_object" }`.  
- Uses `max_completion_tokens` (not `max_tokens`).  
- Omits `temperature` for models that only accept defaults.

## Troubleshooting
- **“Unsupported parameter: max_tokens”** → ensure `max_completion_tokens` is used.
- **Temperature error** → remove `temperature` for models that don’t support it (default 1).
- **Transcription 400** → if using `gpt-4o-transcribe`, segment array may be missing; fallback creates a single segment.
- **ECONNRESET/429** → built‑in retry with exponential backoff; try again or reduce file size.
- **No early‑lecture cards** → verify slides were uploaded; slides‑first generation ensures ≥1 card per content slide.
- **Big tags column** → table now defaults to wide Q/A and resizable columns (saved to localStorage).

## Security
- Never commit secrets. Keep `.env` local.  
- Push protection may block secrets; if that happens, rotate the key and rewrite history (`git filter-repo --replace-text`).

## License
MIT