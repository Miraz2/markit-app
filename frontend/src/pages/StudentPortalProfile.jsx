import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { studentAuthApi } from "../api/endpoints";
import { User, KeyRound, Save, AlertTriangle, Camera } from "lucide-react";

export default function StudentPortalProfile() {
  const { student, refresh } = useAuth();
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Downscale + compress client-side so the data URL stays well under the
  // backend's 1MB limit and the API's JSON body limit.
  const resizeImage = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 320;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Invalid image"));
      };
      img.src = url;
    });

  const handleProfileImageChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");

    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      await studentAuthApi.updateProfileImage({ profileImage: dataUrl });
      await refresh();
      toast.success("Profile picture updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  };

  const removeProfileImage = async () => {
    setUploading(true);
    try {
      await studentAuthApi.updateProfileImage({ profileImage: "" });
      await refresh();
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove profile picture");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error("Fill in both current and new password");
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwords.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await studentAuthApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      await refresh();
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const infoRows = [
    ["Full Name", student?.name],
    ["Student ID", student?.studentId],
    ["Department", student?.department],
    ["Batch", student?.batch],
    ["Section", student?.section],
    ["Email", student?.email || "—"],
    ["Phone", student?.phone || "—"],
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <User className="h-7 w-7 text-slate-600" />
          My Profile
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          View your enrollment details and manage your password.
        </p>
      </div>

      {student?.mustChangePassword && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-300/70 bg-amber-50/80 dark:border-amber-500/25 dark:bg-amber-500/[0.08]">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <span className="font-bold">You are using the temporary password</span> given by your office.
            Set your own password below to keep your account secure.
          </p>
        </div>
      )}

      {/* Enrollment details — managed by the university */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="relative group shrink-0">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-gradient-to-tr from-slate-500 to-slate-600 dark:from-slate-200 dark:to-slate-400 text-white font-bold text-2xl flex items-center justify-center shadow-lg shadow-slate-600/20">
              {student?.profileImage ? (
                <img src={student.profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                student?.name?.[0]?.toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Change profile picture"
              aria-label="Change profile picture"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-slate-700 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-[#242b3d] hover:bg-slate-600 dark:hover:bg-slate-200 transition disabled:opacity-60 cursor-pointer"
            >
              {uploading ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleProfileImageChange}
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{student?.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 font-mono">{student?.studentId}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-300 border border-slate-400/30 text-[10px] font-bold uppercase tracking-wider">
                Student
              </span>
              {student?.profileImage && (
                <button
                  type="button"
                  onClick={removeProfileImage}
                  disabled={uploading}
                  className="text-[10px] font-semibold text-red-400 hover:text-red-500 transition disabled:opacity-60"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {infoRows.map(([label, value]) => (
            <div key={label}>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">{label}</label>
              <input
                type="text"
                value={value || ""}
                disabled
                className="glass-input opacity-70 cursor-not-allowed"
              />
            </div>
          ))}
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 -mt-2">
          <User className="h-3 w-3" />
          These details can only be changed by your department office.
        </p>

        {/* Password change */}
        <form onSubmit={handleSubmit} className="pt-5 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Change Password
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                className="glass-input"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                className="glass-input"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                className="glass-input"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="glass-btn-primary px-6 text-xs sm:text-sm w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
