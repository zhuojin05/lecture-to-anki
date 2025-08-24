import { Router } from "express";
import { z } from "zod";
import { openai, SECTIONS_MODEL } from "../openai.js";
import { SectionsResponse } from "../types.js";

const Body = z.object({
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
  lectureTitle: z.string().min(1),
  slidesText: z.string().optional(),
  transcriptText: z.string().optional()
});

const router = Router();

/**
 * Deterministically group whisper segments into ~2–3 minute windows.
 * target 150s, min 90s, max 210s
 */
function chunkSegments(
  segments: { start: number; end: number; text: string }[],
  opts = { target: 150, min: 90, max: 210 }
) {
  const { target, min, max } = opts;
  const out: { idx: number; start: number; end: number; text: string }[] = [];
  let curStart = segments[0]?.start ?? 0;
  let curEnd = curStart;
  let buf: string[] = [];
  let idx = 0;

  const flush = () => {
    const text = buf.join(" ").replace(/\s+/g, " ").trim();
    out.push({ idx: idx++, start: curEnd > curStart ? curStart : curStart, end: curEnd, text });
    buf = [];
  };

  for (const s of segments) {
    if (buf.length === 0) {
      curStart = s.start; curEnd = s.end; buf.push(s.text); continue;
    }
    const nextEnd = s.end;
    const dur = nextEnd - curStart;
    if (dur >= target && dur <= max) { buf.push(s.text); curEnd = nextEnd; flush(); continue; }
    if (dur > max) { flush(); curStart = s.start; curEnd = s.end; buf.push(s.text); continue; }
    buf.push(s.text); curEnd = nextEnd;
  }
  if (buf.length) flush();

  if (out.length >= 2) {
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    if (last.end - last.start < min) {
      prev.end = last.end;
      prev.text = (prev.text + " " + last.text).replace(/\s+/g, " ").trim();
      out.pop();
    }
  }
  return out.map((w, i) => ({ ...w, idx: i }));
}

export default router.post("/", async (req, res, next) => {
  try {
    const { segments, lectureTitle, slidesText = "", transcriptText = "" } = Body.parse(req.body);
    if (!segments?.length) return res.json({ sections: [] } as SectionsResponse);

    const windows = chunkSegments(segments, { target: 150, min: 90, max: 210 });

    // Prompt tuned to produce high-yield labels; model only LABELS our fixed windows.
    const system =
      "You label pre-chunked transcript windows. For EACH input window, return a concise, high-yield title and 3–6 bullet key points. " +
      "Prioritize definitions, mechanisms, pathways/steps, key equations, comparisons, regulation points, exceptions. " +
      "Do NOT invent facts. Do NOT merge/split windows. Keep one output item per input index.";

    const extra = `
EXTRA CONTEXT (TRUNCATED):
SLIDES:
${slidesText.slice(0, 6000)}

MANUAL TRANSCRIPT:
${transcriptText.slice(0, 6000)}
`.trim();

    const user = `
LECTURE: ${lectureTitle}

You will get: [{ "idx": number, "start": seconds, "end": seconds, "text": string }]

Rules:
- Return EXACTLY one label object per input window, with the SAME idx.
- Do NOT change start/end/text; you are only labeling.
- Titles must be short, specific, descriptive.
- Key points: 3–6 exam-level bullets (concise).

${extra ? extra + "\n\n" : ""}WINDOWS JSON:
${JSON.stringify({ windows }, null, 2)}

OUTPUT JSON EXACTLY:
{
  "labels": [
    { "idx": 0, "title": "string", "key_points": ["..."] }
  ]
}
`.trim();

    const rsp = await openai.chat.completions.create({
      model: SECTIONS_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" }
    });

    const content = rsp.choices[0]?.message?.content ?? "{}";
    let parsed: { labels?: { idx: number; title: string; key_points: string[] }[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = { labels: [] }; }

    const labelMap = new Map<number, { title: string; key_points: string[] }>();
    for (const l of parsed.labels || []) {
      if (typeof l?.idx === "number") {
        labelMap.set(l.idx, {
          title: (l.title || "").toString().trim().slice(0, 140),
          key_points: Array.isArray(l.key_points)
            ? l.key_points.slice(0, 8).map(s => ("" + s).trim()).filter(Boolean)
            : []
        });
      }
    }

    const sections: SectionsResponse["sections"] = windows.map(w => {
      const label = labelMap.get(w.idx);
      return {
        title: label?.title || "Untitled",
        start: w.start,
        end: w.end,
        key_points: label?.key_points?.length ? label.key_points : [],
        text: w.text
      };
    });

    res.json({ sections });
  } catch (err) {
    next(err);
  }
});