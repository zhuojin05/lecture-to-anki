import React, { useMemo, useState } from "react";
import type { Card } from "../lib/types";

type Props = {
  cards: Card[];
  setCards: (cards: Card[]) => void;
};

export default function CardTable({ cards, setCards }: Props) {
  const [history, setHistory] = useState<Card[][]>([]);
  const [filter, setFilter] = useState("");

  const displayed = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return cards;
    return cards.filter(
      (c) =>
        c.question.toLowerCase().includes(f) ||
        c.answer.toLowerCase().includes(f) ||
        c.tags.join(" ").toLowerCase().includes(f)
    );
  }, [cards, filter]);

  function pushHistory() {
    setHistory((h) => [...h, cards.map((c) => ({ ...c }))]);
  }

  function updateCard(idx: number, key: keyof Card, val: any) {
    pushHistory();
    const next = cards.slice();
    (next[idx] as any)[key] = val;
    setCards(next);
  }

  function removeCard(idx: number) {
    pushHistory();
    const next = cards.slice();
    next.splice(idx, 1);
    setCards(next);
  }

  function undo() {
    const prev = history.pop();
    if (prev) setCards(prev);
    setHistory([...history]);
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <input
          className="border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 w-64 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={undo}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Undo
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm table-fixed">
          {/* Widths: # (48px), Q (40%), A (40%), Tags (14%), Source (auto), Action (44px) */}
          <colgroup>
            <col style={{ width: "48px" }} />
            <col style={{ width: "40%" }} />
            <col style={{ width: "40%" }} />
            <col style={{ width: "14%" }} />
            <col /> {/* auto for Source */}
            <col style={{ width: "44px" }} />
          </colgroup>

          <thead className="text-left">
            <tr className="text-slate-600 dark:text-slate-300">
              <th className="p-2">#</th>
              <th className="p-2">Question</th>
              <th className="p-2">Answer</th>
              <th className="p-2">Tags</th>
              <th className="p-2">Source</th>
              <th className="p-2"></th>
            </tr>
          </thead>

          <tbody>
            {displayed.map((c, i) => (
              <tr key={i} className="border-t border-slate-200 dark:border-slate-700 align-top">
                <td className="p-2 text-slate-400 dark:text-slate-500 whitespace-nowrap">{i + 1}</td>

                {/* Question (bigger) */}
                <td className="p-2">
                  <textarea
                    className="w-full min-h-24 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    rows={3}
                    value={c.question}
                    onChange={(e) => updateCard(i, "question", e.target.value)}
                  />
                </td>

                {/* Answer (bigger) */}
                <td className="p-2">
                  <textarea
                    className="w-full min-h-24 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    rows={3}
                    value={c.answer}
                    onChange={(e) => updateCard(i, "answer", e.target.value)}
                  />
                </td>

                {/* Tags (narrower) */}
                <td className="p-2">
                  <input
                    className="w-full border border-slate-300 dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 mb-1"
                    value={c.tags.join(" ")}
                    onChange={(e) =>
                      updateCard(
                        i,
                        "tags",
                        e.target.value
                          .split(/\s+/)
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="tags…"
                  />
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t, k) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 max-w-full truncate"
                        title={t}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Source (compact / fit-ish) */}
                <td className="p-2 whitespace-nowrap">
                  <input
                    className="border border-slate-300 dark:border-slate-700 rounded px-2 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-28 sm:w-32 md:w-36"
                    value={c.source_timestamp}
                    onChange={(e) => updateCard(i, "source_timestamp", e.target.value)}
                    placeholder="mm:ss-mm:ss"
                  />
                </td>

                {/* Delete (icon only) */}
                <td className="p-2">
                  <button
                    onClick={() => removeCard(i)}
                    className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30"
                    aria-label="Delete card"
                    title="Delete"
                  >
                    {/* inline trash icon (no extra deps) */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="w-5 h-5 text-rose-600 dark:text-rose-400"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}

            {displayed.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 dark:text-slate-500">
                  No cards.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
