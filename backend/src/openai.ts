import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 5,
  timeout: 600_000 // 10 min
});

// export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
export const TRANSCRIBE_MODEL = "whisper-1";
export const SECTIONS_MODEL  = process.env.OPENAI_SECTIONS_MODEL  || "gpt-4o-mini";
export const CARDS_MODEL     = process.env.OPENAI_CARDS_MODEL     || "gpt-4o-mini";

