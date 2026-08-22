import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { studentApi, courseStudentApi } from "../api/endpoints";
import { Users, UserPlus, Search, Edit2, Trash2, X, UserCheck, GraduationCap } from "lucide-react";

// Fetch every active student once (backend pages at 200) — all filtering is client-side
const fetchAllStudents = async () => {
  const pageSize = 200;
  let page = 1;
  let all = [];
  for (;;) {
    const r = await studentApi.list({ page, limit: pageSize });
    const students = r.data?.students || [];
    all = all.concat(students);
    const pages = r.data?.pagination?.pages || 1;
    if (page >= pages || students.length === 0) break;
    page += 1;
  }
  return { data: { students: all } };
};

export default function Students() {
  const [department, setDepartment] = useState("");
  const [batch, setBatch] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["students", "all"],
    queryFn: fetchAllStudents,
    staleTime: 5 * 60 * 1000,
  });

  // Personally enrolled students (teacher-private rosters) — admin is view-only
  const { data: personalData, isLoading: personalLoading } = useQuery({
    queryKey: ["course-students", "all"],
    queryFn: () => courseStudentApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => studentApi.remove(id),
    onSuccess: () => {
      toast.success("Student removed");
      queryClient.invalidateQueries({ queryKey: ["students", "all"] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to remove student"),
  });

  const allStudents = useMemo(
    () =>
      (data?.data?.students || []).slice().sort((a, b) =>
        String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true })
      ),
    [data]
  );

  // Dropdown options derived from the loaded roster — no extra requests
  const departments = useMemo(
    () => [...new Set(allStudents.map((s) => s.department))].sort(),
    [allStudents]
  );
  const batches = useMemo(
    () =>
      [...new Set(allStudents.filter((s) => !department || s.department === department).map((s) => s.batch))].sort(),
    [allStudents, department]
  );
  const sections = useMemo(
    () =>
      [
        ...new Set(
          allStudents
            .filter((s) => (!department || s.department === department) && (!batch || s.batch === batch))
            .map((s) => s.section)
        ),
      ].sort(),
    [allStudents, department, batch]
  );

  // Client-side filtering only
  const students = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStudents.filter(
      (s) =>
        (!department || s.department === department) &&
        (!batch || s.batch === batch) &&
        (!section || s.section === section) &&
        (!q || s.name?.toLowerCase().includes(q) || String(s.studentId).toLowerCase().includes(q))
    );
  }, [allStudents, department, batch, section, search]);

  const personalStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = personalData?.data?.students || [];
    return list.filter(
      (s) =>
        (!department || s.department === department) &&
        (!batch || s.batch === batch) &&
        (!section || s.section === section) &&
        (!q || s.name?.toLowerCase().includes(q) || String(s.studentId).toLowerCase().includes(q))
    );
  }, [personalData, department, batch, section, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-7 w-7 text-slate-600" />
            Enrolled Student Roster
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            Search, filter by department/batch/section, and manage student details.
          </p>
        </div>

        <Link to="/students/enroll" className="glass-btn-primary self-start sm:self-auto">
          <UserPlus className="h-4 w-4" />
          <span>Enroll New Student</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Department</label>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setBatch("");
                setSection("");
              }}
              className="glass-input"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Batch</label>
            <select
              value={batch}
              onChange={(e) => {
                setBatch(e.target.value);
                setSection("");
              }}
              disabled={!department}
              className="glass-input"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={!batch}
              className="glass-input"
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Search Name / ID</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading student roster...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No students found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-700/40 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3.5">Student Roll ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Batch</th>
                  <th className="px-5 py-3.5">Section</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
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
                      {s.department}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono">
                      {s.batch}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono font-bold">
                      {s.section}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <Link
                        to={`/students/${s._id}/edit`}
                        className="p-1.5 inline-block rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-500/20 hover:text-slate-500 transition"
                        title="Edit Student"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        className="p-1.5 inline-block rounded-lg text-slate-400 hover:bg-slate-500/20 hover:text-slate-500 transition"
                        title="Remove Student"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Personally Enrolled by Teachers (view-only for admin) */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800">
        <div className="px-5 pt-5 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-sm font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-indigo-500" />
            Personally Enrolled by Teachers ({personalLoading ? "…" : personalStudents.length})
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
            Private course rosters added by teachers — kept outside the official roster. View only.
          </p>
        </div>

        {personalLoading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading personal enrollments...</div>
        ) : personalStudents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No personally enrolled students yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-700/40 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3.5">Student Roll ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Course</th>
                  <th className="px-5 py-3.5">Assigned By</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Phone</th>
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
                      {s.department}-{s.batch}-{s.section}
                      {s.courseName ? ` · ${s.courseName}` : ""}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold"
                        title={`Personally enrolled by ${s.enrolledBy?.name || "teacher"}`}
                      >
                        <UserCheck className="h-3 w-3" />
                        {s.enrolledBy?.name || "Unknown teacher"}
                      </span>
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

      {/* CONFIRM DELETE MODAL */}
      {confirmDelete &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-700/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/20 relative bg-white/95 dark:bg-[#242b3d]/95">
              <button
                onClick={() => setConfirmDelete(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mb-1">
                Remove Student
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
                Are you sure you want to remove <strong>{confirmDelete.name}</strong> ({confirmDelete.studentId}) from the active roster?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="glass-btn-secondary"
                >
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
