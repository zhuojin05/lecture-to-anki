import { NextFunction, Request, Response } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(err?.status || 500).json({ error: err?.message || "Internal Server Error" });
}
