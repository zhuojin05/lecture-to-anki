// frontend/src/App.tsx
/**
 * AI Assistance Notice
 * Portions of this file were created or refactored with help from AI tools.
 * Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
 * Prompts (summary): “Refactor Express route for slides-first card generation and add retry logic.”
 * Developer review: All generated code was reviewed, tested, and modified by me.
 * Date(s): 2025-08-24
 */
import React, { useMemo, useState } from "react";

import CardTable from "./components/CardTable";
import Dropzone from "./components/Dropzone";
import Progress from "./components/Progress";
import ProgressBar from "./components/ProgressBar";
import ThemeToggle from "./components/ThemeToggle";
import { apiSlidesImage, apiTranscribe, apiSections, apiCards, apiExport, apiSlides } from "./lib/api";
import type { Card, CardType, Section } from "./lib/types";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [slidesFile, setSlidesFile] = useState<File | null>(null);
  const [slidesText, setSlidesText] = useState<string>("");
  const [providedTranscript, setProvidedTranscript] = useState<string>("");

  const [waitForTranscribe, setWaitForTranscribe] = useState(true); // switch
  const [useVisualSlides, setUseVisualSlides] = useState<boolean>(true); // NEW
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [lectureTitle, setLectureTitle] = useState("");
  const [deck, setDeck] = useState("Lecture Cards");
  const [cardType, setCardType] = useState<CardType>("basic");
  const [targetCountInput, setTargetCountInput] = useState<string>("");

  const [cards, setCards] = useState<Card[]>([]);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ total: 0 });

  // progress bar state
  const [progress, setProgress] = useState<{ pct: number; label: string }>({ pct: 0, label: "Idle" });

  const lectureSlug = useMemo(
    () => slugify(lectureTitle || videoFile?.name || slidesFile?.name || "lecture"),
    [lectureTitle, videoFile, slidesFile]
  );

  async function handleUniversalUpload(file: File) {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const mt = file.type;

    // Handle slides (.pdf / .pptx)
    if (
      ext === ".pdf" ||
      ext === ".pptx" ||
      mt === "application/pdf" ||
      mt === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      setSlidesFile(file);
      try {
        setProgress({ pct: 0, label: "Extracting slides text…" });
        const res = await apiSlides(file);
        setSlidesText(res.text || "");
        setProgress({ pct: 100, label: "Slides processed" });
      } catch (e: any) {
        alert(`Slides extraction failed: ${e?.message || e}`);
      }
      return;
    }

    // Handle transcript (.txt)
    if (ext === ".txt" || mt === "text/plain") {
      const text = await file.text();
      setProvidedTranscript(text);
      return;
    }

    // Handle video/audio (fallback to video)
    if (
      mt.startsWith("video/") ||
      mt.startsWith("audio/") ||
      ext === ".mp4" ||
      ext === ".m4a" ||
      ext === ".mp3" ||
      ext === ".wav"
    ) {
      setVideoFile(file);
      return;
    }

    alert("Unsupported file type. Please upload .mp4 video, .pdf/.pptx slides, or .txt transcript.");
  }

  // (kept in case you still call it elsewhere)
  async function handleSlidesUpload(file: File) {
    setSlidesFile(file);
    try {
      setProgress({ pct: 0, label: "Extracting slides text…" });
      const res = await apiSlides(file);
      setSlidesText(res.text || "");
      setProgress({ pct: 100, label: "Slides processed" });
    } catch (e: any) {
      alert(`Slides extraction failed: ${e.message || e}`);
    }
  }

  async function handleTranscriptTxt(file: File) {
    if (!file) return;
    const text = await file.text();
    setProvidedTranscript(text);
  }

  function dedupeCards(list: Card[]): Card[] {
    const seen = new Set<string>();
    const out: Card[] = [];
    for (const c of list) {
      const key = `${(c.question || "").trim().toLowerCase()}::${(c.answer || "").trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }

  async function generate() {
    if (!videoFile && !providedTranscript && !slidesFile) {
      alert("Please upload at least one of: video, slides, or transcript.");
      return;
    }

    // Optional exact count
    let targetCount: number | undefined = undefined;
    if (targetCountInput.trim()) {
      const n = Number(targetCountInput.trim());
      if (!Number.isInteger(n) || n <= 0) {
        alert("Please enter a positive integer for the exact number of cards, or leave it blank for exhaustive mode.");
        return;
      }
      targetCount = n;
    }

    setBusy(true);
    setCards([]);
    setStep(1);
    setProgress({ pct: 10, label: "Starting…" });

    // 1) Get transcript segments (or wrap provided transcript)
    let segments: { start: number; end: number; text: string }[] = [];

    try {
      if (waitForTranscribe && videoFile) {
        setProgress({ pct: 25, label: "Transcribing video (this can take minutes)…" });
        const trans = await apiTranscribe(videoFile);
        segments = trans.segments;
      } else if (providedTranscript.trim()) {
        // Make a single segment with the provided transcript
        segments = [
          {
            start: 0,
            end: Math.max(60, (videoFile?.size || 1) / (200 * 1024)),
            text: providedTranscript.trim()
          }
        ];
      } // else: no transcript, but we can still run slides-image only

      // 2) Optionally run visual slide analysis (after we have segments for better timestamps)
      let imageCards: Card[] = [];
      if (useVisualSlides && slidesFile) {
        setProgress({ pct: 55, label: "Analyzing slides visually (GPT-4o) …" });
        const resp = await apiSlidesImage(slidesFile, {
          lectureTitle: lectureTitle || slidesFile.name || "Untitled Lecture",
          lectureSlug,
          cardType,
          segments // helps the backend pick precise 10–40s windows
        });
        imageCards = (resp.cards || []) as Card[];
      }

      // 3) Run sections + cards (text-based path) if we have transcript text
      let textCards: Card[] = [];
      if (segments.length) {
        setStep(2);
        setProgress({ pct: 70, label: "Structuring transcript into sections…" });
        const secs = await apiSections(
          segments,
          lectureTitle || videoFile?.name || slidesFile?.name || "Untitled Lecture",
          {
            slidesText: slidesText || undefined,
            transcriptText: providedTranscript || undefined
          }
        );

        setStep(3);
        setProgress({
          pct: 85,
          label: targetCount ? `Writing ${targetCount} cards…` : "Writing exhaustive cards…"
        });
        const gen = await apiCards({
          lectureTitle: lectureTitle || videoFile?.name || slidesFile?.name || "Untitled Lecture",
          lectureSlug,
          cardType,
          targetCount, // undefined = exhaustive
          sections: (secs.sections as Section[]) || [],
          slidesText: slidesText || undefined,
          transcriptText: providedTranscript || undefined
        });

        textCards = (gen.cards || []) as Card[];
      }

      // 4) Merge & dedupe (prefer cards that have timestamps or slide_index if you want)
      const merged = dedupeCards([...(imageCards || []), ...(textCards || [])]);

      setCards(merged);
      setCounts({ total: merged.length });
      setProgress({ pct: 100, label: "Done" });
    } catch (err: any) {
      console.error(err);
      alert(`Generation failed: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative max-w-5xl mx-auto p-6 text-slate-900 dark:text-slate-100">
      {/* Accent blobs (in-file so you don't need to edit index.html) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Light mode accents */}
        <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-indigo-300 to-cyan-200 dark:opacity-0"></div>
        <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full blur-3xl opacity-35 bg-gradient-to-tr from-pink-200 to-rose-200 dark:opacity-0"></div>
        {/* Dark mode accents */}
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl opacity-30 bg-indigo-700 hidden dark:block"></div>
        <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full blur-3xl opacity-25 bg-pink-700 hidden dark:block"></div>
      </div>

      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lecture → Anki</h1>
          <p className="text-slate-600 dark:text-slate-300">
            Upload a lecture + slides, generate high-yield Anki cards.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="grid gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white/70 dark:bg-slate-800/60 backdrop-blur">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-sm text-slate-600 dark:text-slate-300">
                Lecture title (optional)
              </label>
              <input
                className="border rounded-xl px-3 py-2 w-full bg-white/80 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                placeholder="e.g. Glycolysis & Regulation"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
              />
              <label className="block text-sm text-slate-600 dark:text-slate-300">Deck name</label>
              <input
                className="border rounded-xl px-3 py-2 w-full bg-white/80 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                value={deck}
                onChange={(e) => setDeck(e.target.value)}
              />
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300">Card type</label>
                  <select
                    className="border rounded-xl px-3 py-2 bg-white/80 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as CardType)}
                  >
                    <option value="basic">Basic (Q/A)</option>
                    <option value="cloze">Cloze</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-300">
                    Exact number of cards (optional)
                  </label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="border rounded-xl px-3 py-2 bg-white/80 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    placeholder="Leave blank for exhaustive mode"
                    value={targetCountInput}
                    onChange={(e) => setTargetCountInput(e.target.value.replace(/[^\d]/g, ""))}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Blank = exhaustive (as many as possible, prioritizing slides).
                  </p>
                </div>
              </div>

              {/* Toggle for visual slide analysis */}
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={useVisualSlides}
                  onChange={(e) => setUseVisualSlides(e.target.checked)}
                />
                Use visual slide analysis (GPT-4o)
              </label>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Tags auto-include: <code>lecture:{lectureSlug}</code>, <code>type:{cardType}</code>
              </div>
            </div>

            <div className="grid gap-3">
              <Dropzone
                label="Upload lecture video (.mp4), slides (.pdf/.pptx), or transcript (.txt)"
                accept="video/*,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.mp4,.pptx,.pdf,.txt"
                onFile={handleUniversalUpload}
              />
            </div>
          </div>

          {/* File badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {videoFile && (
              <span className="px-2 py-1 rounded-lg text-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                Video: {videoFile.name}
              </span>
            )}
            {slidesFile && (
              <span className="px-2 py-1 rounded-lg text-sm bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                Slides: {slidesFile.name} {slidesText ? "✓ extracted" : "(processing…)"}
              </span>
            )}
            {providedTranscript && (
              <span className="px-2 py-1 rounded-lg text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                Transcript: loaded ✓
              </span>
            )}
          </div>

          {/* Transcript options */}
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-700 dark:text-slate-300">
                Wait for video transcription?
              </label>
              <input
                type="checkbox"
                checked={waitForTranscribe}
                onChange={(e) => setWaitForTranscribe(e.target.checked)}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                (Turn off if you paste a transcript)
              </span>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">
                Transcript (paste here) — or upload a .txt above
              </label>
              <textarea
                className="border rounded-xl px-3 py-2 w-full h-24 bg-white/80 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                placeholder="Optional: paste transcript text here to skip Whisper"
                value={providedTranscript}
                onChange={(e) => setProvidedTranscript(e.target.value)}
              />
            </div>
          </div>

          <Progress step={videoFile || providedTranscript ? step : 0} />
          <div className="my-3">
            <ProgressBar pct={progress.pct} label={progress.label} />
          </div>

          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={generate}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            >
              {busy ? "Working…" : "Generate"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-slate-600 dark:text-slate-300 text-sm">
            <span className="font-medium">{counts.total}</span> cards
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => apiExport("tsv", cards, deck)}
              disabled={!cards.length}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            >
              Export TSV
            </button>
            <button
              onClick={() => apiExport("csv", cards, deck)}
              disabled={!cards.length}
              className="px-3 py-2 rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => apiExport("json", cards, deck)}
              disabled={!cards.length}
              className="px-3 py-2 rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
            >
              Export JSON
            </button>
          </div>
        </div>

        <CardTable cards={cards} setCards={setCards} />
      </div>

      <footer className="mt-8 text-xs text-slate-400 dark:text-slate-500">
        MIT © {new Date().getFullYear()}
      </footer>
    </div>
  );
}