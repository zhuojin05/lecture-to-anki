import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error.js";

import transcribeRoute from "./routes/transcribe.js";
import sectionsRoute from "./routes/sections.js";
import cardsRoute from "./routes/cards.js";
import exportRoute from "./routes/export.js";
import slidesRoute from "./routes/slides.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

// Simple request logger so you see traffic
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Friendly root
app.get("/", (_req, res) => {
  res.type("text/plain").send("Lecture→Anki API is running. Try GET /api/health");
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ✅ Mount routers correctly
app.use("/api/transcribe", transcribeRoute);
app.use("/api/sections", sectionsRoute);
app.use("/api/cards", cardsRoute);
app.use("/api/export", exportRoute);
app.use("/api/slides", slidesRoute);

app.use(errorHandler);

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
