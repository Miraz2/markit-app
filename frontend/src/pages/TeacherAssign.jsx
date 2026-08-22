import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { adminApi, metaApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import {
  ArrowLeft,
  UserCheck,
  CalendarDays,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  X,
} from "lucide-react";

const emptyForm = { department: "", batch: "", section: "", courseName: "" };

export default function TeacherAssign() {
  const { teacherId } = useParams();
  const queryClient = useQueryClient();

  const { data: teacherData, isLoading } = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: () => adminApi.listTeachers(),
  });
  const teachers = teacherData?.data?.teachers || [];
  const teacher = teachers.find((t) => String(t._id || t.id) === String(teacherId)) || null;

  const { data: sessionData } = useQuery({
    queryKey: ["admin", "sessions"],
    queryFn: () => adminApi.listSessions(),
  });
  const sessions = sessionData?.data?.sessions || [];
  const activeSession = sessions.find((s) => s.isActive) || null;

  // Course catalog from the courses collection — drives dept + course pickers
  const { data: courseData } = useQuery({
    queryKey: ["meta", "courses"],
    queryFn: () => metaApi.courses(),
    staleTime: 5 * 60 * 1000,
  });
  const catalog = useMemo(() => courseData?.data?.courses || [], [courseData]);
  const departmentOptions = useMemo(
    () => [...new Set(catalog.map((c) => c.department))].sort().map((d) => ({ value: d, label: d })),
    [catalog]
  );

  // Last-saved copy from the server (normalized) — used to detect dirty state and reset
  const savedItems = useMemo(() => {
    if (!teacher || !activeSession) return [];
    return (teacher.assignments || [])
      .filter((a) => a.sessionName === activeSession.name)
      .map((a) => ({
        department: a.department,
        batch: a.batch,
        section: a.section,
        courseName: a.courseName || "",
      }));
  }, [teacher, activeSession]);

  // Local editable copy of this teacher's assignments in the active session
  const [items, setItems] = useState([]);
  useEffect(() => {
    setItems(savedItems.map((a) => ({ ...a })));
  }, [savedItems]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [removeIndex, setRemoveIndex] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const courseOptions = useMemo(
    () =>
      catalog
        .filter((c) => !form.department || c.department === form.department)
        .map((c) => ({ value: c.name, label: c.name })),
    [catalog, form.department]
  );

  const openAdd = () => {
    setEditIndex(null);
    setForm(emptyForm);
    setAssignOpen(true);
  };

  const openEdit = (idx) => {
    setEditIndex(idx);
    setForm({ ...items[idx] });
    setAssignOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (payload) => adminApi.assignSections(payload),
    onSuccess: () => {
      toast.success("Assignments saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to save assignments"),
  });

  const handleSubmit = () => {
    if (!form.department.trim() || !form.batch.trim() || !form.section.trim() || !form.courseName.trim()) {
      toast.error("Department, Batch, Section, and Course Name are required");
      return;
    }
    const next = {
      department: form.department.trim(),
      batch: form.batch.trim(),
      section: form.section.trim(),
      courseName: form.courseName.trim(),
    };
    const exists = items.some(
      (a, i) =>
        i !== editIndex &&
        a.department.toLowerCase() === next.department.toLowerCase() &&
        a.batch === next.batch &&
        a.section.toLowerCase() === next.section.toLowerCase() &&
        a.courseName.toLowerCase() === next.courseName.toLowerCase()
    );
    if (exists) {
      toast.error("This class is already in the list");
      return;
    }
    if (editIndex !== null) {
      setItems(items.map((a, i) => (i === editIndex ? next : a)));
    } else {
      setItems([...items, next]);
    }
    setForm(emptyForm);
    setEditIndex(null);
    setAssignOpen(false);
  };

  const handleReset = () => {
    setItems(savedItems.map((a) => ({ ...a })));
    setForm(emptyForm);
    setEditIndex(null);
    setRemoveIndex(null);
  };

  const handleSave = () => {
    if (!activeSession) {
      toast.error("No active academic session exists");
      return;
    }
    saveMutation.mutate({
      teacherId,
      sessionId: activeSession._id || activeSession.id,
      assignments: items,
    });
  };

  const initials = useMemo(
    () =>
      (teacher?.name || "?")
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [teacher]
  );

  // Dirty = local list differs from last-saved server list (added, edited, or removed)
  const serialize = (list) =>
    JSON.stringify(list.map((a) => [a.department, a.batch, a.section, a.courseName]));
  const dirty = serialize(items) !== serialize(savedItems);

  if (!isLoading && !teacher) {
    return (
      <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800 max-w-3xl mx-auto">
        Teacher not found.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to="/admin/sessions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Sessions & Assignments
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-500 dark:from-slate-200 dark:to-slate-400 text-white font-bold text-lg shadow-md">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white">
                {teacher?.name || "…"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                {[teacher?.designation, teacher?.department].filter(Boolean).join(" · ") || "Faculty member"}
              </p>
            </div>
          </div>

          <button onClick={openAdd} className="glass-btn-primary self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            <span>Assign Course</span>
          </button>
        </div>
      </div>

      {/* Active session banner */}
      <div className="glass-card px-5 py-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-200 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          Assigned courses in
        </p>
        <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 font-mono">
          {activeSession ? activeSession.name : "No Active Session!"}
        </span>
      </div>

      {/* Assignment list */}
      {!activeSession ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Activate an academic session first to manage assignments.
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          No courses assigned in {activeSession.name} yet. Use “Assign Course” to add one.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((a, idx) => (
            <div
              key={idx}
              className="glass-card px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-slate-500/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {a.courseName || "General"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-300 font-mono mt-0.5">
                    {a.department}-{a.batch}-{a.section}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(idx)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 hover:text-slate-500 transition"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRemoveIndex(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-500/10 transition"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <p className={`text-[11px] font-semibold ${dirty ? "text-amber-600 dark:text-amber-400" : "text-transparent select-none"}`}>
          Unsaved changes — remember to save.
        </p>
        <div className="flex items-center gap-3">
          {dirty && (
            <button onClick={handleReset} disabled={saveMutation.isPending} className="glass-btn-secondary">
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!activeSession || saveMutation.isPending}
            className="glass-btn-primary px-8 py-3 disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>

      {/* ASSIGN COURSE MODAL */}
      {assignOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-700/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/20 relative bg-white/95 dark:bg-[#242b3d]/95">
              <button
                onClick={() => setAssignOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mb-1">
                {editIndex !== null ? "Edit Course" : "Assign Course"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
                {teacher?.name} · {activeSession ? activeSession.name : "no active session"}
              </p>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Department</label>
                    <SearchableSelect
                      value={form.department}
                      onChange={(v) => setForm({ department: v, batch: form.batch, section: form.section, courseName: "" })}
                      options={departmentOptions}
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Course Name</label>
                  <SearchableSelect
                    value={form.courseName}
                    onChange={(v) => setForm({ ...form, courseName: v })}
                    options={courseOptions}
                    placeholder={form.department ? "Select course" : "Select a department first"}
                    searchPlaceholder="Search courses…"
                    disabled={!form.department}
                    emptyMessage="No courses for this department"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setAssignOpen(false)} className="glass-btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleSubmit} className="glass-btn-primary">
                    <Plus className="h-4 w-4" />
                    {editIndex !== null ? "Save Changes" : "Add to List"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* CONFIRM REMOVE MODAL */}
      {removeIndex !== null &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-700/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/20 relative bg-white/95 dark:bg-[#242b3d]/95">
              <button
                onClick={() => setRemoveIndex(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mb-1">
                Remove Course
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
                Remove <strong>{items[removeIndex]?.courseName || "General"}</strong>{" "}
                ({items[removeIndex]?.department}-{items[removeIndex]?.batch}-{items[removeIndex]?.section}) from{" "}
                {teacher?.name}'s assignments? The change applies once you click "Save Assignments".
              </p>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setRemoveIndex(null)} className="glass-btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setItems(items.filter((_, i) => i !== removeIndex));
                    setRemoveIndex(null);
                  }}
                  className="glass-btn-danger"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
