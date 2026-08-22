import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { studentApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import { useDepartments } from "../hooks/useMeta";
import { UserPlus, FileSpreadsheet, Upload } from "lucide-react";

const emptyForm = { studentId: "", name: "", department: "", batch: "", section: "", email: "", phone: "" };

const COLUMNS = [
  { key: "studentId", label: "Student ID", required: true },
  { key: "name", label: "Name", required: true },
  { key: "department", label: "Department", required: true },
  { key: "batch", label: "Batch", required: true },
  { key: "section", label: "Section", required: true },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
];

const createRows = (n) => Array.from({ length: n }, () => ({ ...emptyForm }));

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

const KEY_ALIASES = {
  studentid: "studentId",
  student: "studentId",
  roll: "studentId",
  id: "studentId",
  name: "name",
  department: "department",
  dept: "department",
  batch: "batch",
  section: "section",
  email: "email",
  phone: "phone",
};

const incrementId = (id) => {
  const s = String(id ?? "").trim();
  if (!/^\d+$/.test(s)) return "";
  const core = s.replace(/^0+/, "");
  const leadingZeros = s.length - core.length;
  const n = (core ? BigInt(core) : 0n) + 1n;
  let out = n.toString();
  if (leadingZeros > 0 && out.length <= s.length) out = out.padStart(s.length, "0");
  return out;
};

export default function StudentEnroll() {
  const departments = useDepartments();
  const [tab, setTab] = useState("single");
  const [form, setForm] = useState(emptyForm);

  const [rows, setRows] = useState(() => createRows(5));
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const [anchor, setAnchor] = useState({ row: 0, col: 0 });
  const [dragging, setDragging] = useState(false);
  const [invalidRows, setInvalidRows] = useState(new Set());
  const cellRefs = useRef({});
  const shouldSelect = useRef(false);
  const wrapperRef = useRef(null);
  const pendingEdit = useRef(false);

  // Highlighted rectangle (anchor .. focus), like a spreadsheet range.
  const sel = {
    r1: Math.min(anchor.row, focus.row),
    r2: Math.max(anchor.row, focus.row),
    c1: Math.min(anchor.col, focus.col),
    c2: Math.max(anchor.col, focus.col),
  };
  const hasMultiSelection = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;

  // Row indexes whose studentId collides with another row's.
  const duplicateRows = (() => {
    const counts = new Map();
    rows.forEach((row) => {
      const id = (row.studentId || "").trim();
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });
    return new Set(
      rows.reduce((acc, row, idx) => {
        if ((counts.get((row.studentId || "").trim()) || 0) > 1) acc.push(idx);
        return acc;
      }, [])
    );
  })();

  const setCursor = (row, col) => {
    setAnchor({ row, col });
    setFocus({ row, col });
  };

  const singleMutation = useMutation({
    mutationFn: (payload) => studentApi.create(payload),
    onSuccess: () => {
      toast.success("Student enrolled successfully!");
      setForm(emptyForm);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to enroll student");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (students) => studentApi.bulk(students),
    onSuccess: (res) => {
      toast.success(`Bulk import completed: ${res.data.inserted} students imported`);
      setRows(createRows(5));
      setInvalidRows(new Set());
      shouldSelect.current = false;
      setCursor(0, 0);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Bulk import failed"),
  });

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

  const appendRow = () => {
    setRows((prev) => [...prev, { ...emptyForm }]);
  };

  const updateCell = (r, c, value) => {
    const key = COLUMNS[c].key;
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
        for (let c = sel.c1; c <= sel.c2; c++) next[r][COLUMNS[c].key] = "";
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

  const handleCellDoubleClick = (r, c) => {
    startEditing(r, c);
  };

  const handleRowLabelMouseDown = (e, r) => {
    if (e.button !== 0 || e.shiftKey) return;
    e.preventDefault();
    focusGrid();
    setAnchor({ row: r, col: 0 });
    setFocus({ row: r, col: COLUMNS.length - 1 });
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
      if (hasMultiSelection) {
        clearSelected();
      } else {
        updateCell(focus.row, focus.col, "");
      }
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
      if (nc >= COLUMNS.length) {
        nc = 0;
        nr += 1;
      }
      if (nc < 0) {
        nc = COLUMNS.length - 1;
        nr -= 1;
      }
      if (nr >= 0 && nr < rows.length) {
        shouldSelect.current = true;
        setCursor(nr, nc);
      }
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      let row = focus.row;
      let col = focus.col;
      if (e.shiftKey) {
        if (e.key === "ArrowDown") row = Math.min(row + 1, rows.length - 1);
        else if (e.key === "ArrowUp") row = Math.max(row - 1, 0);
        else if (e.key === "ArrowLeft") col = Math.max(col - 1, 0);
        else col = Math.min(col + 1, COLUMNS.length - 1);
        shouldSelect.current = true;
        setFocus({ row, col });
      } else {
        if (e.key === "ArrowDown") {
          row += 1;
          if (row >= rows.length) appendRow();
        } else if (e.key === "ArrowUp") row = Math.max(row - 1, 0);
        else if (e.key === "ArrowLeft") col = Math.max(col - 1, 0);
        else col = Math.min(col + 1, COLUMNS.length - 1);
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
        COLUMNS.slice(sel.c1, sel.c2 + 1)
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
      const rowAfter = { ...rows[r], [COLUMNS[c].key]: value };
      const filled = COLUMNS.some((col) => (rowAfter[col.key] || "").trim() !== "");
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
      const top = next[0] || emptyForm;
      let srcId = "";
      for (let i = nextRow - 1; i >= 0; i--) {
        if ((next[i].studentId || "").trim()) {
          srcId = next[i].studentId;
          break;
        }
      }
      if (!srcId) srcId = top.studentId || "";
      if (!(next[nextRow].studentId || "").trim()) {
        next[nextRow].studentId = incrementId(srcId);
      }
      next[nextRow].department = top.department || "";
      next[nextRow].batch = top.batch || "";
      next[nextRow].section = top.section || "";
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
      if (nc >= COLUMNS.length) {
        nc = 0;
        nr += 1;
      }
      if (nc < 0) {
        nc = COLUMNS.length - 1;
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
        setFocus({ row: r, col: Math.min(c + 1, COLUMNS.length - 1) });
      } else if (el.selectionStart === el.value.length) {
        e.preventDefault();
        shouldSelect.current = true;
        setCursor(r, Math.min(c + 1, COLUMNS.length - 1));
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
            if (col < COLUMNS.length) next[r][COLUMNS[col].key] = cell;
          });
          return next;
        });
      } else {
        updateCell(r, c, cells[0] || "");
      }
      return;
    }

    // Multi-row CSV paste. Detect & skip a header line.
    const headerKeys = new Set(COLUMNS.map((col) => col.key.toLowerCase()));
    const firstCells = lines[0].split(/[,\t]/).map((x) => x.trim().toLowerCase());
    const hasHeader = firstCells.length >= 5 && firstCells.slice(0, 5).every((x) => headerKeys.has(x));
    const startFrom = hasHeader ? 1 : 0;

    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      for (let i = startFrom; i < lines.length; i++) {
        const cells = lines[i].split(/[,\t]/).map((x) => x.trim());
        const targetRow = r + (i - startFrom);
        while (targetRow >= next.length) next.push({ ...emptyForm });
        cells.forEach((cell, ci) => {
          const col = c + ci;
          if (col < COLUMNS.length) next[targetRow][COLUMNS[col].key] = cell;
        });
      }
      return next;
    });

    shouldSelect.current = false;
    setCursor(r, c);
  };

  const handleSingleSubmit = (e) => {
    e.preventDefault();
    if (!form.department.trim()) {
      toast.error("Department is required");
      return;
    }
    singleMutation.mutate(form);
  };

  const handleBulkSubmit = () => {
    const bad = new Set();
    let filledCount = 0;
    rows.forEach((row, idx) => {
      const hasAny = COLUMNS.some((c) => (row[c.key] || "").trim() !== "");
      if (hasAny) {
        filledCount += 1;
        const missing = COLUMNS.some((c) => c.required && !(row[c.key] || "").trim());
        if (missing) bad.add(idx);
      }
    });

    setInvalidRows(bad);
    if (filledCount === 0) {
      toast.error("Add at least one student row before importing");
      return;
    }
    if (bad.size > 0) {
      toast.error("Fix highlighted rows — studentId, name, department, batch, section are required");
      return;
    }
    if (duplicateRows.size > 0) {
      const ids = [
        ...new Set(
          rows
            .filter((_, idx) => duplicateRows.has(idx))
            .map((row) => (row.studentId || "").trim())
        ),
      ];
      toast.error(
        `Duplicate Student ID${ids.length > 1 ? "s" : ""}: ${ids.slice(0, 4).join(", ")}${
          ids.length > 4 ? ", …" : ""
        } — each student needs a unique ID`
      );
      return;
    }

    const students = rows
      .filter((row) => COLUMNS.some((c) => (row[c.key] || "").trim() !== ""))
      .map((row) => {
        const o = {};
        COLUMNS.forEach((c) => (o[c.key] = (row[c.key] || "").trim()));
        return o;
      });

    bulkMutation.mutate(students);
  };

  const rowHasData = (row) => COLUMNS.some((c) => (row[c.key] || "").trim() !== "");
  const filledCount = rows.filter(rowHasData).length;

  const fileInputRef = useRef(null);

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

        // Detect a header row and map its column names; otherwise assume A–G order
        let dataLines = lines;
        let keyMap = null;
        const firstCells = parseCSVLine(lines[0]).map((c) => c.toLowerCase().replace(/[^a-z]/g, ""));
        const headerKeys = firstCells.map((c) => KEY_ALIASES[c] || null);
        if (headerKeys.filter(Boolean).length >= 2) {
          dataLines = lines.slice(1);
          keyMap = headerKeys;
        }

        const parsed = [];
        dataLines.forEach((line) => {
          const cells = parseCSVLine(line);
          const row = { ...emptyForm };
          cells.forEach((cell, i) => {
            const key = keyMap ? keyMap[i] : COLUMNS[i]?.key;
            if (key) row[key] = cell;
          });
          if (COLUMNS.some((c) => (row[c.key] || "").trim() !== "")) parsed.push(row);
        });

        if (parsed.length === 0) {
          toast.error("No student rows found in the CSV");
          return;
        }

        setRows([...parsed, createRows(1)[0]]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserPlus className="h-7 w-7 text-slate-600" />
            Student Enrollment Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            Enroll students into department, batch, and section rosters (e.g. ID format 202411068030).
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("single")}
          className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition ${
            tab === "single"
              ? "bg-slate-700 text-white shadow-md shadow-slate-600/25 dark:bg-white/10 dark:text-white"
              : "text-slate-500 dark:text-slate-300 hover:bg-slate-500/10 hover:text-slate-800 dark:hover:text-white"
          }`}
        >
          Single Student Enrollment
        </button>
        <button
          onClick={() => setTab("bulk")}
          className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition ${
            tab === "bulk"
              ? "bg-slate-700 text-white shadow-md shadow-slate-600/25 dark:bg-white/10 dark:text-white"
              : "text-slate-500 dark:text-slate-300 hover:bg-slate-500/10 hover:text-slate-800 dark:hover:text-white"
          }`}
        >
          Bulk CSV Import
        </button>
      </div>

      {tab === "single" ? (
        <div className="glass-card p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-6">
          <form onSubmit={handleSingleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                  Student Roll / Registration ID (e.g. 202411068030)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 202411068030"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  className="glass-input font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                  Student Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Department</label>
                <SearchableSelect
                  value={form.department}
                  onChange={(v) => setForm({ ...form, department: v })}
                  options={departments.map((d) => ({ value: d, label: d }))}
                  placeholder="Select department"
                  searchPlaceholder="Search departments…"
                  emptyMessage="No departments found"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Batch</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 68"
                  value={form.batch}
                  onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Section</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A"
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="student@university.edu"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Phone Number (Optional)</label>
                <input
                  type="text"
                  placeholder="+8801700000000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={singleMutation.isPending}
                className="glass-btn-primary px-8 py-3"
              >
                {singleMutation.isPending ? "Enrolling..." : "Enroll Student"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-slate-600" />
                Spreadsheet Import
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">
                Upload a .csv file, type directly, or paste rows from Excel / CSV. Press{" "}
                <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono bg-slate-100 dark:bg-slate-600">Enter</kbd>{" "}
                to move to the next row — it auto-fills the next roll ID (increments the top row's ID by one) and copies department, batch, section from the top row. Drag across cells or{" "}
                <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono bg-slate-100 dark:bg-slate-600">Shift</kbd>
                {" + "}
                <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono bg-slate-100 dark:bg-slate-600">Arrows</kbd>{" "}
                to select a range, then press{" "}
                <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono bg-slate-100 dark:bg-slate-600">Del</kbd>{" "}
                to clear it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={handleCsvFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="glass-btn-secondary text-xs"
              >
                <Upload className="h-4 w-4" />
                <span>Upload CSV</span>
              </button>
              <span className="px-3 py-1 rounded-full bg-slate-500/10 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-400/25 dark:border-white/20 text-[11px] font-bold">
                {filledCount} ready
              </span>
              {duplicateRows.size > 0 && (
                <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-[11px] font-bold">
                  {duplicateRows.size} duplicate ID{duplicateRows.size > 1 ? "s" : ""}
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
                  <col className="w-44" />
                  <col className="w-44" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-44" />
                  <col className="w-36" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-30 border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-700 shadow-[inset_0_-1px_0_0_#cbd5e1] dark:shadow-[inset_0_-1px_0_0_#334155]" />
                    {COLUMNS.map((c, i) => (
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
                            isActiveRow ? "bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-white" : "bg-slate-100 dark:bg-slate-600"
                          }`}
                        >
                          {r + 1}
                        </td>
                        {COLUMNS.map((c, ci) => {
                          const active = isActiveRow && focus.col === ci;
                          const valid = !invalidRows.has(r);
                          const inSel = r >= sel.r1 && r <= sel.r2 && ci >= sel.c1 && ci <= sel.c2;
                          const dupCell = ci === 0 && duplicateRows.has(r);
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
                                list={c.key === "department" ? "bulk-dept-options" : undefined}
                                value={row[c.key]}
                                onChange={(e) => handleCellChange(r, ci, e.target.value)}
                                onFocus={() => setFocus({ row: r, col: ci })}
                                onKeyDown={(e) => handleKeyDown(e, r, ci)}
                                onPaste={(e) => handlePaste(e, r, ci)}
                                aria-label={`row ${r + 1} ${c.label}`}
                                 className={`w-full bg-transparent px-2.5 py-2 text-xs outline-none cursor-cell focus:cursor-text placeholder:text-slate-300 dark:placeholder:text-slate-600 ${
                                   ci === 0 ? "font-mono font-semibold" : "font-sans"
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

          <datalist id="bulk-dept-options">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 dark:text-slate-300">
              Rows grow automatically as you type. Duplicate Student IDs are highlighted red and blocked on import.
            </p>
            <button
              onClick={handleBulkSubmit}
              disabled={bulkMutation.isPending}
              className="glass-btn-primary px-8 py-3 shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {bulkMutation.isPending ? "Importing..." : "Import Students"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
