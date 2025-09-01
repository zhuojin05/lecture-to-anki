// backend/src/routes/cards.ts
/**
 * AI Assistance Notice
 * Portions of this file were created or refactored with help from AI tools.
 * Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
 * Prompts (summary): “Refactor Express route for slides-first card generation and add retry logic.”
 * Developer review: All generated code was reviewed, tested, and modified by me.
 * Date(s): 2025-08-24
 */
import { Router } from "express";
import { z } from "zod";
import { openai, CARDS_MODEL } from "../openai.js";
import { GenerateCardsBody, Card } from "../types.js";

const Body = z.object({
  lectureTitle: z.string().min(1),
  lectureSlug: z.string().min(1),
  cardType: z.enum(["basic", "cloze"]),
  // NEW: optional exact count
  targetCount: z.number().int().positive().optional(),
  sections: z.array(z.object({
    title: z.string(),
    start: z.number(),
    end: z.number(),
    key_points: z.array(z.string()),
    text: z.string()
  })),
  slidesText: z.string().optional(),
  transcriptText: z.string().optional()
});

const router = Router();

// tiny concurrency limiter
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0, active = 0;
  return await new Promise((resolve, reject) => {
    const next = () => {
      if (i >= items.length && active === 0) return resolve(out);
      while (active < limit && i < items.length) {
        const idx = i++; active++;
        fn(items[idx], idx)
          .then(res => { out[idx] = res; })
          .catch(reject)
          .finally(() => { active--; next(); });
      }
    };
    next();
  });
}

function secToMMSS(s: number) {
  const m = Math.floor(s / 60); const ss = Math.floor(s % 60);
  return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

function ensureBracketTimestamp(question: string, ts?: string) {
  const q = question.trim();
  if (!ts) return q;
  const bracket = ` [${ts}]`;
  if (q.endsWith(bracket)) return q;
  if (/\s\[\d{2}:\d{2}(?:[–-]\d{2}:\d{2})?\]$/.test(q)) return q;
  return q + bracket;
}

// Allocate a per-section quota that sums to targetCount (min 1 per non-empty section)
function allocateQuotas(sections: { text: string }[], target: number) {
  const lens = sections.map(s => Math.max(1, s.text.trim().length));
  const total = lens.reduce((a,b)=>a+b,0);
  const raw = lens.map(L => Math.max(1, Math.round((L/total)*target)));
  // fix rounding drift
  let sum = raw.reduce((a,b)=>a+b,0);
  const quotas = raw.slice();
  while (sum > target) { // shave from largest
    const idx = quotas.indexOf(Math.max(...quotas));
    quotas[idx]--; sum--;
  }
  while (sum < target) { // add to largest gap
    const idx = quotas.indexOf(Math.min(...quotas));
    quotas[idx]++; sum++;
  }
  return quotas;
}

function buildUserPrompt(opts: {
  lectureTitle: string;
  lectureSlug: string;
  cardType: "basic"|"cloze";
  section: { title: string; start: number; end: number; text: string };
  slidesText?: string;
  transcriptText?: string;
  mode: "exhaustive" | "exact";
  perSectionTarget?: number;
}) {
  const { lectureTitle, lectureSlug, cardType, section, slidesText, transcriptText, mode, perSectionTarget } = opts;

  const slidesBlock = (slidesText || "").slice(0, 6000);
  const transcriptBlock = (transcriptText || "").slice(0, 4000);

  const quantity = mode === "exact"
    ? `- Produce **EXACTLY ${perSectionTarget || 0} cards** grounded in THIS section. If insufficient explicit content exists, produce as many as possible and keep placeholders out.\n`
    : `- Produce **as many cards as needed** to cover ALL explicit high-yield facts in THIS section (exhaustive).\n`;

  return `
You are a world-class spaced-repetition flashcard designer and a domain expert in **biochemistry, cell biology, and molecular biology**. 
Your job is to craft exam-grade Anki cards grounded ONLY in the provided materials.

PRIORITY OF SOURCES (strict):
1) Slides (central, authoritative). Treat slide content as the primary material for assessment.
2) Transcript (supporting detail that can add nuance).
3) Do **not** add external facts not present in slides/transcript. If something is obvious background (e.g., standard definitions) keep it minimal and only to make the card self-contained.

CARD RULES
- Card type = ${cardType === "cloze" ? "Cloze (Anki {{c1::...}} syntax; 1–2 clozes max per card)" : "Basic (Q→A)"}.
- Keep **one atomic fact** per card. Use additional cards for multi-part facts.
- Prefer high-yield items: definitions, mechanisms, pathways/steps, key enzymes/cofactors, regulation points, cause→effect, comparisons, exceptions.
- Math: wrap inline math with \$begin:math:text$ ... \\$end:math:text$; block with \$begin:math:display$ ... \\$end:math:display$.
- Chemistry: use MathJax chem, e.g. \$begin:math:text$ \\\\ce{A + B -> C} \\$end:math:text$.
- Include a **{mm:ss–mm:ss}** timestamp range **from THIS section** that grounds the card.
- Avoid duplicates/overlaps within this section.

QUANTITY
${quantity}

CONTEXT (truncated):
SLIDES (primary):
${slidesBlock}

TRANSCRIPT (supporting):
${transcriptBlock}

SECTION
Lecture: ${lectureTitle}
Title: ${section.title}
Window: ${secToMMSS(section.start)}–${secToMMSS(section.end)}
Text:
${section.text}

OUTPUT JSON EXACTLY:
{
  "cards": [
    {
      "question": "string",
      "answer": "string",
      "tags": ["lecture:${lectureSlug}", "type:${cardType}"],
      "source_timestamp": "mm:ss-mm:ss"
    }
  ]
}
For CLOZE, place the cloze(s) in "question"; put brief back-extra/explanation in "answer".
`.trim();
}

export default router.post("/", async (req, res, next) => {
  try {
    const body = Body.parse(req.body) as GenerateCardsBody & {
      targetCount?: number;
      slidesText?: string;
      transcriptText?: string;
    };

    const exhaustive = !body.targetCount;
    const system =
      "You are a biochemistry teaching expert and Anki deck creator. Return ONLY valid JSON. Use only provided slides/transcript; do not invent facts.";

    // Determine per-section quotas if exact mode
    const quotas = exhaustive ? [] : allocateQuotas(body.sections, body.targetCount!);
    const concurrency = 4;

    const results = await mapWithConcurrency(body.sections, concurrency, async (section, idx) => {
      const mode: "exhaustive"|"exact" = exhaustive ? "exhaustive" : "exact";
      const perSectionTarget = exhaustive ? undefined : Math.max(1, quotas[idx] || 1);

      const user = buildUserPrompt({
        lectureTitle: body.lectureTitle,
        lectureSlug: body.lectureSlug,
        cardType: body.cardType,
        section,
        slidesText: body.slidesText,
        transcriptText: body.transcriptText,
        mode,
        perSectionTarget
      });

      const rsp = await openai.chat.completions.create({
        model: CARDS_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        // new param name on latest models
        max_completion_tokens: 3500,
        response_format: { type: "json_object" }
      });

      let content = rsp.choices[0]?.message?.content ?? "";
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch {
        const start = content.indexOf("{"); const end = content.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try { parsed = JSON.parse(content.slice(start, end + 1)); } catch {}
        }
      }

      const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
      return cards as Card[];
    });

    // Flatten & normalize
    const raw = results.flat();

    const seen = new Set<string>();
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const final: Card[] = [];

    for (const c of raw) {
      if (!c?.question || !c?.answer) continue;

      const ts = (c.source_timestamp || "").toString().trim();
      const tsOk = /^\d{2}:\d{2}(?:[–-]\d{2}:\d{2})?$/.test(ts);
      const questionWithTS = ensureBracketTimestamp(c.question, tsOk ? ts.replace("-", "–") : undefined);

      const q = questionWithTS;
      const a = c.answer.toString().trim();
      const k1 = `${q}::${a}`;
      const k2 = `${norm(q)}::${norm(a)}`;
      if (seen.has(k1) || seen.has(k2)) continue;
      seen.add(k1); seen.add(k2);

      final.push({
        question: q,
        answer: a,
        tags: Array.from(new Set([...(Array.isArray(c.tags) ? c.tags : []), `lecture:${body.lectureSlug}`, `type:${body.cardType}`])),
        source_timestamp: tsOk ? ts.replace("-", "–") : ""
      });
    }

    // If exact target requested, trim or sample to that exact size
    if (body.targetCount) {
      // If we have more than needed, take the first N (already ordered by sections -> preserves flow)
      const trimmed = final.slice(0, body.targetCount);
      // If we have fewer, we return what we could make (avoid fillers)
      return res.json({ cards: trimmed });
    }

    // Exhaustive: keep a sane ceiling to avoid accidental explosion
    const MAX_CARDS = 1000;
    res.json({ cards: final.slice(0, MAX_CARDS) });
  } catch (err) {
    next(err);
  }
});