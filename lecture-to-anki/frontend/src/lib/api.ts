// frontend/src/lib/api.ts
/**
 * AI Assistance Notice
 * Portions of this file were created or refactored with help from AI tools.
 * Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
 * Prompts (summary): “Refactor Express route for slides-first card generation and add retry logic.”
 * Developer review: All generated code was reviewed, tested, and modified by me.
 * Date(s): 2025-08-24
 */
import type { Section, TranscriptSegment, Card, GenerateCardsRequest } from "./types";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
export const API_BASE = BASE;

export async function apiTranscribe(file: File): Promise<{ segments: TranscriptSegment[], text: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const rsp = await fetch(`${BASE}/api/transcribe`, { method: "POST", body: fd });
  if (!rsp.ok) throw new Error(await rsp.text());
  return rsp.json();
}

export async function apiSlides(file: File): Promise<{ text: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const rsp = await fetch(`${BASE}/api/slides`, { method: "POST", body: fd });
  if (!rsp.ok) throw new Error(await rsp.text());
  return rsp.json();
}

export async function apiSections(segments: TranscriptSegment[], lectureTitle: string, extraContext?: { slidesText?: string; transcriptText?: string; }): Promise<{ sections: Section[] }> {
  // Send slides transcript context by inlining to first/last segment (cheap hack),
  // or you could make a dedicated endpoint. Here we piggyback in the body.
  const rsp = await fetch(`${BASE}/api/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments, lectureTitle, ...extraContext })
  });
  if (!rsp.ok) throw new Error(await rsp.text());
  return rsp.json();
}

export async function apiCards(body: GenerateCardsRequest): Promise<{ cards: Card[] }> {
  const rsp = await fetch(`${BASE}/api/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!rsp.ok) throw new Error(await rsp.text());
  return rsp.json();
}

export async function apiExport(format: "tsv" | "csv" | "json", cards: Card[], deck: string) {
  const rsp = await fetch(`${BASE}/api/export/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cards, deck })
  });
  if (!rsp.ok) throw new Error(await rsp.text());
  const blob = await rsp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${deck || "lecture-cards"}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiSlidesImage(
  file: File,
  opts: {
    lectureTitle?: string;
    lectureSlug?: string;
    cardType?: "basic" | "cloze";
    segments?: { start: number; end: number; text: string }[];
  }
) {
  const fd = new FormData();
  fd.append("file", file);
  if (opts.lectureTitle) fd.append("lectureTitle", opts.lectureTitle);
  if (opts.lectureSlug) fd.append("lectureSlug", opts.lectureSlug);
  if (opts.cardType) fd.append("cardType", opts.cardType);
  if (opts.segments) fd.append("segments", JSON.stringify(opts.segments));

  const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
  const res = await fetch(`${BASE}/api/slides-image`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<{ cards: any[]; slides: { index: number }[] }>;
}
