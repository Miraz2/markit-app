import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/endpoints";
import { Lock, Mail, Feather, ShieldCheck } from "lucide-react";

export default function SignIn() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  useEffect(() => {
    authApi.setupStatus().then((res) => {
      if (res?.data?.isFirstRun) {
        setIsFirstRun(true);
      }
    }).catch(() => {});

    const savedEmail = localStorage.getItem("markit.rememberedEmail");
    if (savedEmail) {
      setForm((f) => ({ ...f, email: savedEmail }));
      setRemember(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (remember) localStorage.setItem("markit.rememberedEmail", form.email);
      else localStorage.removeItem("markit.rememberedEmail");
      await signin({ ...form, rememberMe: remember });
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-no-repeat bg-center bg-[#31174f]"
      style={{ backgroundImage: "url(/signin-bg.svg)", backgroundSize: "auto 100%" }}
    >
      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Left — branding over the photo */}
        <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-2.5 text-white select-none drop-shadow-md">
            <Feather className="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight">MarkIt</span>
          </div>

          <div className="max-w-lg pb-10">
            <h1 className="text-5xl xl:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg">
              Welcome!
            </h1>
            <p className="mt-2 text-3xl font-bold text-white/95 drop-shadow-md">
              To Our New Website.
            </p>
            <p className="mt-5 text-sm leading-relaxed text-white/85 max-w-md drop-shadow-sm">
              MarkIt brings smart attendance to your classroom — enroll students in bulk,
              take attendance in seconds, and track summaries across every department,
              batch, and section.
            </p>
          </div>

          <div />
        </div>

        {/* Right — tinted sign-in form */}
        <div className="relative flex items-center justify-center p-6 sm:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-700/55 via-pink-600/45 to-purple-800/60 backdrop-blur-[2px]" />

          <div className="relative w-full max-w-sm py-10">
            {/* Mobile-only brand */}
            <div className="flex lg:hidden items-center justify-center gap-2.5 text-white mb-8">
              <Feather className="h-6 w-6" />
              <span className="text-xl font-bold tracking-tight">MarkIt</span>
            </div>

            <h2 className="text-center text-4xl font-bold text-white tracking-tight mb-10 drop-shadow">
              Sign In
            </h2>

            {isFirstRun && (
              <div className="mb-6 p-3 rounded-xl bg-white/15 border border-white/25 text-white text-xs flex items-start gap-2.5 backdrop-blur-sm">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <span>No accounts exist yet. Initial setup is required to create the Admin account.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-white/90 mb-1.5">
                  Email
                </label>
                <div className="flex items-center gap-3 border-b-2 border-white/70 focus-within:border-white transition-colors">
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@university.edu"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="signin-field w-full bg-transparent py-2.5 text-sm text-white placeholder-white/60 focus:outline-none"
                  />
                  <Mail className="h-4 w-4 text-white/90 shrink-0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-white/90 mb-1.5">
                  Password
                </label>
                <div className="flex items-center gap-3 border-b-2 border-white/70 focus-within:border-white transition-colors">
                  <input
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="signin-field w-full bg-transparent py-2.5 text-sm text-white placeholder-white/60 focus:outline-none"
                  />
                  <Lock className="h-4 w-4 text-white/90 shrink-0" />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-white/90">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 accent-fuchsia-500 cursor-pointer"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => toast("Contact your administrator to reset your password.")}
                  className="font-semibold hover:underline underline-offset-2"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 font-bold text-sm text-white shadow-lg shadow-purple-950/40 transition active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            {isFirstRun ? (
              <p className="mt-16 text-center text-xs text-white/85">
                Initial setup?{" "}
                <Link to="/signup" className="font-semibold text-white hover:underline underline-offset-2">
                  Register Super Admin
                </Link>
              </p>
            ) : (
              <p className="mt-16 text-center text-[11px] leading-relaxed text-white/75">
                Teacher account enrollment is managed by the system Admin.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
