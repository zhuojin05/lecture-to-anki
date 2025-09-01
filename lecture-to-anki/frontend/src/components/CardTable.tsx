// frontend/src/components/CardTable.tsx
/**
 * AI Assistance Notice
 * Portions of this file were created or refactored with help from AI tools.
 * Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
 * Prompts (summary): “Refactor Express route for slides-first card generation and add retry logic.”
 * Developer review: All generated code was reviewed, tested, and modified by me.
 * Date(s): 2025-08-24
 */
import React, { useMemo, useState } from "react";

import { useColumnResizer, DEFAULT_WIDTHS } from "../hooks/useColumnResizer";
import type { Card } from "../lib/types";

// Utility: simple class join
function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

type Props = {
  cards: Card[];
  setCards?: React.Dispatch<React.SetStateAction<Card[]>>;
  onUpdateCard?: (index: number, patch: Partial<Card>) => void;
  onDeleteCard?: (index: number) => void;
};

const headerBase =
  "relative px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800";
const cellBase =
  "px-3 py-2 align-top border-b border-gray-100 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100";
const handleBase =
  "absolute top-0 right-0 h-full w-1 cursor-col-resize select-none";
const handleVisual =
  "absolute top-0 right-[-2px] h-full w-1 opacity-60 hover:opacity-100";

export default function CardTable({ 
  cards, 
  setCards, 
  onUpdateCard, 
  onDeleteCard 
}: Props) {
  const {
    widths,
    setContainerRef,
    onHandlePointerDown,
    onHandleKeyDown,
    handles,
  } = useColumnResizer();

  // Inline edit state (preserves your existing UX if you already had it)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const colStyles = useMemo(
    () => ({
      question: { width: `${widths.question}%` },
      answer: { width: `${widths.answer}%` },
      tags: { width: `${widths.tags}%` },
      source: { width: `${widths.source}%` },
      actions: {}, // auto/minimal
    }),
    [widths]
  );

  return (
    <div className="w-full">
      {/* Outer container used by the hook to compute pixel -> percentage deltas */}
      <div ref={setContainerRef} className="relative w-full">
        <div className="overflow-x-auto rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <table className="min-w-full table-fixed border-collapse">
            <colgroup>
              <col style={colStyles.question} />
              <col style={colStyles.answer} />
              <col style={colStyles.tags} />
              <col style={colStyles.source} />
              <col /> {/* actions auto */}
            </colgroup>
            <thead className="bg-gray-50 dark:bg-neutral-900/60">
              <tr>
                {/* Question */}
                <th className={headerBase}>
                  <span>Question</span>
                  {/* Right-edge handle (Question ↔ Answer) */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Question column"
                    tabIndex={0}
                    onPointerDown={onHandlePointerDown(0)}
                    onKeyDown={onHandleKeyDown(0)}
                    className={cx(handleBase)}
                  >
                    {/* thin visual line slightly outside to increase hit area but keep thin line look */}
                    <div className={cx(handleVisual, "bg-gray-300 dark:bg-neutral-700")} />
                  </div>
                </th>

                {/* Answer */}
                <th className={headerBase}>
                  <span>Answer</span>
                  {/* Right-edge handle (Answer ↔ Tags) */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Answer column"
                    tabIndex={0}
                    onPointerDown={onHandlePointerDown(1)}
                    onKeyDown={onHandleKeyDown(1)}
                    className={cx(handleBase)}
                  >
                    <div className={cx(handleVisual, "bg-gray-300 dark:bg-neutral-700")} />
                  </div>
                </th>

                {/* Tags */}
                <th className={headerBase}>
                  <span>Tags</span>
                  {/* Right-edge handle (Tags ↔ Source) */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Tags column"
                    tabIndex={0}
                    onPointerDown={onHandlePointerDown(2)}
                    onKeyDown={onHandleKeyDown(2)}
                    className={cx(handleBase)}
                  >
                    <div className={cx(handleVisual, "bg-gray-300 dark:bg-neutral-700")} />
                  </div>
                </th>

                {/* Source */}
                <th className={headerBase}>
                  <span>Source</span>
                  {/* No visible handle to the right (kept within resizable group via the Tags handle) */}
                </th>

                {/* Actions (auto/minimal) */}
                <th className={headerBase}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-neutral-900">
              {cards.map((card, i) => {
                const isEditing = editingIndex === i;
                return (
                  <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-neutral-800/50">
                    {/* Question */}
                    <td className={cellBase}>
                      {isEditing ? (
                        <textarea
                          defaultValue={card.question}
                          className="w-full resize-y rounded-lg border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-neutral-900 dark:border-neutral-700"
                          onBlur={(e) => {
                            onUpdateCard?.(i, { question: e.currentTarget.value });
                          }}
                        />
                      ) : (
                        <div>{card.question}</div>
                      )}
                    </td>

                    {/* Answer */}
                    <td className={cellBase}>
                      {isEditing ? (
                        <textarea
                          defaultValue={card.answer}
                          className="w-full resize-y rounded-lg border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-neutral-900 dark:border-neutral-700"
                          onBlur={(e) => {
                            onUpdateCard?.(i, { answer: e.currentTarget.value });
                          }}
                        />
                      ) : (
                        <div>{card.answer}</div>
                      )}
                    </td>

                    {/* Tags */}
                    <td className={cellBase}>
                      {isEditing ? (
                        <input
                          defaultValue={card.tags?.join(", ") ?? ""}
                          className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-neutral-900 dark:border-neutral-700"
                          onBlur={(e) => {
                            const raw = e.currentTarget.value;
                            const tags = raw
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean);
                            onUpdateCard?.(i, { tags });
                          }}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(card.tags ?? []).map((t, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-gray-200 px-2 py-0.5 text-xs dark:border-neutral-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Source */}
                    <td className={cellBase}>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {card.source_type ?? "—"}
                        </span>
                        <span className="text-xs">
                          {card.source_timestamp
                            ? new Date(card.source_timestamp).toLocaleString()
                            : "—"}
                        </span>

                        {/* Only render slide index if it is a number (or a string) */}
                        {typeof card.slide_index === "number" && (
                          <span className="text-xs">Slide {card.slide_index}</span>
                        )}
                        {typeof card.slide_index === "string" && card.slide_index.trim() !== "" && (
                          <span className="text-xs">Slide {card.slide_index}</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className={cellBase}>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <button
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            onClick={() => setEditingIndex(null)}
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                            onClick={() => setEditingIndex(i)}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
                          onClick={() => onDeleteCard?.(i)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {cards.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                    colSpan={5}
                  >
                    No cards yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Optional: reset widths control */}
        <div className="mt-2 flex items-center gap-3">
          <button
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800"
            onClick={() => {
              const evt = new CustomEvent("reset-cardtable-widths");
              window.dispatchEvent(evt);
            }}
            title="Reset column widths to defaults"
          >
            Reset widths
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Defaults — Q:{DEFAULT_WIDTHS.question}% A:{DEFAULT_WIDTHS.answer}% T:
            {DEFAULT_WIDTHS.tags}% S:{DEFAULT_WIDTHS.source}%
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Global listener to support the "Reset widths" button above without importing hook internals.
 * This avoids circular deps and keeps CardTable a drop-in.
 */
declare global {
  interface WindowEventMap {
    "reset-cardtable-widths": CustomEvent;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("reset-cardtable-widths", () => {
    try {
      localStorage.removeItem("cardTable.columnWidths.v1");
    } catch {
      // ignore
    }
    // Trigger a soft reload to re-hydrate widths from defaults. This is simple and predictable.
    window.location.reload();
  });
}