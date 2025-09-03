// frontend/src/components/CardTable.tsx
/**
 * AI Assistance Notice
 * Portions of this file were created or refactored with help from AI tools.
 * Tools/Models: ChatGPT (GPT-5 Thinking), GitHub Copilot
 * Prompts (summary): “Make columns resizable, add fixed index column, dark-mode polish.”
 * Developer review: All generated code was reviewed, tested, and modified by me.
 * Date(s): 2025-09-02
 */

import { useMemo, useState } from "react";
import { useColumnResizer } from "../hooks/useColumnResizer";
import type { Card } from "../lib/types";

// tiny class join
function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

type Props = {
  cards: Card[];
  onUpdateCard?: (index: number, patch: Partial<Card>) => void;
  onDeleteCard?: (index: number) => void;
};

const headerBase =
  "relative px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800";
const cellBase =
  "px-3 py-2 align-top border-b border-slate-100 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100";
const handleBase = "absolute top-0 right-0 h-full w-1 cursor-col-resize select-none";
const handleVisual = "absolute top-0 right-[-2px] h-full w-1 opacity-60 hover:opacity-100";

/**
 * Table with:
 *  - Fixed left index column (4rem, not resizable)
 *  - Resizable: Question, Answer, Tags, Source
 *  - Actions minimal auto width
 */
export default function CardTable({ cards, onUpdateCard, onDeleteCard }: Props) {
  const { widths, setContainerRef, onHandlePointerDown, onHandleKeyDown } = useColumnResizer();

  // inline editor
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // computed width styles; index column is fixed via colgroup width
  const colStyles = useMemo(
    () => ({
      index: { width: "4rem" }, // fixed
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
      <div ref={setContainerRef} className="relative w-full">
        <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-800/60 dark:ring-white/10">
          <table className="min-w-full table-fixed border-collapse">
            <colgroup>
              {/* Fixed, non-resizable index col */}
              <col style={colStyles.index} />
              <col style={colStyles.question} />
              <col style={colStyles.answer} />
              <col style={colStyles.tags} />
              <col style={colStyles.source} />
              <col /> {/* actions auto */}
            </colgroup>

            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className={cx(headerBase, "text-center")}>#</th>

                {/* Question */}
                <th className={headerBase}>
                  <span>Question</span>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Question column"
                    tabIndex={0}
                    onPointerDown={onHandlePointerDown(0)}
                    onKeyDown={onHandleKeyDown(0)}
                    className={handleBase}
                  >
                    <div className={cx(handleVisual, "bg-slate-300 dark:bg-slate-700")} />
                  </div>
                </th>

                {/* Answer */}
                <th className={headerBase}>
                  <span>Answer</span>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Answer column"
                    tabIndex={0}
                    onPointerDown={onHandlePointerDown(1)}
                    onKeyDown={onHandleKeyDown(1)}
                    className={handleBase}
                  >
                    <div className={cx(handleVisual, "bg-slate-300 dark:bg-slate-700")} />
                  </div>
                </th>

                {/* Tags */}
                <th className={headerBase}>
                  <span>Tags</span>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize Tags column"
                    tabIndex={0}
                    onPointerDown={onHandlePointerDown(2)}
                    onKeyDown={onHandleKeyDown(2)}
                    className={handleBase}
                  >
                    <div className={cx(handleVisual, "bg-slate-300 dark:bg-slate-700")} />
                  </div>
                </th>

                {/* Source */}
                <th className={headerBase}>
                  <span>Source</span>
                  {/* no visible handle to the right; last resizable boundary is the one above */}
                </th>

                {/* Actions */}
                <th className={headerBase}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-slate-900">
              {cards.map((card, i) => {
                const isEditing = editingIndex === i;
                return (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                    {/* Index (fixed width, centered) */}
                    <td className={cx(cellBase, "text-center text-xs text-slate-500 dark:text-slate-400")}>
                      {i + 1}
                    </td>

                    {/* Question */}
                    <td className={cellBase}>
                      {isEditing ? (
                        <textarea
                          defaultValue={card.question}
                          className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700"
                          onBlur={(e) => onUpdateCard?.(i, { question: e.currentTarget.value })}
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
                          className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700"
                          onBlur={(e) => onUpdateCard?.(i, { answer: e.currentTarget.value })}
                        />
                      ) : (
                        <div>{card.answer}</div>
                      )}
                    </td>

                    {/* Tags (keep narrow by default; allow horizontal scroll) */}
                    <td className={cx(cellBase, "whitespace-nowrap overflow-x-auto")}>
                      {isEditing ? (
                        <input
                          defaultValue={Array.isArray(card.tags) ? card.tags.join(", ") : ""}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700"
                          onBlur={(e) => {
                            const tags = e.currentTarget.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean);
                            onUpdateCard?.(i, { tags });
                          }}
                        />
                      ) : (
                        <div className="flex gap-1 overflow-x-auto">
                          {(card.tags ?? []).map((t, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs dark:border-slate-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Source (show type, timestamp string, optional slide index) */}
                    <td className={cellBase}>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {card.source_type ?? "—"}
                        </span>
                        <span className="text-xs">{card.source_timestamp || "—"}</span>
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
                  <td className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={6}>
                    No cards yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* “Reset widths” UI was intentionally removed per request */}
      </div>
    </div>
  );
}