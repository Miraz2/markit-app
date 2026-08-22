import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import { useDepartments } from "../hooks/useMeta";
import { User, KeyRound, Save, LogOut, Lock } from "lucide-react";

const DESIGNATIONS = ["Department Head", "Professor", "Associate Professor", "Assistant Professor", "Lecturer"];

export default function Profile() {
  const { teacher, signout, refresh } = useAuth();
  const departments = useDepartments();
  const isAdmin = teacher?.role === "admin";

  const [info, setInfo] = useState({
    name: teacher?.name || "",
    designation: teacher?.designation || "",
    department: teacher?.department || "",
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let payload;
      if (isAdmin) {
        if (!info.name.trim()) {
          toast.error("Full name is required");
          setLoading(false);
          return;
        }
        payload = { ...info };
        if (passwords.newPassword) payload = { ...payload, ...passwords };
      } else {
        if (!passwords.currentPassword || !passwords.newPassword) {
          toast.error("Fill in both current and new password");
          setLoading(false);
          return;
        }
        payload = passwords;
      }

      await authApi.updateProfile(payload);
      toast.success(isAdmin ? "Profile updated successfully!" : "Password updated successfully!");
      setPasswords({ currentPassword: "", newPassword: "" });
      if (isAdmin) await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <User className="h-7 w-7 text-slate-600" />
          My Account Profile
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          {isAdmin
            ? "Manage your account details and security."
            : "View your account details and manage your password. Contact an admin to change your personal information."}
        </p>
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 space-y-6">
        {/* User Card Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
          <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-slate-500 to-slate-600 dark:from-slate-200 dark:to-slate-400 text-white font-bold text-2xl flex items-center justify-center shadow-lg shadow-slate-600/20">
            {teacher?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{teacher?.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">{teacher?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-300 border border-slate-400/30 text-[10px] font-bold uppercase tracking-wider">
                {teacher?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Account Information — editable for admins, read-only for teachers */}
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Full Name</label>
              {isAdmin ? (
                <input
                  type="text"
                  required
                  value={info.name}
                  onChange={(e) => setInfo({ ...info, name: e.target.value })}
                  className="glass-input"
                />
              ) : (
                <input type="text" value={teacher?.name || ""} disabled className="glass-input opacity-70 cursor-not-allowed" />
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Designation</label>
              {isAdmin ? (
                <select
                  value={info.designation}
                  onChange={(e) => setInfo({ ...info, designation: e.target.value })}
                  className="glass-input"
                >
                  {!DESIGNATIONS.includes(info.designation) && info.designation && (
                    <option value={info.designation}>{info.designation}</option>
                  )}
                  <option value="">—</option>
                  {DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={teacher?.designation || "—"}
                  disabled
                  className="glass-input opacity-70 cursor-not-allowed"
                />
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Department</label>
              {isAdmin ? (
                <SearchableSelect
                  value={info.department}
                  onChange={(v) => setInfo({ ...info, department: v })}
                  options={[...departments.map((d) => ({ value: d, label: d })),
                    ...(info.department && !departments.includes(info.department)
                      ? [{ value: info.department, label: info.department }]
                      : [])]}
                  placeholder="Select department"
                  searchPlaceholder="Search departments…"
                  emptyMessage="No departments found"
                />
              ) : (
                <input
                  type="text"
                  value={teacher?.department || "—"}
                  disabled
                  className="glass-input opacity-70 cursor-not-allowed"
                />
              )}
            </div>
          </div>

          {!isAdmin && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400 -mt-2">
              <Lock className="h-3 w-3" />
              These details can only be changed by an administrator.
            </p>
          )}

          {/* Password Change */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Change Password{isAdmin ? " (Optional)" : ""}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Current Password</label>
                <input
                  type="password"
                  required={!isAdmin}
                  placeholder="••••••••"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">New Password</label>
                <input
                  type="password"
                  minLength={8}
                  required={!isAdmin}
                  placeholder="At least 8 characters"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button type="button" onClick={signout} className="glass-btn-danger text-xs">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>

            <button type="submit" disabled={loading} className="glass-btn-primary px-6">
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : isAdmin ? "Save Changes" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
