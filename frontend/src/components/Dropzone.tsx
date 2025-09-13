import React, { useRef } from "react";

type Props = {
  label: string;
  accept: string;
  onFile: (f: File) => void;
};

export default function Dropzone({ label, accept, onFile }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center bg-white/80 dark:bg-slate-800/60 backdrop-blur">
      <p className="text-slate-700 dark:text-slate-100 mb-3 font-medium">{label}</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => ref.current?.click()}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Choose file
        </button>
      </div>
      <input
        type="file"
        accept={accept}
        ref={ref}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        className="hidden"
      />
    </div>
  );
}
