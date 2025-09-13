import React from "react";

export default function ThemeToggle() {
  function toggle() {
    const html = document.documentElement;
    const next = html.classList.contains("dark") ? "light" : "dark";
    html.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }

  React.useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  }, []);

  return (
    <button
      onClick={toggle}
      className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
      title="Toggle theme"
    >
      🌗
    </button>
  );
}
