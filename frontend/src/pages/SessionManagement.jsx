import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { adminApi } from "../api/endpoints";
import {
  Calendar,
  PlusCircle,
  CheckCircle2,
  Lock,
  ChevronRight,
  X,
} from "lucide-react";

export default function SessionManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  // Session state
  const [term, setTerm] = useState("Summer");
  const [year, setYear] = useState("26");

  const { data: sessionData, isLoading: loadingSessions } = useQuery({
    queryKey: ["admin", "sessions"],
    queryFn: () => adminApi.listSessions(),
  });

  const sessions = sessionData?.data?.sessions || [];

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: (payload) => adminApi.createSession(payload),
    onSuccess: (res) => {
      toast.success(res?.message || "Session created successfully");
      queryClient.invalidateQueries(["admin", "sessions"]);
      setCreateOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create session");
    },
  });

  const activateSessionMutation = useMutation({
    mutationFn: (id) => adminApi.setActiveSession(id),
    onSuccess: (res) => {
      toast.success(res?.message || "Session activated");
      queryClient.invalidateQueries(["admin", "sessions"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to set active session");
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Calendar className="h-7 w-7 text-slate-600" />
            Academic Sessions & Teacher Section Enrollment
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            Create terms (Spring/Summer/Fall), set active academic sessions, and assign professors to class sections.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="glass-btn-primary self-start sm:self-auto shrink-0">
          <PlusCircle className="h-4 w-4" />
          Create Session
        </button>
      </div>

      {/* Sessions Registry */}
      <div className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800">
        <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-4">
          Academic Sessions Registry
        </h3>

        {loadingSessions ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No academic sessions created yet.</div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s._id || s.id}
                onClick={() => navigate(`/admin/sessions/${s._id || s.id}`)}
                className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 cursor-pointer group ${
                  s.isActive
                    ? "bg-gradient-to-r from-slate-900/10 via-slate-900/5 to-slate-600/10 border-slate-400/40 shadow-sm hover:border-slate-400/70"
                    : "bg-slate-50/50 dark:bg-slate-700/40 border-slate-200/60 dark:border-slate-800 opacity-75 hover:opacity-100 hover:border-slate-400/60"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-slate-900 dark:text-white">{s.name}</span>
                    {s.isActive ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-500 dark:text-slate-300 border border-slate-400/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Active Session
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-500 dark:text-slate-300 border border-slate-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Previous / Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">
                    Term: {s.term} &middot; Year: {s.year} &middot; Created {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {!s.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        activateSessionMutation.mutate(s._id || s.id);
                      }}
                      className="glass-btn-secondary text-xs py-1.5 px-3"
                    >
                      Set Active
                    </button>
                  )}
                  <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
                    View &amp; Assign
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-700/60 backdrop-blur-sm"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative glass-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/20 bg-white/95 dark:bg-[#242b3d]/95">
            <button
              onClick={() => setCreateOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-slate-600" />
              Create New Session
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 mb-6">
              When a new session is created, previous sessions will be locked from further attendance changes.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSessionMutation.mutate({ term, year });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Academic Term</label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="glass-input"
                >
                  <option value="Spring">Spring</option>
                  <option value="Summer">Summer</option>
                  <option value="Fall">Fall</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1.5">Year Tag (e.g. 26 or 2026)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 26"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-500/10 border border-slate-400/30 text-[11px] text-slate-500 dark:text-slate-300">
                Created Session Tag: <strong className="font-mono text-sm ml-1">{term}-{year}</strong>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setCreateOpen(false)} className="glass-btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSessionMutation.isPending}
                  className="glass-btn-primary text-xs px-6 py-2.5"
                >
                  {createSessionMutation.isPending ? "Creating..." : "Create & Activate Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
