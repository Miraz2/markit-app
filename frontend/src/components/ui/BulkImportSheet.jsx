import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FileSpreadsheet, Upload } from "lucide-react";

// Split a CSV line into cells, honoring double-quoted fields
const parseCSVLine = (line) => {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
};

const kbdCls =
  "px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono bg-slate-100 dark:bg-slate-600";

/**
 * Reusable spreadsheet-style bulk import grid.
 *
 * Props:
 * - columns: [{ key, label, required?, mono?, width?, listId? }]
 * - emptyForm: template object for a blank row
 * - aliases: header-name -> key map used when parsing uploaded CSV files
 * - entity: noun used in toast messages ("student", "teacher", …)
 * - duplicateKey / duplicateLabel: optional in-sheet uniqueness check
 * - dataLists: [{ id, options }] rendered as <datalist> for column listId refs
 * - growRow(nextRows, idx): optional hook to auto-fill a row created via Enter
 * - extraInvalid(row): optional per-row validation returning true when invalid
 * - invalidHint: text shown when highlighted rows must be fixed
 * - headerNote: description shown under "Spreadsheet Import"
 * - footerNote: small text shown bottom-left of the sheet
 * - onImport: async (filledRows) => resolves on success / rejects on failure;
 *   the sheet resets itself after a successful import.
 * - isPending: disables the import button while true
 */
export default function BulkImportSheet({
  columns,
  emptyForm,
  aliases = {},
  entity = "row",
  duplicateKey,
  duplicateLabel,
  dataLists = [],
  growRow,
  extraInvalid,
  invalidHint,
  headerNote,
  footerNote,
  onImport,
  isPending,
}) {
  const createRows = (n) => Array.from({ length: n }, () => ({ ...emptyForm }));

  const [rows, setRows] = useState(() => createRows(5));
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const [anchor, setAnchor] = useState({ row: 0, col: 0 });
  const [dragging, setDragging] = useState(false);
  const [invalidRows, setInvalidRows] = useState(new Set());
  const cellRefs = useRef({});
  const shouldSelect = useRef(false);
  const wrapperRef = useRef(null);
  const pendingEdit = useRef(false);
  const fileInputRef = useRef(null);

  // Highlighted rectangle (anchor .. focus), like a spreadsheet range.
  const sel = {
    r1: Math.min(anchor.row, focus.row),
    r2: Math.max(anchor.row, focus.row),
    c1: Math.min(anchor.col, focus.col),
    c2: Math.max(anchor.col, focus.col),
  };
  const hasMultiSelection = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;

  // Row indexes whose duplicateKey value collides with another row's.
  const duplicateRows = (() => {
    if (!duplicateKey) return new Set();
    const counts = new Map();
    rows.forEach((row) => {
      const id = (row[duplicateKey] || "").trim();
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });
    return new Set(
      rows.reduce((acc, row, idx) => {
        if ((counts.get((row[duplicateKey] || "").trim()) || 0) > 1) acc.push(idx);
        return acc;
      }, [])
    );
  })();

  const setCursor = (row, col) => {
    setAnchor({ row, col });
    setFocus({ row, col });
  };

  // Focus the input only when edit mode was explicitly requested
  // (typing on a selected cell / double-click / Enter). Plain clicks stay in nav mode.
  useEffect(() => {
    if (!pendingEdit.current) return;
    pendingEdit.current = false;
    const el = cellRefs.current[`r${focus.row}c${focus.col}`];
    if (el && document.activeElement !== el) {
      el.focus();
      if (shouldSelect.current) {
        el.select();
        shouldSelect.current = false;
      }
    }
  }, [focus]);

  const appendRow = () => setRows((prev) => [...prev, { ...emptyForm }]);

  const updateCell = (r, c, value) => {
    const key = columns[c].key;
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      next[r][key] = value;
      return next;
    });
    if (invalidRows.has(r)) {
      setInvalidRows((prev) => {
        const next = new Set(prev);
        next.delete(r);
        return next;
      });
    }
  };

  const clearSelected = () => {
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      for (let r = sel.r1; r <= Math.min(sel.r2, next.length - 1); r++) {
        for (let c = sel.c1; c <= sel.c2; c++) next[r][columns[c].key] = "";
      }
      return next;
    });
    setInvalidRows((prev) => {
      const next = new Set(prev);
      for (let r = sel.r1; r <= sel.r2; r++) next.delete(r);
      return next;
    });
  };

  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, [dragging]);

  // Move DOM focus to the grid wrapper so nav-mode keys (arrows / typing / Del / Ctrl+C) work.
  const focusGrid = () => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== wrapperRef.current) {
      document.activeElement.blur();
    }
    wrapperRef.current?.focus();
  };

  // Enter edit mode on a cell. With initialKey, the value is overwritten by that key.
  const startEditing = (r, c, initialKey) => {
    if (initialKey !== undefined) updateCell(r, c, initialKey);
    shouldSelect.current = false;
    setFocus({ row: r, col: c });
    requestAnimationFrame(() => {
      const el = cellRefs.current[`r${r}c${c}`];
      if (!el) return;
      el.focus();
      const len = (el.value || "").length;
      el.setSelectionRange(len, len);
    });
  };

  const handleCellMouseDown = (e, r, c) => {
    if (e.button !== 0) return;
    // Clicking inside the cell that is currently being edited: keep focus
    // and let the browser move the text caret to the clicked position.
    if (document.activeElement === e.target && focus.row === r && focus.col === c) return;
    e.preventDefault(); // single click only selects; no caret placement
    focusGrid();
    if (e.shiftKey) {
      setFocus({ row: r, col: c });
    } else {
      setAnchor({ row: r, col: c });
      setFocus({ row: r, col: c });
      setDragging(true);
    }
  };

  const handleCellMouseEnter = (r, c) => {
    if (dragging) setFocus({ row: r, col: c });
  };

  const handleCellDoubleClick = (r, c) => startEditing(r, c);

  const handleRowLabelMouseDown = (e, r) => {
    if (e.button !== 0 || e.shiftKey) return;
    e.preventDefault();
    focusGrid();
    setAnchor({ row: r, col: 0 });
    setFocus({ row: r, col: columns.length - 1 });
  };

  const handleColLabelMouseDown = (e, c) => {
    if (e.button !== 0 || e.shiftKey) return;
    e.preventDefault();
    focusGrid();
    setAnchor({ row: 0, col: c });
    setFocus({ row: rows.length - 1, col: c });
  };

  // Navigation mode (cell selected but not focused): arrows move, typing overwrites,
  // Delete clears, Ctrl+C copies the selection, double-click / Enter enters edit mode.
  const handleGridKeyDown = (e) => {
    if (e.target.tagName === "INPUT") return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      copySelectedRange();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (hasMultiSelection) clearSelected();
      else updateCell(focus.row, focus.col, "");
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      goNextRow(focus.row);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      let nc = e.shiftKey ? focus.col - 1 : focus.col + 1;
      let nr = focus.row;
      if (nc >= columns.length) {
        nc = 0;
        nr += 1;
      }
      if (nc < 0) {
        nc = columns.length - 1;
        nr -= 1;
      }
      if (nr >= 0 && nr < rows.length) {
        shouldSelect.current = true;
        setCursor(nr, nc);
      }
      return;
    }

    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      let row = focus.row;
      let col = focus.col;
      if (e.shiftKey) {
        if (e.key === "ArrowDown") row = Math.min(row + 1, rows.length - 1);
        else if (e.key === "ArrowUp") row = Math.max(row - 1, 0);
        else if (e.key === "ArrowLeft") col = Math.max(col - 1, 0);
        else col = Math.min(col + 1, columns.length - 1);
        shouldSelect.current = true;
        setFocus({ row, col });
      } else {
        if (e.key === "ArrowDown") {
          row += 1;
          if (row >= rows.length) appendRow();
        } else if (e.key === "ArrowUp") row = Math.max(row - 1, 0);
        else if (e.key === "ArrowLeft") col = Math.max(col - 1, 0);
        else col = Math.min(col + 1, columns.length - 1);
        shouldSelect.current = true;
        setCursor(row, col);
      }
      return;
    }

    if (e.key === "Escape") {
      setAnchor({ ...focus });
      return;
    }

    // Any printable key starts editing and overwrites the cell with that character.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      startEditing(focus.row, focus.col, e.key);
    }
  };

  const copySelectedRange = () => {
    const text = rows
      .slice(sel.r1, sel.r2 + 1)
      .map((row) =>
        columns
          .slice(sel.c1, sel.c2 + 1)
          .map((c) => row[c.key] || "")
          .join("\t")
      )
      .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const handleCellChange = (r, c, value) => {
    updateCell(r, c, value);
    // Grow the sheet when the last row starts holding data.
    if (r === rows.length - 1) {
      const rowAfter = { ...rows[r], [columns[c].key]: value };
      const filled = columns.some((col) => (rowAfter[col.key] || "").trim() !== "");
      if (filled) appendRow();
    }
  };

  const goNextRow = (r) => {
    const nextRow = r + 1;
    pendingEdit.current = true;
    shouldSelect.current = true;
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      while (next.length <= nextRow) next.push({ ...emptyForm });
      growRow?.(next, nextRow);
      return next;
    });
    setCursor(nextRow, 0);
  };

  const handleKeyDown = (e, r, c) => {
    const el = e.target;
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      goNextRow(r);
    } else if (e.key === "Tab") {
      let nc = e.shiftKey ? c - 1 : c + 1;
      let nr = r;
      if (nc >= columns.length) {
        nc = 0;
        nr += 1;
      }
      if (nc < 0) {
        nc = columns.length - 1;
        nr -= 1;
      }
      if (nr >= 0 && nr < rows.length) {
        e.preventDefault();
        shouldSelect.current = true;
        setCursor(nr, nc);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      el.blur();
      focusGrid();
      setAnchor({ row: r, col: c });
      setFocus({ row: r, col: c });
    } else if (e.key === "ArrowDown") {
      if (e.shiftKey) {
        e.preventDefault();
        shouldSelect.current = true;
        setFocus({ row: Math.min(r + 1, rows.length - 1), col: c });
      } else if (!el.value || el.selectionStart === el.value.length) {
        e.preventDefault();
        const nextRow = r + 1;
        if (nextRow >= rows.length) appendRow();
        shouldSelect.current = true;
        setCursor(nextRow, c);
      }
    } else if (e.key === "ArrowUp") {
      if (e.shiftKey) {
        e.preventDefault();
        shouldSelect.current = true;
        setFocus({ row: Math.max(r - 1, 0), col: c });
      } else if (!el.value || el.selectionStart === 0) {
        e.preventDefault();
        if (r > 0) {
          shouldSelect.current = true;
          setCursor(r - 1, c);
        }
      }
    } else if (e.key === "ArrowRight") {
      if (e.shiftKey) {
        e.preventDefault();
        shouldSelect.current = true;
        setFocus({ row: r, col: Math.min(c + 1, columns.length - 1) });
      } else if (el.selectionStart === el.value.length) {
        e.preventDefault();
        shouldSelect.current = true;
        setCursor(r, Math.min(c + 1, columns.length - 1));
      }
    } else if (e.key === "ArrowLeft") {
      if (e.shiftKey) {
        e.preventDefault();
        shouldSelect.current = true;
        setFocus({ row: r, col: Math.max(c - 1, 0) });
      } else if (el.selectionStart === 0) {
        e.preventDefault();
        shouldSelect.current = true;
        setCursor(r, Math.max(c - 1, 0));
      }
    }
  };

  const handlePaste = (e, r, c) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!text) return;
    e.preventDefault();

    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");

    if (lines.length === 1) {
      const cells = lines[0].split(/[,\t]/).map((x) => x.trim());
      if (cells.length > 1) {
        setRows((prev) => {
          const next = prev.map((row) => ({ ...row }));
          cells.forEach((cell, ci) => {
            const col = c + ci;
            if (col < columns.length) next[r][columns[col].key] = cell;
          });
          return next;
        });
      } else {
        updateCell(r, c, cells[0] || "");
      }
      return;
    }

    // Multi-row CSV paste. Detect & skip a header line.
    const headerKeys = new Set(columns.map((col) => col.key.toLowerCase()));
    const firstCells = lines[0].split(/[,\t]/).map((x) => x.trim().toLowerCase());
    const hasHeader =
      firstCells.length >= 4 && firstCells.slice(0, 4).every((x) => headerKeys.has(x));
    const startFrom = hasHeader ? 1 : 0;

    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      for (let i = startFrom; i < lines.length; i++) {
        const cells = lines[i].split(/[,\t]/).map((x) => x.trim());
        const targetRow = r + (i - startFrom);
        while (targetRow >= next.length) next.push({ ...emptyForm });
        cells.forEach((cell, ci) => {
          const col = c + ci;
          if (col < columns.length) next[targetRow][columns[col].key] = cell;
        });
      }
      return next;
    });

    shouldSelect.current = false;
    setCursor(r, c);
  };

  const resetSheet = () => {
    setRows(createRows(5));
    setInvalidRows(new Set());
    shouldSelect.current = false;
    pendingEdit.current = false;
    setCursor(0, 0);
  };

  const handleImportClick = async () => {
    const bad = new Set();
    let filledCount = 0;
    rows.forEach((row, idx) => {
      const hasAny = columns.some((c) => (row[c.key] || "").trim() !== "");
      if (hasAny) {
        filledCount += 1;
        const missing = columns.some((c) => c.required && !(row[c.key] || "").trim());
        if (missing || extraInvalid?.(row)) bad.add(idx);
      }
    });

    setInvalidRows(bad);
    if (filledCount === 0) {
      toast.error(`Add at least one ${entity} row before importing`);
      return;
    }
    if (bad.size > 0) {
      toast.error(`Fix highlighted rows — ${invalidHint}`);
      return;
    }
    if (duplicateRows.size > 0) {
      const ids = [
        ...new Set(
          rows
            .filter((_, idx) => duplicateRows.has(idx))
            .map((row) => (row[duplicateKey] || "").trim())
        ),
      ];
      toast.error(
        `Duplicate ${duplicateLabel}${ids.length > 1 ? "s" : ""}: ${ids.slice(0, 4).join(", ")}${
          ids.length > 4 ? ", …" : ""
        } — each ${entity} needs a unique value`
      );
      return;
    }

    const payload = rows
      .filter((row) => columns.some((c) => (row[c.key] || "").trim() !== ""))
      .map((row) => {
        const o = {};
        columns.forEach((c) => (o[c.key] = (row[c.key] || "").trim()));
        return o;
      });

    try {
      await onImport(payload);
      resetSheet();
    } catch {
      /* failure toast is handled by the parent */
    }
  };

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result || "")
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) {
          toast.error("CSV file is empty");
          return;
        }

        // Detect a header row and map its column names; otherwise assume column order
        let dataLines = lines;
        let keyMap = null;
        const firstCells = parseCSVLine(lines[0]).map((c) => c.toLowerCase().replace(/[^a-z]/g, ""));
        const headerKeys = firstCells.map((c) => aliases[c] || null);
        if (headerKeys.filter(Boolean).length >= 2) {
          dataLines = lines.slice(1);
          keyMap = headerKeys;
        }

        const parsed = [];
        dataLines.forEach((line) => {
          const cells = parseCSVLine(line);
          const row = { ...emptyForm };
          cells.forEach((cell, i) => {
            const key = keyMap ? keyMap[i] : columns[i]?.key;
            if (key) row[key] = cell;
          });
          if (columns.some((c) => (row[c.key] || "").trim() !== "")) parsed.push(row);
        });

        if (parsed.length === 0) {
          toast.error(`No ${entity} rows found in the CSV`);
          return;
        }

        setRows([...parsed, { ...emptyForm }]);
        setInvalidRows(new Set());
        shouldSelect.current = false;
        setCursor(0, 0);
        toast.success(`Loaded ${parsed.length} row${parsed.length === 1 ? "" : "s"} from CSV`);
      } catch {
        toast.error("Failed to read the CSV file");
      } finally {
        e.target.value = "";
      }
    };
    reader.onerror = () => toast.error("Failed to read the CSV file");
    reader.readAsText(file);
  };

  const rowHasData = (row) => columns.some((c) => (row[c.key] || "").trim() !== "");
  const filledCount = rows.filter(rowHasData).length;

  return (
    <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-600" />
            Spreadsheet Import
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-1 max-w-3xl">{headerNote}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={handleCsvFile}
          />
          <button onClick={() => fileInputRef.current?.click()} className="glass-btn-secondary text-xs">
            <Upload className="h-4 w-4" />
            <span>Upload CSV</span>
          </button>
          <span className="px-3 py-1 rounded-full bg-slate-500/10 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-400/25 dark:border-white/20 text-[11px] font-bold">
            {filledCount} ready
          </span>
          {duplicateRows.size > 0 && (
            <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-[11px] font-bold">
              {duplicateRows.size} duplicate {duplicateLabel}
              {duplicateRows.size > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div
        ref={wrapperRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        className="rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm outline-none"
      >
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              <col className="w-10" />
              {columns.map((c) => (
                <col key={c.key} className={c.width || "w-44"} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-700 shadow-[inset_0_-1px_0_0_#cbd5e1] dark:shadow-[inset_0_-1px_0_0_#334155]" />
                {columns.map((c, i) => (
                  <th
                    key={c.key}
                    onMouseDown={(e) => handleColLabelMouseDown(e, i)}
                    className={`sticky top-0 z-20 px-2.5 py-3 text-center border border-slate-200/90 dark:border-slate-800 cursor-pointer select-none shadow-[inset_0_-1px_0_0_#cbd5e1] dark:shadow-[inset_0_-1px_0_0_#334155] ${
                      focus.col === i ? "bg-slate-300 dark:bg-slate-600" : "bg-slate-100 dark:bg-slate-700"
                    }`}
                  >
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 font-mono">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {c.label}
                        {c.required && <span className="text-slate-500">{"\u00A0*"}</span>}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => {
                const isActiveRow = focus.row === r;
                return (
                  <tr
                    key={r}
                    className={r % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-500/30" : "bg-white dark:bg-transparent"}
                  >
                    <td
                      onMouseDown={(e) => handleRowLabelMouseDown(e, r)}
                      className={`sticky left-0 z-10 text-center text-[11px] font-mono text-slate-400 dark:text-slate-300 select-none cursor-pointer border border-slate-200/90 dark:border-slate-800 ${
                        isActiveRow
                          ? "bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-white"
                          : "bg-slate-100 dark:bg-slate-600"
                      }`}
                    >
                      {r + 1}
                    </td>
                    {columns.map((c, ci) => {
                      const active = isActiveRow && focus.col === ci;
                      const valid = !invalidRows.has(r);
                      const inSel = r >= sel.r1 && r <= sel.r2 && ci >= sel.c1 && ci <= sel.c2;
                      const dupCell = !!duplicateKey && c.key === duplicateKey && duplicateRows.has(r);
                      const cellBg = dupCell
                        ? "bg-red-500/20 dark:bg-red-500/25"
                        : !valid
                          ? "bg-slate-500/10"
                          : inSel && hasMultiSelection && !active
                            ? "bg-blue-500/15 dark:bg-blue-500/25"
                            : "";
                      const tdBorder =
                        inSel || active
                          ? "border-blue-500/40 dark:border-blue-400/30"
                          : "border-slate-200/90 dark:border-slate-800";
                      return (
                        <td
                          key={c.key}
                          onMouseDown={(e) => handleCellMouseDown(e, r, ci)}
                          onMouseEnter={() => handleCellMouseEnter(r, ci)}
                          onDoubleClick={() => handleCellDoubleClick(r, ci)}
                          className={`relative border ${tdBorder} p-0 ${cellBg} ${
                            active ? "ring-2 ring-inset ring-blue-600 dark:ring-blue-300 z-[5]" : ""
                          }`}
                        >
                          <input
                            ref={(el) => (cellRefs.current[`r${r}c${ci}`] = el)}
                            type="text"
                            list={c.listId || undefined}
                            value={row[c.key]}
                            onChange={(e) => handleCellChange(r, ci, e.target.value)}
                            onFocus={() => setFocus({ row: r, col: ci })}
                            onKeyDown={(e) => handleKeyDown(e, r, ci)}
                            onPaste={(e) => handlePaste(e, r, ci)}
                            aria-label={`row ${r + 1} ${c.label}`}
                            className={`w-full bg-transparent px-2.5 py-2 text-xs outline-none cursor-cell focus:cursor-text placeholder:text-slate-300 dark:placeholder:text-slate-600 ${
                              c.mono ? "font-mono font-semibold" : "font-sans"
                            } ${!valid ? "text-slate-500 dark:text-slate-300" : ""} ${
                              dupCell ? "text-red-600 dark:text-red-300" : ""
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {dataLists.map(({ id, options }) => (
        <datalist key={id} id={id}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ))}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400 dark:text-slate-300">{footerNote}</p>
        <button
          onClick={handleImportClick}
          disabled={isPending}
          className="glass-btn-primary px-8 py-3 shrink-0"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isPending ? "Importing..." : `Import ${entity.charAt(0).toUpperCase()}${entity.slice(1)}s`}
        </button>
      </div>
    </div>
  );
}

export { parseCSVLine, kbdCls };
