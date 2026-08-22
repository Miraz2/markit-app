import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function AuthShell({ children, tagline }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-700 text-slate-100 relative overflow-hidden p-6">
      {/* Background glowing ambient light spheres */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-slate-500/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-slate-500/30 rounded-full blur-3xl pointer-events-none" />

      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl glass-card text-slate-300 hover:text-white transition"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="h-5 w-5 text-slate-500" /> : <Moon className="h-5 w-5 text-slate-500" />}
        </button>
      </div>

      <div className="w-full max-w-md z-10">
        {/* Brand logo header */}
        <div className="text-center mb-8">
          <a
            href="#"
            className="inline-block group cursor-pointer select-none transition-transform duration-150 ease-out hover:scale-105 active:scale-90"
            aria-label="MarkIt home"
          >
            <img
              src="/logo.svg"
              alt="MarkIt logo"
              className="inline-block h-14 w-14 rounded-2xl object-cover shadow-xl shadow-slate-900/30 mb-4 ring-1 ring-white/10 transition-shadow duration-150 group-hover:shadow-2xl group-active:shadow-md"
            />
            <h1 className="font-display text-3xl font-extrabold text-white tracking-tight">MarkIt</h1>
          </a>
          <p className="mt-1 text-sm text-slate-400">{tagline}</p>
        </div>

        {/* Form Container Card */}
        <div className="glass-card rounded-3xl p-8 shadow-2xl border border-white/10">
          {children}
        </div>
      </div>
    </div>
  );
}
