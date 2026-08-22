import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi, metaApi } from "../api/endpoints";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Lock,
  History,
} from "lucide-react";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["admin", "sessions"],
    queryFn: () => adminApi.listSessions(),
  });
  const sessions = sessionData?.data?.sessions || [];
  const session = useMemo(() => sessions.find((s) => (s._id || s.id) === id), [sessions, id]);

  const { data: teacherData, isLoading: loadingTeachers } = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: () => adminApi.listTeachers(),
  });
  const teachers = teacherData?.data?.teachers || [];

  // Full course catalog count (courses table).
  const { data: coursesData } = useQuery({
    queryKey: ["meta", "courses"],
    queryFn: () => metaApi.courses(),
  });
  const totalCourses = coursesData?.data?.courses?.length || 0;

  // All teachers, with their course counts in this session.
  const allTeachers = useMemo(() => {
    if (!session) return [];
    const name = session.name;
    return teachers.map((t) => ({
      ...t,
      courseCount: (t.assignments || []).filter((a) => a.sessionName === name).length,
    }));
  }, [teachers, session]);

  if (isLoading) {
    return (
      <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="glass-card p-16 rounded-3xl text-center space-y-4 border border-slate-200/80 dark:border-slate-800">
        <p className="text-xs text-slate-400">Session not found.</p>
        <Link to="/admin/sessions" className="glass-btn-secondary text-xs inline-flex">
          <ChevronLeft className="h-4 w-4" />
          Back to Sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        to="/admin/sessions"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition mb-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Sessions & Assignments
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <Calendar className="h-7 w-7 text-slate-600" />
          <span className="font-mono">{session.name}</span>
          {session.isActive ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-500 dark:text-slate-300 border border-slate-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Lock className="h-3 w-3" /> Previous / Disabled
            </span>
          )}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          Term: {session.term} &middot; Year: {session.year} &middot; Created{" "}
          {new Date(session.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card px-5 py-4 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <p className="text-2xl font-extrabold font-display text-slate-900 dark:text-white tabular-nums">
            {allTeachers.length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mt-0.5 uppercase tracking-wide">
            Teachers
          </p>
        </div>
        <div className="glass-card px-5 py-4 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <p className="text-2xl font-extrabold font-display text-slate-900 dark:text-white tabular-nums">
            {totalCourses}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mt-0.5 uppercase tracking-wide">
            Course Offerings
          </p>
        </div>
      </div>

      {/* Attendance history shortcut */}
      <Link
        to={`/attendance/history/${encodeURIComponent(session.name)}`}
        className="glass-card px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 group transition hover:border-slate-400/60 hover:shadow-lg"
      >
        <span className="flex items-center gap-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <History className="h-4 w-4 text-slate-600" />
          Browse attendance records of this session
        </span>
        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* All teachers */}
      <div>
        <h2 className="text-sm font-bold font-display text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-600" />
          All Teachers
        </h2>

        {loadingTeachers ? (
          <div className="glass-card p-10 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
            Loading teachers…
          </div>
        ) : allTeachers.length === 0 ? (
          <div className="glass-card p-10 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
            No teachers enrolled yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allTeachers.map((t) => {
              const initials = (t.name || "?")
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <button
                  key={t._id || t.id}
                  onClick={() => navigate(`/admin/sessions/assign/${t._id || t.id}`)}
                  className="glass-card px-5 py-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-left group cursor-pointer transition hover:border-slate-400/60 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-400/10 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-500 dark:from-slate-200 dark:to-slate-400 text-white text-sm font-bold shadow-sm">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate mt-0.5 flex items-center gap-1.5">
                          <BookOpen className="h-3 w-3 shrink-0" />
                          {t.courseCount} course{t.courseCount === 1 ? "" : "s"} · {t.department}
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
    </div>
  );
}
