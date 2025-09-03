// backend/src/middleware/error.ts
import type { Request, Response, NextFunction } from "express";

type HttpError = { status?: number; message?: string };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const e = (typeof err === "object" && err) ? (err as HttpError) : {};
  const status = typeof e.status === "number" ? e.status : 500;
  const message = typeof e.message === "string" ? e.message : "Internal Server Error";

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ error: message });
}