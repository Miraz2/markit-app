import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, CheckSquare, ChevronRight, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { metaApi } from "../api/endpoints";

export default function TakeCourses() {
  const { teacher } = useAuth();
  const isAdmin = teacher?.role === "admin";
  const navigate = useNavigate();
  const location = useLocation();

  // Active session
  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["meta", "sessions"],
    queryFn: () => metaApi.sessions(),
    enabled: !!teacher,
  });
  const activeSession = sessionData?.data?.activeSession || null;

  // Courses assigned to this teacher in the active session
  const courses = useMemo(() => {
    if (!teacher?.assignments) return [];
    if (!activeSession) return teacher.assignments;
    return teacher.assignments.filter((a) => a.sessionName === activeSession.name);
  }, [teacher, activeSession]);

  // Deep link from Dashboard: jump straight into the requested course
  useEffect(() => {
    const target = location.state?.assignment;
    if (!target || courses.length === 0) return;
    const match = courses.find(
      (a) =>
        a.department === target.department &&
        a.batch === target.batch &&
        a.section === target.section &&
        (a.courseName || "") === (target.courseName || "")
    );
    if (match) {
      navigate(`/attendance/take/class?${openParams(match)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, location.state]);

  const openParams = (a) =>
    new URLSearchParams({
      department: a.department,
      batch: a.batch,
      section: a.section,
      courseName: a.courseName || "",
    }).toString();

  // Admin guard — admins cannot mark attendance
  if (isAdmin) {
    return (
      <div className="glass-card p-10 rounded-3xl text-center space-y-4 max-w-xl mx-auto border border-slate-400/30">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-500/10 text-slate-600 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Admin Restriction</h2>
        <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
          Administrators cannot mark or edit student attendance. This is reserved for assigned teachers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <CheckSquare className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          Take Attendance
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
          {isLoading
            ? "Loading active session…"
            : activeSession
            ? `Active session: ${activeSession.name} · pick a course to begin`
            : "No active session — ask an administrator to activate one"}
        </p>
      </div>

      {/* Course List */}
      {!isLoading && courses.length === 0 ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          {activeSession
            ? `No courses assigned to you in ${activeSession.name}. Contact an administrator to get assigned.`
            : "There is no active academic session right now."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(isLoading ? Array.from({ length: 4 }) : courses).map((c, idx) =>
            isLoading ? (
              <div key={idx} className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800 h-[86px] animate-pulse" />
            ) : (
              <button
                key={idx}
                onClick={() => navigate(`/attendance/take/class?${openParams(c)}`)}
                className="glass-card px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-left group cursor-pointer transition hover:border-slate-400/60 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-400/10 active:scale-[0.98] active:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-slate-500/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {c.courseName || "General"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate mt-0.5">
                        {c.department}-{c.batch}-{c.section}
                        {c.sessionName ? ` · ${c.sessionName}` : ""}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
