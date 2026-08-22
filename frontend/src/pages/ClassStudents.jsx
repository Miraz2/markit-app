import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { studentApi, courseStudentApi, metaApi } from "../api/endpoints";
import { Search, Users, UserPlus, Edit2, Trash2, X, UserCheck, GraduationCap } from "lucide-react";

const emptyForm = { studentId: "", name: "", email: "", phone: "" };

export default function ClassStudents() {
  const [searchParams] = useSearchParams();
  const department = searchParams.get("department") || "";
  const batch = searchParams.get("batch") || "";
  const section = searchParams.get("section") || "";
  const courseName = searchParams.get("courseName") || "";

  const { teacher } = useAuth();
  const isAdmin = teacher?.role === "admin";

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const queryClient = useQueryClient();

  // One fetch for this class — search filters client-side
  const { data, isLoading } = useQuery({
    queryKey: ["students", "class", department, batch, section],
    queryFn: () => studentApi.list({ department, batch, section }),
    enabled: Boolean(department && batch && section),
    staleTime: 5 * 60 * 1000,
  });

  const { data: sessionData } = useQuery({
    queryKey: ["meta", "sessions"],
    queryFn: () => metaApi.sessions(),
  });
  const activeSession = sessionData?.data?.activeSession?.name || "";

  const personalQueryKey = ["course-students", activeSession, department, batch, section, courseName];
  const { data: personalData, isLoading: personalLoading } = useQuery({
    queryKey: personalQueryKey,
    queryFn: () =>
      courseStudentApi.list({
        sessionName: activeSession,
        department,
        batch,
        section,
        ...(courseName ? { courseName } : {}),
      }),
    enabled: Boolean(department && batch && section && activeSession),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? courseStudentApi.update(editing._id, payload)
        : courseStudentApi.create({
            ...payload,
            sessionName: activeSession,
            department,
            batch,
            section,
            courseName,
          }),
    onSuccess: () => {
      toast.success(editing ? "Personal student updated" : "Student personally enrolled");
      queryClient.invalidateQueries({ queryKey: ["course-students"] });
      closeForm();
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to save student"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => courseStudentApi.remove(id),
    onSuccess: () => {
      toast.success("Personal student removed");
      queryClient.invalidateQueries({ queryKey: ["course-students"] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to remove student"),
  });

  const students = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.data?.students || [];
    if (!q) return list;
    return list.filter(
      (s) => s.name?.toLowerCase().includes(q) || String(s.studentId).toLowerCase().includes(q)
    );
  }, [data, search]);

  const personalStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = personalData?.data?.students || [];
    if (!q) return list;
    return list.filter(
      (s) => s.name?.toLowerCase().includes(q) || String(s.studentId).toLowerCase().includes(q)
    );
  }, [personalData, search]);

  // Official roster + personally enrolled students together
  const classTotal = students.length + personalStudents.length;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ studentId: s.studentId || "", name: s.name || "", email: s.email || "", phone: s.phone || "" });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const isOwner = (s) => String(s.enrolledBy?._id || "") === String(teacher?._id || "");

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-slate-700 dark:text-slate-200" />
            {courseName || "Class Students"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
            {department}-{batch}-{section} · {isLoading ? "loading…" : `${classTotal} student${classTotal === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-xs"
          />
        </div>
      </div>

      {/* Official Roster Table */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No students found matching your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-700/40 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3.5">Student Roll ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {students.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-500/10 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-500 dark:text-slate-300">
                      {s.studentId}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                      {s.name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                      {s.email || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono">
                      {s.phone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Personally Enrolled Students */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <div>
            <h2 className="text-sm font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
              Personal Students ({personalLoading ? "…" : personalStudents.length})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
              {isAdmin
                ? "Personally enrolled by teachers into this course — view only."
                : "Your privately enrolled students for this course. They are not part of the official roster."}
            </p>
          </div>
          {!isAdmin && (
            <button onClick={openCreate} className="glass-btn-primary shrink-0 self-start sm:self-auto">
              <UserPlus className="h-4 w-4" />
              <span>Add Personal Student</span>
            </button>
          )}
        </div>

        {personalLoading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading personal students...</div>
        ) : personalStudents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No personally enrolled students{search ? " matching your search" : ""} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-700/40 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3.5">Student Roll ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Assigned By</th>
                  {!isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {personalStudents.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-500/10 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-500 dark:text-slate-300">
                      {s.studentId}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                      {s.email || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono">
                      {s.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          isOwner(s)
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        }`}
                        title={isOwner(s) ? "Enrolled by you" : `Enrolled by ${s.enrolledBy?.name}`}
                      >
                        <UserCheck className="h-3 w-3" />
                        {isOwner(s) ? "You" : s.enrolledBy?.name || "Unknown teacher"}
                      </span>
                    </td>
                    {!isAdmin && (
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 inline-block rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-500/20 hover:text-slate-500 transition"
                          title="Edit Student"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(s)}
                          className="p-1.5 inline-block rounded-lg text-slate-400 hover:bg-slate-500/20 hover:text-slate-500 transition"
                          title="Remove Student"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT PERSONAL STUDENT MODAL */}
      {formOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-700/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/20 relative bg-white/95 dark:bg-[#242b3d]/95">
              <button onClick={closeForm} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mb-1">
                {editing ? "Edit Personal Student" : "Add Personal Student"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
                {editing ? editing.name : `${courseName || "Course"} · ${department}-${batch}-${section}`}
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.studentId.trim() || !form.name.trim()) {
                    toast.error("Roll ID and name are required");
                    return;
                  }
                  saveMutation.mutate(form);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                    Student Roll ID *
                  </label>
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                    placeholder="e.g. 202411068030"
                    className="w-full glass-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Student full name"
                    className="w-full glass-input"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Optional"
                      className="w-full glass-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="Optional"
                      className="w-full glass-input"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeForm} className="glass-btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={saveMutation.isPending} className="glass-btn-primary">
                    {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Enroll Student"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDelete &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-700/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/20 relative bg-white/95 dark:bg-[#242b3d]/95">
              <button onClick={() => setConfirmDelete(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mb-1">Remove Personal Student</h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
                Are you sure you want to remove{" "}
                <strong>
                  {confirmDelete.name} ({confirmDelete.studentId})
                </strong>{" "}
                from your personal list?
              </p>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setConfirmDelete(null)} className="glass-btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(confirmDelete._id)}
                  disabled={deleteMutation.isPending}
                  className="glass-btn-danger"
                >
                  {deleteMutation.isPending ? "Removing..." : "Remove Student"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
