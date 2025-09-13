// frontend/src/components/ProgressBar.tsx
type Props = {
  pct: number;          // 0..100
  label?: string;
  busy?: boolean;       // NEW: when true and pct < 100, show animated dots
};

export default function ProgressBar({ pct, label, busy = false }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const showDots = busy && clamped < 100;

  return (
    <div className="space-y-2">
      {/* Label row */}
      <div className="flex items-center gap-2 text-sm">
        {clamped < 100 ? (
          <>
            {!busy && (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500">
                <svg
                  className="h-4 w-4 text-indigo-500"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <circle cx="10" cy="10" r="6" fill="currentColor" />
                </svg>
              </div>
            )}
            <span className="text-slate-700 dark:text-slate-300">
              {label ?? (busy ? "Working…" : "Idle")}
            </span>

            {/* animated dots only when busy */}
            {showDots && (
              <span
                aria-label="loading"
                className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"
                title="Processing"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse [animation-delay:120ms]" />
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-300 animate-pulse [animation-delay:240ms]" />
              </span>
            )}
          </>
        ) : (
          // your emerald checkmark "Done" UI kept intact
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
              <svg
                className="h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Done
            </span>
          </div>
        )}
      </div>

      {/* Track */}
      <div className="w-full h-2 rounded-full bg-slate-200/70 dark:bg-slate-700/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}