import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { upload } from "../middleware/upload.js";
import unzipper from "unzipper";
import { XMLParser } from "fast-xml-parser";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// ✅ Use CJS require for pdf-parse to avoid the test file issue under tsx/ESM
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text?: string }>;

const router = Router();

async function extractTextFromPptxBuffer(buf: Buffer): Promise<string> {
  // Read PPTX (a ZIP) and extract text from slide XML ("ppt/slides/slide*.xml")
  const parsed = await unzipper.Open.buffer(buf);
  const slides = parsed.files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f.path));
  slides.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true, // strip ns prefixes (a:t -> t)
    textNodeName: "tVal",
  });

  const slideTexts: string[] = [];

  for (const slide of slides) {
    const content = await slide.buffer();
    const xml = parser.parse(content.toString("utf8"));

    // Collect all text nodes in the slide: <a:t>…</a:t> (now "t")
    const texts: string[] = [];

    function walk(node: any) {
      if (!node || typeof node !== "object") return;
      for (const key of Object.keys(node)) {
        const val = (node as any)[key];
        if (key === "t") {
          if (typeof val === "string") texts.push(val);
          else if (val && typeof val === "object" && typeof val.tVal === "string") texts.push(val.tVal);
        } else if (Array.isArray(val)) {
          val.forEach(walk);
        } else if (typeof val === "object") {
          walk(val);
        }
      }
    }

    walk(xml);
    const joined = texts
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");

    slideTexts.push(`Slide ${slideTexts.length + 1}:\n${joined}`);
  }

  return slideTexts.join("\n\n");
}

router.post("/", upload.single("file"), async (req: any, res, next) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new Error("No slides file uploaded");

    const ext = path.extname(file.originalname).toLowerCase();
    const buf = await fs.readFile(file.path);
    let text = "";

    if (ext === ".pdf") {
      // 👇 pdf-parse via CJS require (works reliably under tsx)
      const parsed = await pdfParse(buf);
      text = parsed?.text || "";
    } else if (ext === ".pptx") {
      text = await extractTextFromPptxBuffer(buf);
    } else {
      throw new Error("Unsupported slides type. Use .pdf or .pptx");
    }

    // keep payload reasonable
    if (text.length > 20000) text = text.slice(0, 20000);

    await fs.unlink(file.path).catch(() => {});
    res.json({ text });
  } catch (err) {
    // Log for visibility, then forward
    console.error("[/api/slides] error:", err);
    next(err);
  }
});

export default router;
