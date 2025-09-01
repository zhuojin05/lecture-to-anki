// backend/src/routes/slides-image.ts
/**
 * AI Assistance Notice
 * Portions of this file were created or refactored with help from AI tools.
 * Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
 * Prompts (summary): “Refactor Express route for slides-first card generation and add retry logic.”
 * Developer review: All generated code was reviewed, tested, and modified by me.
 * Date(s): 2025-08-24
 */
import { Router } from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import pLimit from "p-limit";
import { upload } from "../middleware/upload.js";
import { openai, CARDS_MODEL } from "../openai.js";
import type { TranscriptSegment as Segment, Card } from "../types.js";

const execFileP = promisify(execFile);
const router = Router();

type SlideImage = {
  index: number;
  title?: string;
  imageBase64: string;
  ocrText?: string;
};

// --------- utilities ---------
function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function ensureToolHelp(name: string, url: string) {
  return `Missing \`${name}\` on PATH.
Install:
  - macOS:   brew install ${name}
  - Ubuntu:  sudo apt-get update && sudo apt-get install -y ${name}
More: ${url}`;
}

async function which(cmd: string) {
  try {
    const { stdout } = await execFileP(process.platform === "win32" ? "where" : "which", [cmd]);
    return stdout.trim();
  } catch {
    return "";
  }
}

async function pptxToPdf(pptxPath: string): Promise<string> {
  const soffice = await which("soffice");
  if (!soffice) throw new Error(ensureToolHelp("libreoffice", "https://wiki.documentfoundation.org/Documentation/HowTo/Install"));
  const outdir = await fsp.mkdtemp(path.join(os.tmpdir(), "pptx2pdf-"));
  await execFileP(soffice, ["--headless", "--convert-to", "pdf", "--outdir", outdir, pptxPath], { timeout: 60_000 });
  const base = path.basename(pptxPath, path.extname(pptxPath));
  const pdfPath = path.join(outdir, `${base}.pdf`);
  const alt = (await fsp.readdir(outdir)).find(f => f.toLowerCase().endsWith(".pdf"));
  return (await exists(pdfPath)) ? pdfPath : path.join(outdir, alt!);
}

async function exists(p: string) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function pdfToPngs(pdfPath: string): Promise<string[]> {
  // Prefer poppler (pdftoppm). If unavailable, fallback to pdfjs-dist rendering with sharp (heavier to wire) – so we hard-require poppler for simplicity.
  const pdftoppm = await which("pdftoppm");
  if (!pdftoppm) throw new Error(ensureToolHelp("poppler", "https://github.com/oschwartz10612/poppler-windows/releases/ or `brew install poppler`"));

  const outdir = await fsp.mkdtemp(path.join(os.tmpdir(), "pdfimg-"));
  const prefix = path.join(outdir, "page");
  // -jpeg + -scale-to width 1024 keeps payload light
  await execFileP(pdftoppm, [pdfPath, prefix, "-jpeg", "-scale-to", "1024"], { timeout: 60_000 });
  const files = (await fsp.readdir(outdir))
    .filter(f => f.startsWith("page-") && f.endsWith(".jpg"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return files.map(f => path.join(outdir, f));
}

async function fileToBase64Jpeg(p: string): Promise<string> {
  // Recompress to ~80% quality and normalize to sRGB
  const buf = await sharp(p).jpeg({ quality: 80 }).toBuffer();
  return buf.toString("base64");
}

// Simple keyword overlap to select a 10–40s window from segments.
// If no decent match, return "" (frontend will still show a card).
function pickTimestampForSlide(slideText: string, segments: Segment[] | undefined): string {
  if (!segments?.length) return "";
  const terms = new Set(
    slideText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(t => t.length > 3)
  );
  let bestIdx = -1;
  let bestScore = 0;
  segments.forEach((s, idx) => {
    const words = s.text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/);
    let score = 0;
    for (const w of words) if (terms.has(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });
  if (bestIdx < 0) return "";
  const seg = segments[bestIdx];
  const dur = Math.max(10, Math.min(40, Math.round(seg.end - seg.start)));
  const start = Math.max(0, Math.round(seg.start));
  const end = start + dur;
  return `${mmss(start)}–${mmss(end)}`;
}

function isAdminSlide(title: string, text: string) {
  const t = (title || "").toLowerCase();
  const body = (text || "").toLowerCase();
  const adminKeys = [
    "references",
    "bibliography",
    "reading list",
    "course info",
    "assessment",
    "housekeeping",
    "outline"
  ];
  const keepKeys = ["learning objectives", "learning outcomes", "objectives", "outcomes"];

  if (keepKeys.some(k => t.includes(k) || body.includes(k))) return false;
  return adminKeys.some(k => t.includes(k));
}

async function withRetries<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const transient = err?.status === 429 || (err?.status >= 500) || String(err?.message || "").includes("ECONNRESET");
      if (!transient || i === tries - 1) break;
      const wait = 1000 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function cardsFromSlideImage(params: {
  imageBase64: string;
  slideIndex: number;
  lectureTitle: string;
  cardType: "basic" | "cloze";
  ocrText?: string;
  timestamp?: string;
  lectureSlug: string;
}): Promise<Card[]> {
  const { imageBase64, slideIndex, lectureTitle, cardType, ocrText, timestamp, lectureSlug } = params;

  const system =
    "You are a world-class Anki deck creator and a domain expert in biochemistry, cell biology, and molecular biology. " +
    "Primary source is the slide image. Use any OCR text only as backup. " +
    "Prefer 2–4 cards per content-rich slide; at least 1. One atomic fact per card. " +
    "For cloze, use Anki {{c1::...}} (≤2 clozes). " +
    "When present, keep the provided timestamp window. " +
    "Always include tags: lecture:{slug}, type:{basic|cloze}, slide:{n}. " +
    "Output strict JSON only.";

  // Build the vision message (text + image + optional extras)
  const userContent: any[] = [
    {
      type: "text",
      text:
        `Create high-yield ${cardType} cards from this slide of "${lectureTitle}".\n` +
        `Schema:\n` +
        `{\n  "cards": [\n    { "question": "string", "answer":"string", "tags": [], "source_timestamp":"mm:ss–mm:ss", "slide_index": number, "source_type":"slides" }\n  ]\n}\n` +
        `Constraints:\n` +
        `- Tags must include: lecture:${lectureSlug}, type:${cardType}, slide:${slideIndex}\n` +
        `- source_type must be "slides"\n` +
        `- Use one atomic fact per card; 2–4 cards if warranted else ≥1\n`
    },
    {
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    }
  ];

  if (ocrText) {
    userContent.push({
      type: "text",
      text: `OCR (may be imperfect):\n${ocrText}`
    });
  }
  if (timestamp) {
    userContent.push({
      type: "text",
      text: `Suggested timestamp window for this slide: ${timestamp}`
    });
  }

  // Use Chat Completions (vision) with JSON output
  const rsp = await withRetries(() =>
    openai.chat.completions.create({
      model: process.env.OPENAI_CARDS_MODEL || CARDS_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent as any }
      ],
      // Some newer models require default temperature; omit it to avoid "unsupported" errors
      response_format: { type: "json_object" }
      // Do NOT send max_tokens with models that expect max_completion_tokens (responses API).
      // Chat Completions uses max_tokens, but to be maximally compatible here we omit it.
    })
  );

  const content = rsp.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  let cards = Array.isArray(parsed.cards) ? parsed.cards : [];
  cards = cards
    .filter((c: any) => c?.question && c?.answer)
    .map((c: any) => ({
      question: String(c.question),
      answer: String(c.answer),
      tags: Array.from(
        new Set([
          ...(Array.isArray(c.tags) ? c.tags.map(String) : []),
          `lecture:${lectureSlug}`,
          `type:${cardType}`,
          `slide:${slideIndex}`
        ])
      ),
      source_timestamp:
        typeof c.source_timestamp === "string" && c.source_timestamp.trim()
          ? c.source_timestamp
          : (timestamp || ""),
      slide_index: Number.isFinite(c.slide_index) ? c.slide_index : slideIndex,
      source_type: "slides" as const
    })) as Card[];

  return cards;
}

// --------- main route ---------
//
// POST /api/slides-image
// multipart/form-data with field `file` (.pdf or .pptx)
// JSON body fields (via query or text fields also OK with FormData):
//  - lectureTitle?: string
//  - lectureSlug?: string
//  - cardType?: "basic" | "cloze"  (default "basic")
//  - segments?: Segment[]          (optional transcript for timestamping)
//
// Returns: { cards: Card[], slides: { index:number, imagePath?: string }[] }
router.post("/", upload.single("file"), async (req: any, res, next) => {
  const tmpToCleanup: string[] = [];
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new Error("No slides file uploaded");
    const lectureTitle = String(req.body?.lectureTitle || path.basename(file.originalname));
    const lectureSlug = String(req.body?.lectureSlug || lectureTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    const cardType = (req.body?.cardType === "cloze" ? "cloze" : "basic") as "basic" | "cloze";

    // Optional transcript segments for timestamp picking
    let segments: Segment[] | undefined;
    try {
      const raw = req.body?.segments;
      if (raw) segments = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(segments)) segments = undefined;
    } catch {
      segments = undefined;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    let pdfPath: string;
    if (ext === ".pdf") {
      pdfPath = file.path;
    } else if (ext === ".pptx") {
      pdfPath = await pptxToPdf(file.path);
      tmpToCleanup.push(pdfPath);
    } else {
      throw new Error("Unsupported slides type. Use .pdf or .pptx");
    }

    // Convert PDF → images
    const jpegPaths = await pdfToPngs(pdfPath);
    const concurrency = pLimit(4);

    // Process slides with GPT-4o
    let totalCards = 0;
    const results = await Promise.all(
      jpegPaths.map((p, idx) =>
        concurrency(async () => {
          const base64 = await fileToBase64Jpeg(p);
          // (Optional) quick OCR via sharp text extraction is not trivial; we skip OCR here.
          const timestamp = pickTimestampForSlide("", segments); // Without text we can't do good matching; keep "" or pass slide text if you have it.
          const cards = await cardsFromSlideImage({
            imageBase64: base64,
            slideIndex: idx + 1,
            lectureTitle,
            cardType,
            lectureSlug,
            timestamp
          });
          totalCards += cards.length;
          return { slideIndex: idx + 1, cards };
        })
      )
    );

    const cards: Card[] = results.flatMap(r => r.cards);
    console.log(
      `[slides-image] slides=${jpegPaths.length} -> cards=${cards.length} (avg ${(cards.length / Math.max(1, jpegPaths.length)).toFixed(2)}/slide)`
    );

    res.json({
      cards,
      slides: jpegPaths.map((p, i) => ({ index: i + 1 }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;