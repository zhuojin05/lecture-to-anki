export function toTimestampRange(startSec: number, endSec: number): string {
  const clamp = (n: number) => Math.max(0, Math.floor(n));
  const s = clamp(startSec);
  const e = clamp(endSec);
  return `${formatMMSS(s)}-${formatMMSS(e)}`;
}

export function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
