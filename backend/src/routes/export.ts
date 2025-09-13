import { Router } from "express";
import { z } from "zod";
import { toCSV, toTSV } from "../utils/text.js";
import { Card } from "../types.js";

const Body = z.object({
  cards: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    tags: z.array(z.string()),
    source_timestamp: z.string()
  })),
  deck: z.string().optional()
});

const router = Router();

router.post("/tsv", (req, res, next) => {
  try {
    const { cards, deck } = Body.parse(req.body);
    const content = toTSV(cards as Card[]);
    res.setHeader("Content-Type", "text/tab-separated-values; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${(deck || "lecture-cards")}.tsv"`);
    res.send(content);
  } catch (err) { next(err); }
});

router.post("/csv", (req, res, next) => {
  try {
    const { cards, deck } = Body.parse(req.body);
    const content = toCSV(cards as Card[]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${(deck || "lecture-cards")}.csv"`);
    res.send(content);
  } catch (err) { next(err); }
});

router.post("/json", (req, res, next) => {
  try {
    const { cards, deck } = Body.parse(req.body);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${(deck || "lecture-cards")}.json"`);
    res.json({ cards });
  } catch (err) { next(err); }
});

export default router;
