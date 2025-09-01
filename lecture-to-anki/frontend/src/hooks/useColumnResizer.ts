// frontend/src/hooks/useColumnResizer.ts
/**
 * AI Assistance Notice
 * Portions of this file were created or refactored with help from AI tools.
 * Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
 * Prompts (summary): “Refactor Express route for slides-first card generation and add retry logic.”
 * Developer review: All generated code was reviewed, tested, and modified by me.
 * Date(s): 2025-08-24
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ColumnKey = "question" | "answer" | "tags" | "source";
type Widths = Record<ColumnKey, number>;

const LS_KEY = "cardTable.columnWidths.v1";

// Reasonable minimums to avoid collapse
const MIN: Widths = {
  question: 8,
  answer: 8,
  tags: 6,
  source: 5,
};

// Sum of resizable group must be 100
const TOTAL = 100;

// Order matters; we resize pairs based on the divider at the right edge
const ORDER: ColumnKey[] = ["question", "answer", "tags", "source"];

// Default widths on first load
export const DEFAULT_WIDTHS: Widths = {
  question: 50,
  answer: 35,
  tags: 10,
  source: 5,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalize(widths: Widths): Widths {
  // Ensure min bounds and sum to TOTAL by proportional scaling (rarely needed)
  const withMin = { ...widths } as Widths;
  let sum = 0;
  (Object.keys(withMin) as ColumnKey[]).forEach((k) => {
    withMin[k] = Math.max(withMin[k], MIN[k]);
    sum += withMin[k];
  });
  if (sum === TOTAL) return withMin;

  const scale = TOTAL / sum;
  const scaled = { ...withMin } as Widths;
  (Object.keys(scaled) as ColumnKey[]).forEach((k) => {
    scaled[k] = Math.max(MIN[k], scaled[k] * scale);
  });

  // Final correction to account for rounding errors
  const correction =
    TOTAL -
    (scaled.question + scaled.answer + scaled.tags + scaled.source);
  // Add correction to the widest column to maintain constraints
  const widestKey = (Object.keys(scaled) as ColumnKey[]).reduce((a, b) =>
    scaled[a] >= scaled[b] ? a : b
  );
  scaled[widestKey] = clamp(
    scaled[widestKey] + correction,
    MIN[widestKey],
    100
  );
  return scaled;
}

function readFromStorage(): Widths | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Widths>;
    const merged = normalize({ ...DEFAULT_WIDTHS, ...parsed } as Widths);
    return merged;
  } catch {
    return null;
  }
}

function saveToStorage(widths: Widths) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(widths));
  } catch {
    // ignore
  }
}

type ActiveDrag = {
  leftKey: ColumnKey; // column to the left of the handle (being resized)
  rightKey: ColumnKey; // adjacent right neighbor
  startX: number; // pixels
  startLeftPct: number;
  startRightPct: number;
};

export function useColumnResizer() {
  const [widths, setWidths] = useState<Widths>(() => {
    return readFromStorage() ?? DEFAULT_WIDTHS;
  });

  const tableRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const rafRef = useRef<number | null>(null);

  // Persist on change
  useEffect(() => {
    saveToStorage(widths);
  }, [widths]);

  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    tableRef.current = el;
  }, []);

  // Map a handle index (0..ORDER.length-2) to a (left,right) pair
  const pairForHandle = useCallback((handleIndex: number): [ColumnKey, ColumnKey] => {
    // handle at the right edge of ORDER[i] resizes ORDER[i] <-> ORDER[i+1]
    const left = ORDER[handleIndex];
    const right = ORDER[handleIndex + 1] ?? ORDER[handleIndex]; // fallback safeguard
    return [left, right];
  }, []);

  const startDrag = useCallback(
    (e: PointerEvent | MouseEvent, handleIndex: number) => {
      if (!tableRef.current) return;
      const rect = tableRef.current.getBoundingClientRect();
      const [leftKey, rightKey] = pairForHandle(handleIndex);
      const startX = (e as PointerEvent).clientX ?? (e as MouseEvent).clientX;

      dragRef.current = {
        leftKey,
        rightKey,
        startX,
        startLeftPct: widths[leftKey],
        startRightPct: widths[rightKey],
      };

      // Add global listeners
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });

      // During drag, prevent text selection
      document.body.classList.add("select-none");

      function onPointerMove(ev: PointerEvent) {
        if (!dragRef.current) return;
        if (!tableRef.current) return;
        const dx = ev.clientX - dragRef.current.startX; // pixels
        const containerWidth = rect.width;
        if (containerWidth <= 0) return;

        // Convert dx to percentage of resizable group
        const deltaPct = (dx / containerWidth) * TOTAL;

        // Propose new widths
        let newLeft = dragRef.current.startLeftPct + deltaPct;
        let newRight = dragRef.current.startRightPct - deltaPct;

        // Clamp both sides
        newLeft = clamp(newLeft, MIN[dragRef.current.leftKey], 100);
        newRight = clamp(newRight, MIN[dragRef.current.rightKey], 100);

        // If clamping caused overflow, re-evaluate delta to maintain sum
        const desiredSum = dragRef.current.startLeftPct + dragRef.current.startRightPct;
        const clampedSum = newLeft + newRight;
        if (Math.abs(clampedSum - desiredSum) > 0.0001) {
          // Try to fix by adjusting the other side within limits
          const overflow = clampedSum - desiredSum;
          if (overflow > 0) {
            // Too big; attempt to reduce the side that isn't at min
            if (newLeft > MIN[dragRef.current.leftKey]) {
              const reduceLeft = Math.min(
                overflow,
                newLeft - MIN[dragRef.current.leftKey]
              );
              newLeft -= reduceLeft;
            } else if (newRight > MIN[dragRef.current.rightKey]) {
              const reduceRight = Math.min(
                overflow,
                newRight - MIN[dragRef.current.rightKey]
              );
              newRight -= reduceRight;
            }
          }
        }

        const next = normalize({
          ...widths,
          [dragRef.current.leftKey]: newLeft,
          [dragRef.current.rightKey]: newRight,
        });

        // Throttle with rAF for smoother dragging
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setWidths(next));
      }

      function onPointerUp() {
        window.removeEventListener("pointermove", onPointerMove);
        dragRef.current = null;
        document.body.classList.remove("select-none");
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
    },
    [pairForHandle, widths]
  );

  const onHandlePointerDown = useCallback(
    (handleIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      startDrag(e.nativeEvent, handleIndex);
    },
    [startDrag]
  );

  // Keyboard accessibility: nudge left/right by fixed pct step
  const STEP = 0.5; // percent per key press

  const onHandleKeyDown = useCallback(
    (handleIndex: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight") return;

      e.preventDefault();
      const [leftKey, rightKey] = pairForHandle(handleIndex);
      const dir = key === "ArrowLeft" ? -1 : 1;
      let newLeft = widths[leftKey] + dir * STEP;
      let newRight = widths[rightKey] - dir * STEP;

      newLeft = clamp(newLeft, MIN[leftKey], 100);
      newRight = clamp(newRight, MIN[rightKey], 100);

      const next = normalize({
        ...widths,
        [leftKey]: newLeft,
        [rightKey]: newRight,
      });
      setWidths(next);
    },
    [pairForHandle, widths]
  );

  const handles = useMemo(() => {
    // One handle per boundary between columns: 3 handles for 4 columns
    // Index mapping:
    // 0 -> question | answer
    // 1 -> answer   | tags
    // 2 -> tags     | source
    return [
      { index: 0, left: "question" as const, right: "answer" as const, aria: "Resize Question column" },
      { index: 1, left: "answer" as const, right: "tags" as const, aria: "Resize Answer column" },
      { index: 2, left: "tags" as const, right: "source" as const, aria: "Resize Tags column" },
    ];
  }, []);

  return {
    widths,             // percentage widths for each column
    setWidths,          // if ever needed
    setContainerRef,    // ref to outer container to measure width
    onHandlePointerDown,
    onHandleKeyDown,
    handles,
  };
}