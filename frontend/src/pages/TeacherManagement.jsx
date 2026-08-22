import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { adminApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import { useDepartments } from "../hooks/useMeta";
import {
  UserCheck,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  X,
} from "lucide-react";

const DESIGNATIONS = ["Department Head", "Professor", "Associate Professor", "Assistant Professor", "Lecturer"];

export default function TeacherManagement() {
  const queryClient = useQueryClient();
  const departments = useDepartments();
  const [search, setSearch] = useState("");
  const [editTeacher, setEditTeacher] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: () => adminApi.listTeachers(),
  });

  const teachers = data?.data?.teachers || [];

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      (t.department && t.department.toLowerCase().includes(search.toLowerCase()))
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminApi.updateTeacher(id, payload),
    onSuccess: () => {
      toast.success("Teacher details updated");
      queryClient.invalidateQueries(["admin", "teachers"]);
      setEditTeacher(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update teacher");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminApi.deleteTeacher(id),
    onSuccess: () => {
      toast.success("Teacher account removed");
      queryClient.invalidateQueries(["admin", "teachers"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete teacher");
    },
  });

  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({ id: editTeacher._id || editTeacher.id, payload: editTeacher });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="h-7 w-7 text-slate-600" />
            Professor & Teacher Enrollment
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            Create teacher accounts and manage faculty members.
          </p>
        </div>

        <Link to="/admin/teachers/enroll" className="glass-btn-primary self-start sm:self-auto">
          <UserPlus className="h-4 w-4" />
          <span>Enroll New Teacher</span>
        </Link>
      </div>

      {/* Filter / Search card */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by teacher name, code (e.g. AKP), email, or dept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs glass-input"
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-300 font-medium">
          Total Faculty Enrolled: <span className="font-bold text-slate-900 dark:text-white">{teachers.length}</span>
        </div>
      </div>

      {/* Teachers List Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading faculty list...</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No teachers found matching search criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-700/40 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3.5">Teacher Name</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Designation</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {filteredTeachers.map((t) => (
                  <tr key={t._id || t.id} className="hover:bg-slate-500/10 transition">
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                      {t.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {t.email}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-200 font-medium">
                      {t.department || "N/A"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-300">
                      {t.designation || "—"}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => setEditTeacher(t)}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-500/20 hover:text-slate-500 transition"
                        title="Edit Teacher"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${t.name}?`)) {
                            deleteMutation.mutate(t._id || t.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/20 hover:text-slate-500 transition"
                        title="Delete Account"
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

      {/* EDIT TEACHER MODAL */}
      {editTeacher &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-700/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-white/20 relative bg-white/95 dark:bg-[#242b3d]/95">
            <button
              onClick={() => setEditTeacher(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mb-1">
              Edit Teacher Information
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
              Update profile details or reset password for {editTeacher.name}.
            </p>

            <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editTeacher.name || ""}
                    onChange={(e) => setEditTeacher({ ...editTeacher, name: e.target.value })}
                    className="glass-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1">Designation</label>
                  <select
                    value={editTeacher.designation || ""}
                    onChange={(e) => setEditTeacher({ ...editTeacher, designation: e.target.value })}
                    className="glass-input"
                  >
                    {!DESIGNATIONS.includes(editTeacher.designation) && (
                      <option value="">{editTeacher.designation || "Select designation"}</option>
                    )}
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editTeacher.email || ""}
                  onChange={(e) => setEditTeacher({ ...editTeacher, email: e.target.value })}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1">Reset Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  onChange={(e) => setEditTeacher({ ...editTeacher, password: e.target.value })}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1">Department</label>
                <SearchableSelect
                  value={editTeacher.department || ""}
                  onChange={(v) => setEditTeacher({ ...editTeacher, department: v })}
                  options={departments.map((d) => ({ value: d, label: d }))}
                  placeholder="Select department"
                  searchPlaceholder="Search departments…"
                  emptyMessage="No departments found"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditTeacher(null)}
                  className="glass-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="glass-btn-primary"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
