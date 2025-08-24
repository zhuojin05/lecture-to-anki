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
