import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { adminApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import { useDepartments } from "../hooks/useMeta";
import { UserPlus, UserCheck, FileSpreadsheet } from "lucide-react";

const emptyForm = { name: "", email: "", password: "", department: "", designation: "" };

const DESIGNATIONS = ["Department Head", "Professor", "Associate Professor", "Assistant Professor", "Lecturer"];

const COLUMNS = [
  { key: "name", label: "Full Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "password", label: "Password", required: true },
  { key: "department", label: "Department", required: true },
  { key: "designation", label: "Designation", required: false },
];

const createRows = (n) => Array.from({ length: n }, () => ({ ...emptyForm }));

const copyMetaFrom = (list) => {
  const top = list[0] || emptyForm;
  return {
    department: top.department || "",
    designation: top.designation || "",
  };
};

export default function TeacherEnroll() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const departments = useDepartments();
  const [tab, setTab] = useState("single");
  const [form, setForm] = useState(emptyForm);

  const [rows, setRows] = useState(() => createRows(5));
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const [invalidRows, setInvalidRows] = useState(new Set());
  const cellRefs = useRef({});
  const shouldSelect = useRef(false);

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });

  const singleMutation = useMutation({
    mutationFn: (payload) => adminApi.createTeacher(payload),
    onSuccess: () => {
      toast.success("Teacher enrolled successfully!");
      setForm(emptyForm);
      invalidateList();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to enroll teacher");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (teachers) => adminApi.bulkTeachers(teachers),
    onSuccess: (res) => {
      const { inserted, skipped } = res.data || {};
      toast.success(
        `Bulk import completed: ${inserted} teacher${inserted === 1 ? "" : "s"} imported${
          skipped ? ` · ${skipped} skipped (duplicate email)` : ""
        }`
      );
      setRows(createRows(5));
      setInvalidRows(new Set());
      shouldSelect.current = false;
      setFocus({ row: 0, col: 0 });
      invalidateList();
    },
    onError: (err) => toast.error(err.response?.data?.message || "Bulk import failed"),
  });

  // Keep programmatic focus in sync with the focus state (Enter / arrows / paste).
  useEffect(() => {
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
    setRows((prev) => [...prev, { ...emptyForm, ...copyMetaFrom(prev) }]);
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
    shouldSelect.current = true;
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      while (next.length <= nextRow) next.push({ ...emptyForm, ...copyMetaFrom(next) });
      next[nextRow].department = next[0].department || "";
      if (!next[nextRow].designation) next[nextRow].designation = next[0].designation || "";
      return next;
    });
    setFocus({ row: nextRow, col: 0 });
  };

  const handleKeyDown = (e, r, c) => {
    const el = e.target;
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      goNextRow(r);
    } else if (e.key === "ArrowDown") {
      if (!el.value || el.selectionStart === el.value.length) {
        e.preventDefault();
        const nextRow = r + 1;
        if (nextRow >= rows.length) appendRow();
        shouldSelect.current = true;
        setFocus({ row: nextRow, col: c });
      }
    } else if (e.key === "ArrowUp") {
      if (!el.value || el.selectionStart === 0) {
        e.preventDefault();
        if (r > 0) {
          shouldSelect.current = true;
          setFocus({ row: r - 1, col: c });
        }
      }
    } else if (e.key === "ArrowRight") {
      if (el.selectionStart === el.value.length) {
        e.preventDefault();
        shouldSelect.current = true;
        setFocus({ row: r, col: Math.min(c + 1, COLUMNS.length - 1) });
      }
    } else if (e.key === "ArrowLeft") {
      if (el.selectionStart === 0) {
        e.preventDefault();
        shouldSelect.current = true;
        setFocus({ row: r, col: Math.max(c - 1, 0) });
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
    const hasHeader =
      firstCells.length >= 4 && firstCells.slice(0, 4).every((x) => headerKeys.has(x));
    const startFrom = hasHeader ? 1 : 0;

    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      for (let i = startFrom; i < lines.length; i++) {
        const cells = lines[i].split(/[,\t]/).map((x) => x.trim());
        const targetRow = r + (i - startFrom);
        while (targetRow >= next.length) {
          next.push({ ...emptyForm, ...copyMetaFrom(next) });
        }
        cells.forEach((cell, ci) => {
          const col = c + ci;
          if (col < COLUMNS.length) next[targetRow][COLUMNS[col].key] = cell;
        });
      }
      return next;
    });

    shouldSelect.current = false;
    setFocus({ row: r, col: c });
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
        const shortPass = (row.password || "").trim().length > 0 && (row.password || "").trim().length < 8;
        if (missing || shortPass) bad.add(idx);
      }
    });

    setInvalidRows(bad);
    if (filledCount === 0) {
      toast.error("Add at least one teacher row before importing");
      return;
    }
    if (bad.size > 0) {
      toast.error("Fix highlighted rows — code, name, email, password (8+ chars), department are required");
      return;
    }

    const teachers = rows
      .filter((row) => COLUMNS.some((c) => (row[c.key] || "").trim() !== ""))
      .map((row) => {
        const o = {};
        COLUMNS.forEach((c) => (o[c.key] = (row[c.key] || "").trim()));
        return o;
      });

    bulkMutation.mutate(teachers);
  };

  const rowHasData = (row) => COLUMNS.some((c) => (row[c.key] || "").trim() !== "");
  const filledCount = rows.filter(rowHasData).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserPlus className="h-7 w-7 text-slate-600" />
            Teacher Enrollment Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            Create faculty accounts with a short code (e.g. AKP). Teachers sign in using email and password.
          </p>
        </div>

        <button
          onClick={() => navigate("/admin/teachers")}
          className="glass-btn-secondary text-xs self-start sm:self-auto"
        >
          <UserCheck className="h-4 w-4" />
          <span>Browse Faculty List</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={() => setTab("single")}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition ${
            tab === "single"
              ? "border-slate-500 text-slate-500 dark:text-slate-300"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Single Teacher Enrollment
        </button>
        <button
          onClick={() => setTab("bulk")}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition ${
            tab === "bulk"
              ? "border-slate-500 text-slate-500 dark:text-slate-300"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Alan Turing"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="glass-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                    Designation
                  </label>
                  <select
                    required
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className="glass-input"
                  >
                    <option value="" disabled>Select designation</option>
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="teacher@university.edu"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

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

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={singleMutation.isPending}
                className="glass-btn-primary px-8 py-3"
              >
                {singleMutation.isPending ? "Enrolling..." : "Enroll Teacher"}
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
                Type directly or paste rows from Excel / CSV. Press{" "}
                <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono bg-slate-100 dark:bg-slate-600">Enter</kbd>{" "}
                to move to the next row — it copies department and designation from the top row.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="px-3 py-1 rounded-full bg-slate-500/10 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-400/25 dark:border-white/20">
                {filledCount} ready
              </span>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-44" />
                  <col className="w-52" />
                  <col className="w-36" />
                  <col className="w-24" />
                  <col className="w-40" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-700/80" />
                    {COLUMNS.map((c, i) => (
                      <th
                        key={c.key}
                        className={`px-2.5 py-1.5 text-left border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-700/80 transition-colors ${
                          focus.col === i ? "!bg-slate-500/10 dark:!bg-white/15" : ""
                        }`}
                      >
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-300 font-mono">
                          {String.fromCharCode(65 + i)}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {c.label}
                          {c.required && <span className="text-slate-500">{"\u00A0*"}</span>}
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
                          className={`sticky left-0 z-10 text-center text-[11px] font-mono select-none border border-slate-200/90 dark:border-slate-800 ${
                            isActiveRow
                              ? "bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-white"
                              : "bg-slate-100/70 dark:bg-slate-700 text-slate-400 dark:text-slate-300"
                          }`}
                        >
                          {r + 1}
                        </td>
                        {COLUMNS.map((c, ci) => {
                          const active = isActiveRow && focus.col === ci;
                          const valid = !invalidRows.has(r);
                          return (
                            <td
                              key={c.key}
                              className={`relative border border-slate-200/90 dark:border-slate-800 p-0 ${
                                active ? "ring-2 ring-inset ring-slate-600 dark:ring-white bg-[#0f172a]/5 z-[5]" : ""
                              } ${!valid ? "bg-slate-500/10" : ""}`}
                            >
                              <input
                                ref={(el) => (cellRefs.current[`r${r}c${ci}`] = el)}
                                type={c.key === "password" ? "text" : "text"}
                                list={
                                  c.key === "department"
                                    ? "bulk-teacher-dept-options"
                                    : c.key === "designation"
                                      ? "designation-options"
                                      : undefined
                                }
                                value={row[c.key]}
                                onChange={(e) => handleCellChange(r, ci, e.target.value)}
                                onFocus={() => setFocus({ row: r, col: ci })}
                                onKeyDown={(e) => handleKeyDown(e, r, ci)}
                                onPaste={(e) => handlePaste(e, r, ci)}
                                aria-label={`row ${r + 1} ${c.label}`}
                                className={`w-full bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-sans ${
                                  !valid ? "text-slate-500 dark:text-slate-300" : ""
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

          <datalist id="bulk-teacher-dept-options">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <datalist id="designation-options">
            {DESIGNATIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 dark:text-slate-300">
              Rows grow automatically as you type. <span className="font-mono">A</span>–<span className="font-mono">E</span> columns = name, email, password, department, designation.
            </p>
            <button
              onClick={handleBulkSubmit}
              disabled={bulkMutation.isPending}
              className="glass-btn-primary px-8 py-3 shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {bulkMutation.isPending ? "Importing..." : "Import Teachers"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
