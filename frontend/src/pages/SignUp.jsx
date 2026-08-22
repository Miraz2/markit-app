import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AuthShell from "../components/layout/AuthShell";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/endpoints";
import SearchableSelect from "../components/ui/SearchableSelect";
import { useDepartments } from "../hooks/useMeta";
import { ShieldCheck, Lock, User, Mail, KeyRound } from "lucide-react";

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const departments = useDepartments();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
  });
  const [loading, setLoading] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(null);

  useEffect(() => {
    authApi.setupStatus().then((res) => {
      setIsFirstRun(res?.data?.isFirstRun ?? false);
    }).catch(() => {
      setIsFirstRun(false);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(form);
      toast.success("Super Admin account created successfully! Please sign in.");
      navigate("/signin");
    } catch (err) {
      toast.error(err.response?.data?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  if (isFirstRun === null) {
    return (
      <AuthShell tagline="Checking setup status...">
        <div className="text-center py-8 text-slate-400 text-sm">Loading system configuration...</div>
      </AuthShell>
    );
  }

  if (isFirstRun === false) {
    return (
      <AuthShell tagline="Registration Closed.">
        <div className="text-center py-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-500/20 text-slate-500 border border-slate-400/30">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Public Signup Disabled</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            The Super Admin account has already been registered for this university attendance system. Public signups are closed.
          </p>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            All teacher and staff accounts are created exclusively by the Administrator.
          </p>
          <Link
            to="/signin"
            className="inline-flex w-full justify-center items-center py-2.5 rounded-xl bg-slate-600 font-semibold text-xs text-white shadow-lg hover:bg-slate-600 dark:hover:bg-slate-600 transition"
          >
            Return to Sign In Page
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell tagline="System Initial Setup">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">First Run Setup</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Create Super Admin</h2>
        <p className="text-xs text-slate-400 mt-1">Register the primary administrator account for the university system.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Full Name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              required
              placeholder="e.g. Dr. System Administrator"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-700/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-400/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Admin Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="email"
              required
              placeholder="admin@university.edu"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-700/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-400/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Password</label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              minLength={8}
              placeholder="At least 8 chars"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-700/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-400/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Department</label>
          <SearchableSelect
            value={form.department}
            onChange={(v) => setForm({ ...form, department: v })}
            options={departments.map((d) => ({ value: d, label: d }))}
            placeholder="Select department"
            searchPlaceholder="Search departments…"
            emptyMessage="No departments found"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-slate-500 to-slate-600 font-semibold text-sm text-white shadow-lg shadow-slate-600/25 hover:from-slate-500 hover:to-slate-600 transition active:scale-95 disabled:opacity-50"
        >
          {loading ? "Registering Admin..." : "Complete Setup & Create Admin"}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-400">
        Already setup?{" "}
        <Link to="/signin" className="font-semibold text-slate-500 hover:underline">
          Sign In
        </Link>
      </div>
    </AuthShell>
  );
}
