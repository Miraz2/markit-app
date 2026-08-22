import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Combobox — the input itself is the search box. Options: [{ value, label }]
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  searchPlaceholder,
  disabled = false,
  emptyMessage = "No options available",
}) {
  const [open, setOpen] = useState(false);
  // null = not filtering yet (show everything); string = active filter text
  const [filterText, setFilterText] = useState(null);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (filterText == null) return options;
    const q = filterText.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, filterText]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    window.addEventListener("mousedown", onOutside);
    return () => window.removeEventListener("mousedown", onOutside);
  }, [open]);

  const close = () => {
    setOpen(false);
    setFilterText(null);
  };

  const select = (o) => {
    onChange(o.value);
    close();
  };

  const handleFocus = () => {
    setOpen(true);
    setFilterText(null);
    setHighlight(0);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setFilterText(null);
        return;
      }
      setHighlight((h) => {
        const next = e.key === "ArrowDown" ? h + 1 : h - 1;
        if (filtered.length === 0) return 0;
        return Math.max(0, Math.min(filtered.length - 1, next));
      });
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        if (filtered[highlight]) select(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          autoComplete="off"
          value={open && filterText != null ? filterText : selected ? selected.label : ""}
          placeholder={selected ? selected.label : placeholder || searchPlaceholder}
          onFocus={handleFocus}
          onChange={(e) => {
            setFilterText(e.target.value);
            setHighlight(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full glass-input pr-9 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        />
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-[#242b3d] shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">{emptyMessage}</div>
            ) : (
              filtered.map((o, i) => (
                <button
                  type="button"
                  key={o.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => select(o)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition ${
                    i === highlight
                      ? "font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
