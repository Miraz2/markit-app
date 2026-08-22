import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { adminApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import BulkImportSheet, { kbdCls } from "../components/ui/BulkImportSheet";
import { useDepartments } from "../hooks/useMeta";
import { UserPlus } from "lucide-react";

const emptyForm = { name: "", email: "", password: "", department: "", designation: "" };

const DESIGNATIONS = ["Department Head", "Professor", "Associate Professor", "Assistant Professor", "Lecturer"];

const COLUMNS = [
  { key: "name", label: "Full Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "password", label: "Password", required: true, width: "w-36" },
  { key: "department", label: "Department", required: true, listId: "bulk-teacher-dept-options", width: "w-24" },
  { key: "designation", label: "Designation", required: false, listId: "teacher-designation-options", width: "w-40" },
];

// Header-name -> key map used when parsing uploaded CSV files
const KEY_ALIASES = {
  name: "name",
  fullname: "name",
  email: "email",
  password: "password",
  department: "department",
  dept: "department",
  designation: "designation",
};

export default function TeacherEnroll() {
  const queryClient = useQueryClient();
  const departments = useDepartments();
  const [tab, setTab] = useState("single");
  const [form, setForm] = useState(emptyForm);

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
      invalidateList();
    },
    onError: (err) => toast.error(err.response?.data?.message || "Bulk import failed"),
  });

  // Auto-fill a row created by pressing Enter: copy department and
  // designation from the top row.
  const growRow = (next, nextRow) => {
    next[nextRow].department = next[0].department || "";
    if (!next[nextRow].designation) next[nextRow].designation = next[0].designation || "";
  };

  // Passwords must be at least 8 characters when provided.
  const extraInvalid = (row) => {
    const pass = (row.password || "").trim();
    return pass.length > 0 && pass.length < 8;
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
            Teacher Enrollment Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            Create faculty accounts with a short code (e.g. AKP). Teachers sign in using email and password.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("single")} className={tabBtnCls(tab === "single")}>
          Single Teacher Enrollment
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
        <BulkImportSheet
          columns={COLUMNS}
          emptyForm={emptyForm}
          aliases={KEY_ALIASES}
          entity="teacher"
          dataLists={[
            { id: "bulk-teacher-dept-options", options: departments },
            { id: "teacher-designation-options", options: DESIGNATIONS },
          ]}
          growRow={growRow}
          extraInvalid={extraInvalid}
          invalidHint="name, email, password (8+ chars), department are required"
          headerNote={
            <>
              Upload a .csv file, type directly, or paste rows from Excel / CSV. Press{" "}
              <kbd className={kbdCls}>Enter</kbd> to move to the next row — it copies department and
              designation from the top row.
            </>
          }
          footerNote={
            <>
              Rows grow automatically as you type. <span className="font-mono">A</span>–
              <span className="font-mono">E</span> columns = name, email, password, department, designation.
            </>
          }
          onImport={(rows) => bulkMutation.mutateAsync(rows)}
          isPending={bulkMutation.isPending}
        />
      )}
    </div>
  );
}
