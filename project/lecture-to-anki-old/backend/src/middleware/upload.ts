import multer from "multer";
import path from "node:path";
import os from "node:os";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: (Number(process.env.MAX_UPLOAD_MB ?? "2048")) * 1024 * 1024
  }
});
