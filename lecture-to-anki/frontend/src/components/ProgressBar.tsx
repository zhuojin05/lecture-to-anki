export default function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1 text-xs text-slate-600 dark:text-slate-300">
        <span>{label}</span><span>{p}%</span>
      </div>
      <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-3 bg-indigo-500 dark:bg-indigo-400 transition-all"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
