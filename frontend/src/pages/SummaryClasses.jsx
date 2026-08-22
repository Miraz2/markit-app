import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, BookOpen, ChevronRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { attendanceApi } from "../api/endpoints";

export default function SummaryClasses() {
  const { sessionName: rawName } = useParams();
  const sessionName = decodeURIComponent(rawName);
  const { teacher } = useAuth();
  const isAdmin = teacher?.role === "admin";
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "history-classes", sessionName],
    queryFn: () => attendanceApi.historyClasses({ sessionName }),
  });
  const records = data?.data?.records || [];

  // Group day-records into distinct classes
  const classes = useMemo(() => {
    const norm = (v) => String(v || "").trim().toUpperCase();
    const map = new Map();
    for (const r of records) {
      const key = `${norm(r.department)}|${norm(r.batch)}|${norm(r.section)}|${norm(r.courseName)}`;
      if (!map.has(key)) {
        map.set(key, {
          department: r.department,
          batch: r.batch,
          section: r.section,
          courseName: r.courseName || "",
          days: [],
        });
      }
      map.get(key).days.push(r);
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.department}${a.batch}${a.section}${a.courseName}`.localeCompare(
        `${b.department}${b.batch}${b.section}${b.courseName}`
      )
    );
  }, [records]);

  const openSummary = (c) => {
    const params = new URLSearchParams({
      department: c.department,
      batch: c.batch,
      section: c.section,
      courseName: c.courseName,
    });
    navigate(`/attendance/summary/${encodeURIComponent(sessionName)}/class?${params.toString()}`);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to="/attendance/summary"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Sessions
        </Link>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <BarChart3 className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          {sessionName}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
          {isAdmin ? (
            <>
              <ShieldCheck className="h-3 w-3" />
              All classes — every teacher
            </>
          ) : (
            "Classes where you have taken attendance"
          )}
          {" · "}
          {classes.length} class{classes.length === 1 ? "" : "es"}
        </p>
      </div>

      {/* Class List */}
      {isLoading ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Loading classes…
        </div>
      ) : classes.length === 0 ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          No attendance taken in {sessionName} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {classes.map((c) => {
            const lastDate = c.days[0]?.date;
            return (
              <button
                key={`${c.department}-${c.batch}-${c.section}-${c.courseName}`}
                onClick={() => openSummary(c)}
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
                        {c.department}-{c.batch}-{c.section} · {c.days.length} day
                        {c.days.length === 1 ? "" : "s"}
                        {lastDate ? ` · last ${lastDate}` : ""}
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
  );
}
