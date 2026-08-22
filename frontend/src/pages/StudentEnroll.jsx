import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { studentApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import BulkImportSheet, { kbdCls } from "../components/ui/BulkImportSheet";
import { useDepartments } from "../hooks/useMeta";
import { UserPlus } from "lucide-react";

const emptyForm = { studentId: "", name: "", department: "", batch: "", section: "", email: "", phone: "" };

const COLUMNS = [
  { key: "studentId", label: "Student ID", required: true, mono: true },
  { key: "name", label: "Name", required: true },
  { key: "department", label: "Department", required: true, listId: "bulk-dept-options", width: "w-28" },
  { key: "batch", label: "Batch", required: true, width: "w-20" },
  { key: "section", label: "Section", required: true, width: "w-20" },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false, width: "w-36" },
];

// Header-name -> key map used when parsing uploaded CSV files
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
    },
    onError: (err) => toast.error(err.response?.data?.message || "Bulk import failed"),
  });

  // Auto-fill a row created by pressing Enter: increment the last roll ID and
  // copy department / batch / section from the top row.
  const growRow = (next, nextRow) => {
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
  };

  const handleSingleSubmit = (e) => {
    e.preventDefault();
    if (!form.department.trim()) {
      toast.error("Department is required");
      return;
    }
    singleMutation.mutate(form);
  };

  const tabBtnCls = (active) =>
    `px-5 py-2.5 rounded-xl text-xs font-semibold transition ${
      active
        ? "bg-slate-700 text-white shadow-md shadow-slate-600/25 dark:bg-white/10 dark:text-white"
        : "text-slate-500 dark:text-slate-300 hover:bg-slate-500/10 hover:text-slate-800 dark:hover:text-white"
    }`;

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
        <button onClick={() => setTab("single")} className={tabBtnCls(tab === "single")}>
          Single Student Enrollment
        </button>
        <button onClick={() => setTab("bulk")} className={tabBtnCls(tab === "bulk")}>
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
        <BulkImportSheet
          columns={COLUMNS}
          emptyForm={emptyForm}
          aliases={KEY_ALIASES}
          entity="student"
          duplicateKey="studentId"
          duplicateLabel="Student ID"
          dataLists={[{ id: "bulk-dept-options", options: departments }]}
          growRow={growRow}
          invalidHint="studentId, name, department, batch, section are required"
          headerNote={
            <>
              Upload a .csv file, type directly, or paste rows from Excel / CSV. Press{" "}
              <kbd className={kbdCls}>Enter</kbd> to move to the next row — it auto-fills the next roll ID
              (increments the top row's ID by one) and copies department, batch, section from the top row. Drag
              across cells or <kbd className={kbdCls}>Shift</kbd> + <kbd className={kbdCls}>Arrows</kbd> to select
              a range, then press <kbd className={kbdCls}>Del</kbd> to clear it.
            </>
          }
          footerNote={
            <>Rows grow automatically as you type. Duplicate Student IDs are highlighted red and blocked on import.</>
          }
          onImport={(rows) => bulkMutation.mutateAsync(rows)}
          isPending={bulkMutation.isPending}
        />
      )}
    </div>
  );
}
