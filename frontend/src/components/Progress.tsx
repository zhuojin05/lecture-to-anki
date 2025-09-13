type Props = {
  /** 0 = none, 1 = Upload, 2 = Transcribing, 3 = Structuring, 4 = Writing Cards */
  step?: 0 | 1 | 2 | 3 | 4;
  /** Optional custom labels */
  labels?: [string, string, string, string];
};

const DEFAULT_STEPS: [string, string, string, string] = [
  "Upload",
  "Transcribing",
  "Structuring",
  "Writing Cards",
];

export default function Progress({ step = 0, labels = DEFAULT_STEPS }: Props) {
  const clamped = Math.max(0, Math.min(4, step));

  return (
    <nav aria-label="Progress" className="mt-4">
      <ol className="flex items-center gap-3 flex-wrap" role="list">
        {labels.map((label, idx) => {
          const number = idx + 1 as 1 | 2 | 3 | 4;
          const isCompleted = clamped > number;
          const isCurrent = clamped === number;

          // Circle styles
          const circle =
            isCurrent
              ? "bg-indigo-600 text-white"
              : isCompleted
              ? "bg-indigo-500 text-white"
              : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";

          // Label styles
          const text =
            isCurrent || isCompleted
              ? "text-slate-900 dark:text-white font-medium"
              : "text-slate-600 dark:text-slate-300";

          return (
            <li key={label} className="flex items-center gap-2">
              <div
                className={[
                  "w-7 h-7 rounded-full grid place-items-center text-sm font-semibold",
                  circle,
                ].join(" ")}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${number}: ${label}${isCurrent ? " (current)" : isCompleted ? " (completed)" : ""}`}
              >
                {number}
              </div>
              <span className={text}>{label}</span>
              {idx < labels.length - 1 && (
                <div
                  className={[
                    "mx-1 h-[2px] w-10",
                    isCompleted
                      ? "bg-indigo-400 dark:bg-indigo-500"
                      : "bg-slate-300 dark:bg-slate-600",
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
