// frontend/src/hooks/useColumnResizer.ts
/**
 * Column resizer with pair-wise resizing: only the two columns adjacent to a handle change.
 * - Works in pixels during drag, converts to % on pointer up (for persistence).
 * - Enforces per-column minPx clamps.
 * - Keeps "index" (left-most in table) outside this hook; we only manage Q/A/Tags/Source.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type WidthsPct = {
  question: number; // %
  answer: number;   // %
  tags: number;     // %
  source: number;   // %
};

const STORAGE_KEY = "cardTable.columnWidths.v1";

// Defaults that sum to 100
export const DEFAULT_WIDTHS: WidthsPct = {
  question: 50,
  answer: 35,
  tags: 10,
  source: 5,
};

// Reasonable minimums in pixels (avoid unreadable columns)
// Lowered tags/source mins so Q/A can truly claim more space.
const MIN_PX = {
  question: 240,
  answer: 200,
  tags: 72,   // was 96
  source: 72, // was 96
} as const;

export function useColumnResizer() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load/save state
  const [widths, setWidths] = useState<WidthsPct>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WidthsPct>;
        const merged = { ...DEFAULT_WIDTHS, ...parsed };
        const sum = merged.question + merged.answer + merged.tags + merged.source;
        if (sum > 98 && sum < 102) return merged;
      }
    } catch {}
    return DEFAULT_WIDTHS;
  });

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {}
  }, [widths]);

  // Pointer drag session refs
  const dragIndexRef = useRef<number | null>(null); // 0,1,2 for handles
  const startXRef = useRef<number>(0);
  const containerWidthRef = useRef<number>(0);
  const pairStartPxRef = useRef<{ leftPx: number; rightPx: number; totalPx: number } | null>(null);

  // Map handle index → keys of the two columns it separates
  const pairFromHandle = useCallback((handleIndex: number): [keyof WidthsPct, keyof WidthsPct] => {
    // index col is fixed outside this hook, so handle 0 begins at Question|Answer
    if (handleIndex === 0) return ["question", "answer"];
    if (handleIndex === 1) return ["answer", "tags"];
    // handle 2
    return ["tags", "source"];
  }, []);

  // Convert current % widths to pixels for this container
  const getPxFromPct = useCallback(
    (w: WidthsPct) => {
      const cw = containerRef.current?.getBoundingClientRect().width ?? 0;
      return {
        question: (w.question / 100) * cw,
        answer: (w.answer / 100) * cw,
        tags: (w.tags / 100) * cw,
        source: (w.source / 100) * cw,
        cw,
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const handleIndex = dragIndexRef.current;
      if (handleIndex == null) return;
      const pairStart = pairStartPxRef.current;
      if (!pairStart) return;

      const dx = e.clientX - startXRef.current;

      // Which pair are we resizing?
      const [leftKey, rightKey] = pairFromHandle(handleIndex);

      // Current pixel widths of the pair at drag start
      let leftPx = pairStart.leftPx + dx;
      let rightPx = pairStart.totalPx - leftPx;

      // Clamp both sides to minPx, but keep total constant
      const minLeft = MIN_PX[leftKey];
      const minRight = MIN_PX[rightKey];

      // Clamp left: if under min, fix left=min and recompute right
      if (leftPx < minLeft) {
        leftPx = minLeft;
        rightPx = pairStart.totalPx - leftPx;
      }
      // Clamp right similarly
      if (rightPx < minRight) {
        rightPx = minRight;
        leftPx = pairStart.totalPx - rightPx;
      }

      // Guard: if both hit min, do nothing further (pair can't compress more)
      if (leftPx === minLeft && rightPx === minRight) {
        return;
      }

      // Update state by converting only these two to %; others unchanged
      const cw = containerWidthRef.current || 1;
      setWidths((prev) => {
        const next: WidthsPct = { ...prev };
        next[leftKey] = Math.max(0, (leftPx / cw) * 100);
        next[rightKey] = Math.max(0, (rightPx / cw) * 100);
        return next;
      });
    },
    [pairFromHandle]
  );

  const endDrag = useCallback(() => {
    dragIndexRef.current = null;
    pairStartPxRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [onPointerMove]);

  const onHandlePointerDown = useCallback(
    (handleIndex: number) => (ev: React.PointerEvent) => {
      // Only left mouse / primary pointer
      if ((ev as any).button !== undefined && (ev as any).button !== 0) return;

      dragIndexRef.current = handleIndex;
      startXRef.current = ev.clientX;
      const rectW = containerRef.current?.getBoundingClientRect().width ?? 0;
      containerWidthRef.current = rectW;

      // Snapshot the pair at drag start in pixels
      const { question, answer, tags, source } = getPxFromPct(widths);
      const [leftKey, rightKey] = pairFromHandle(handleIndex);
      const leftPx = { question, answer, tags, source }[leftKey];
      const rightPx = { question, answer, tags, source }[rightKey];

      pairStartPxRef.current = {
        leftPx,
        rightPx,
        totalPx: leftPx + rightPx,
      };

      (ev.target as Element).setPointerCapture?.(ev.pointerId);

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [endDrag, getPxFromPct, onPointerMove, pairFromHandle, widths]
  );

  // Keyboard resizing for accessibility (Left/Right arrows)
  const onHandleKeyDown = useCallback(
    (handleIndex: number) => (ev: React.KeyboardEvent) => {
      const STEP = 8; // px per keypress
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;

      const [leftKey, rightKey] = pairFromHandle(handleIndex);
      const { question, answer, tags, source, cw } = getPxFromPct(widths);
      const mapPx = { question, answer, tags, source } as Record<keyof WidthsPct, number>;

      const delta = ev.key === "ArrowLeft" ? -STEP : STEP;
      let leftPx = mapPx[leftKey] + delta;
      let rightPx = mapPx[rightKey] - delta;

      const minLeft = MIN_PX[leftKey];
      const minRight = MIN_PX[rightKey];

      if (leftPx < minLeft) {
        leftPx = minLeft;
        rightPx = mapPx[leftKey] + mapPx[rightKey] - leftPx;
      }
      if (rightPx < minRight) {
        rightPx = minRight;
        leftPx = mapPx[leftKey] + mapPx[rightKey] - rightPx;
      }
      // If both mins hit, no-op
      if (leftPx === minLeft && rightPx === minRight) return;

      setWidths((prev) => ({
        ...prev,
        [leftKey]: (leftPx / cw) * 100,
        [rightKey]: (rightPx / cw) * 100,
      }));
      ev.preventDefault();
    },
    [getPxFromPct, pairFromHandle, widths]
  );

  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  return {
    widths,
    setWidths,
    setContainerRef,
    onHandlePointerDown,
    onHandleKeyDown,
  };
}