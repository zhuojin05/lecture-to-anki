// backend/src/routes/transcribe.ts
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
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { openai, TRANSCRIBE_MODEL } from "../openai.js";
import { TranscriptSegment } from "../types.js";
import { upload } from "../middleware/upload.js";

// Point ffmpeg to the static binary
if (!ffmpegStatic) {
  console.warn("[transcribe] ffmpeg-static not found; make sure it's installed");
} else {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

const router = Router();

async function extractAudioToMp3(inputPath: string): Promise<string> {
  const outPath = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)
      .audioBitrate("32k") // smaller => faster upload
      .format("mp3")
      .on("error", reject)
      .on("end", () => resolve())
      .save(outPath);
  });
  return outPath;
}

function isWhisper(model: string) {
  return model.toLowerCase().includes("whisper");
}

async function transcribeWithRetry(audioPath: string) {
  const max = 4;
  for (let i = 0; i < max; i++) {
    try {
      // Debug: log file path and size before sending
      console.log(
        `[transcribe] sending to OpenAI: ${audioPath}, size = ${fs.statSync(audioPath).size} bytes`
      );

      const params: any = {
        file: fs.createReadStream(audioPath) as any,
        model: TRANSCRIBE_MODEL
      };

      // Only Whisper supports segment-rich verbose_json
      if (isWhisper(TRANSCRIBE_MODEL)) {
        params.response_format = "verbose_json";
      } else {
        // Non-Whisper models: keep default JSON (text only)
      }

      return await openai.audio.transcriptions.create(params);
    } catch (err: any) {
      const msg = String(err?.message || "");
      const isConn = msg.includes("ECONNRESET") || msg.includes("network");
      const is429 = err?.status === 429;
      const is5xx = err?.status >= 500;
      if (i < max - 1 && (isConn || is429 || is5xx)) {
        const wait = 1000 * Math.pow(2, i); // 1s, 2s, 4s...
        console.warn(
          `[transcribe] retry #${i + 1} after ${wait}ms due to:`,
          err?.message || err
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error("transcribeWithRetry: exhausted retries");
}

// POST /api/transcribe (multipart) -> { segments: TranscriptSegment[], text: string }
router.post("/", upload.single("file"), async (req: any, res, next) => {
  const started = Date.now();
  let cleanupPaths: string[] = [];
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new Error("No file uploaded");

    console.log(`[transcribe] received ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

    // If it's a video, extract audio first; if it's already audio, use as-is.
    let audioPath = file.path;
    cleanupPaths.push(file.path);

    if (file.mimetype.startsWith("video/")) {
      console.log("[transcribe] extracting audio with ffmpeg…");
      audioPath = await extractAudioToMp3(file.path);
      cleanupPaths.push(audioPath);
      console.log("[transcribe] audio ready:", audioPath);
    }
    
    // Check file size before sending
    const stats = await fsp.stat(audioPath);
    console.log(
      `[transcribe] model=${TRANSCRIBE_MODEL} sending audio ~${Math.round(stats.size / 1024)} KB`
    );

    const t1 = Date.now();
    const transcription: any = await transcribeWithRetry(audioPath); // <-- use the retry helper
    const t2 = Date.now();
    console.log(`[transcribe] openai took ${(t2 - t1)/1000}s, total ${(t2 - started)/1000}s`);

    let segments: TranscriptSegment[] = [];
    let text: string = "";

    const isWhisper = (model: string) => model.includes("whisper");

    if (isWhisper(TRANSCRIBE_MODEL) && Array.isArray(transcription.segments)) {
      segments = transcription.segments.map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text
      }));
      text = transcription.text || segments.map(s => s.text).join(" ");
    } else {
      // Fallback: GPT-4o-transcribe and others may not return segments
      text = transcription.text || "";
      if (text) {
        segments = [{
          start: 0,
          end: Math.max(1, Math.round(text.length / 12)), // crude duration estimate
          text
        }];
      }
    }

    res.json({ segments, text });
  } catch (err) {
    console.error(err);
    next(err);
  } finally {
    // Cleanup temp files
    await Promise.allSettled(cleanupPaths.map(p => fsp.unlink(p)));
  }
});

export default router;
