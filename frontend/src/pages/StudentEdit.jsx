import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { studentApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import { useDepartments } from "../hooks/useMeta";
import { Edit2, ArrowLeft } from "lucide-react";

export default function StudentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const departments = useDepartments();
  const [form, setForm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["students", id],
    queryFn: () => studentApi.get(id),
  });

  useEffect(() => {
    if (data?.data?.student) {
      const s = data.data.student;
      setForm({
        studentId: s.studentId,
        name: s.name,
        department: s.department,
        batch: s.batch,
        section: s.section,
        email: s.email || "",
        phone: s.phone || "",
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload) => studentApi.update(id, payload),
    onSuccess: () => {
      toast.success("Student details updated successfully");
      navigate("/students");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update student");
    },
  });

  if (isLoading || !form) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading student details...</div>;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/students")}
          className="p-2 rounded-xl glass-card text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Edit2 className="h-6 w-6 text-slate-600" />
            Edit Student Information
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
            Update roster information for {form.name} ({form.studentId}).
          </p>
        </div>
      </div>

      <div className="glass-card p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                Student Roll ID (e.g. 202411068030)
              </label>
              <input
                type="text"
                required
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="glass-input font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="glass-input"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Phone (Optional)</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="glass-input"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/students")}
              className="glass-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="glass-btn-primary px-6"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
