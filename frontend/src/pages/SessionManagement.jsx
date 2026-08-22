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
  BookOpen,
} from "lucide-react";

export default function SessionManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("sessions"); // "sessions" | "assign"

  // Session state
  const [term, setTerm] = useState("Summer");
  const [year, setYear] = useState("26");

  const { data: sessionData, isLoading: loadingSessions } = useQuery({
    queryKey: ["admin", "sessions"],
    queryFn: () => adminApi.listSessions(),
  });

  const { data: teacherData, isLoading: loadingTeachers } = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: () => adminApi.listTeachers(),
  });

  const sessions = sessionData?.data?.sessions || [];
  const activeSession = sessions.find((s) => s.isActive) || null;
  const teachers = teacherData?.data?.teachers || [];

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: (payload) => adminApi.createSession(payload),
    onSuccess: (res) => {
      toast.success(res?.message || "Session created successfully");
      queryClient.invalidateQueries(["admin", "sessions"]);
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 w-fit p-1 rounded-xl bg-slate-200/60 dark:bg-slate-700/40">
        <button
          onClick={() => setActiveTab("sessions")}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "sessions"
              ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Academic Sessions List & Creation
        </button>
        <button
          onClick={() => setActiveTab("assign")}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "assign"
              ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Assign Teachers to Sections
        </button>
      </div>

      {/* TAB 1: ACADEMIC SESSIONS */}
      {activeTab === "sessions" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Session Card */}
          <div className="glass-card p-6 rounded-3xl h-fit border border-slate-200/80 dark:border-slate-800">
            <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-slate-600" />
              Create New Session
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
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

              <button
                type="submit"
                disabled={createSessionMutation.isPending}
                className="w-full glass-btn-primary py-3"
              >
                {createSessionMutation.isPending ? "Creating..." : "Create & Activate Session"}
              </button>
            </form>
          </div>

          {/* Sessions List */}
          <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800">
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
                    className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${
                      s.isActive
                        ? "bg-gradient-to-r from-slate-900/10 via-slate-900/5 to-slate-600/10 border-slate-400/40 shadow-sm"
                        : "bg-slate-50/50 dark:bg-slate-700/40 border-slate-200/60 dark:border-slate-800 opacity-75"
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

                    {!s.isActive && (
                      <button
                        onClick={() => activateSessionMutation.mutate(s._id || s.id)}
                        className="glass-btn-secondary text-xs py-1.5 px-3"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ASSIGN — pick a teacher */}
      {activeTab === "assign" && (
        <div className="space-y-4 max-w-5xl mx-auto">
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Select a teacher to view and manage their course assignments in{" "}
            <span className="font-mono font-bold">{activeSession ? activeSession.name : "—"}</span>.
          </p>

          {loadingTeachers ? (
            <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
              Loading teachers…
            </div>
          ) : teachers.length === 0 ? (
            <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
              No teachers enrolled yet. Enroll teachers first.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teachers.map((t) => {
                const id = t._id || t.id;
                const count = (t.assignments || []).filter(
                  (a) => a.sessionName === (activeSession?.name || "__none__")
                ).length;
                const initials = (t.name || "?")
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <button
                    key={id}
                    onClick={() => navigate(`/admin/sessions/assign/${id}`)}
                    className="glass-card px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-left group cursor-pointer transition hover:border-slate-400/60 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-400/10 active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-500 dark:from-slate-200 dark:to-slate-400 text-white text-xs font-bold shadow-sm">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate mt-0.5 flex items-center gap-1.5">
                            <BookOpen className="h-3 w-3 shrink-0" />
                            {count} course{count === 1 ? "" : "s"} in {activeSession ? activeSession.name : "—"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
