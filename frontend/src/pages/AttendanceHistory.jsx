import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { History, ChevronRight, CalendarDays, Layers, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { attendanceApi } from "../api/endpoints";

export default function AttendanceHistory() {
  const { teacher } = useAuth();
  const isAdmin = teacher?.role === "admin";
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "history-overview"],
    queryFn: attendanceApi.historyOverview,
  });
  const sessions = data?.data?.sessions || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <History className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          Attendance History
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
          {isAdmin ? (
            <>
              <ShieldCheck className="h-3 w-3" />
              Admin view — attendance from all teachers
            </>
          ) : (
            "Sessions you are assigned to"
          )}
        </p>
      </div>

      {/* Session List */}
      {isLoading ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          {isAdmin
            ? "No academic sessions exist yet. Create one under Academic Sessions."
            : "You have no assigned sessions yet. Ask an administrator to assign you a class."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sessions.map((s) => (
            <button
              key={s.name}
              onClick={() => navigate(`/attendance/history/${encodeURIComponent(s.name)}`)}
              className="glass-card px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-left group cursor-pointer transition hover:border-slate-400/60 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-400/10 active:scale-[0.98] active:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-extrabold font-display tracking-tight text-slate-900 dark:text-white truncate">
                    {s.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3 shrink-0" />
                      {s.classCount} class{s.classCount === 1 ? "" : "es"}
                    </span>
                    {s.latestDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        last: {s.latestDate}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.isActive && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                      Active
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
