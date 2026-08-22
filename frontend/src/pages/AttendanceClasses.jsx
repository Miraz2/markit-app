import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, History, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { attendanceApi } from "../api/endpoints";

export default function AttendanceClasses() {
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

  // Expanded class card (accordion — only one open at a time, none by default)
  const [expandedKey, setExpandedKey] = useState(null);
  const toggleClass = (key) => setExpandedKey((prev) => (prev === key ? null : key));

  // Group day-records into distinct classes (sorted by course name)
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
          teachers: new Set(),
          days: [],
        });
      }
      const entry = map.get(key);
      if (!entry.courseName && r.courseName) entry.courseName = r.courseName;
      if (r.takenByName) entry.teachers.add(r.takenByName);
      entry.days.push(r);
    }
    return Array.from(map.values())
      .map((c) => ({ ...c, teachers: Array.from(c.teachers).sort() }))
      .sort((a, b) => {
        const an = (a.courseName || "General").toLowerCase();
        const bn = (b.courseName || "General").toLowerCase();
        return (
          an.localeCompare(bn) ||
          `${a.department}${a.batch}${a.section}`.localeCompare(
            `${b.department}${b.batch}${b.section}`
          )
        );
      });
  }, [records]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to="/attendance/history"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Sessions
        </Link>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <History className="h-6 w-6 text-slate-700 dark:text-slate-200" />
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
        <div className="space-y-4">
          {classes.map((c) => {
            const classKey = `${c.department}-${c.batch}-${c.section}-${c.courseName}`;
            const isExpanded = expandedKey === classKey;
            return (
            <div
              key={classKey}
              className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800"
            >
              {/* Class header (collapsible, sticky under the navbar) */}
              <button
                onClick={() => toggleClass(classKey)}
                aria-expanded={isExpanded}
                className={`sticky top-16 z-20 w-full flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer text-left transition rounded-t-2xl ${
                  isExpanded ? "" : "rounded-b-2xl"
                } bg-white dark:bg-[#242b3d] hover:bg-slate-100/80 dark:hover:bg-white/5 active:bg-slate-100 dark:active:bg-white/10`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-slate-500/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4.5 w-4.5 text-slate-700 dark:text-slate-200" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {c.courseName || "General"}
                      {isAdmin && c.teachers.length > 0 && (
                        <span className="ml-2 text-[11px] font-medium text-slate-400 dark:text-slate-300">
                          · {c.teachers.join(", ")}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate mt-0.5">
                      {c.department}-{c.batch}-{c.section} · {c.days.length} day
                      {c.days.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Day rows (animated collapse/expand) */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                  isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
                aria-hidden={!isExpanded}
              >
                <div className="overflow-hidden min-h-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {c.days.map((d) => {
                  const absent = d.total - d.present;
                  const pct = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0;
                  return (
                    <button
                      key={d._id}
                      onClick={() =>
                        navigate(`/attendance/history/class/${d._id}`, {
                          state: { sessionName },
                        })
                      }
                      className="w-full flex items-center justify-between gap-4 px-5 py-3 cursor-pointer transition hover:bg-slate-100/70 dark:hover:bg-white/5 text-left group active:bg-slate-100 dark:active:bg-white/10"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Date badge */}
                        <div className="h-10 w-10 rounded-xl bg-slate-500/10 dark:bg-white/10 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-slate-700 dark:text-slate-200 uppercase leading-none">
                            {new Date(d.date).toLocaleString("default", { month: "short" })}
                          </span>
                          <span className="text-base font-extrabold text-slate-700 dark:text-slate-200 leading-tight">
                            {new Date(d.date).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{d.date}</p>
                          {isAdmin && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5 truncate">
                              by {d.takenByName || "—"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-500/15 text-slate-500 dark:text-slate-300 border border-slate-400/25">
                          {d.present}P · {absent}A · {pct}%
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
