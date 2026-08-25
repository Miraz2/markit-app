import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { portalApi } from "../api/endpoints";
import QrScannerModal from "../components/QrScannerModal";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarX,
  Percent,
  BookOpen,
  AlertTriangle,
  KeyRound,
  History,
  ArrowRight,
  ScanLine,
} from "lucide-react";

function StatWidget({ title, value, subtitle, icon: Icon, bgGradient }) {
  return (
    <div
      className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br ${bgGradient} text-white shadow-lg border border-white/10 hover:shadow-xl hover:scale-[1.01] transition-all duration-300 group flex flex-col justify-between h-36`}
    >
      {/* Absolute positioned translucent large icon */}
      <div className="absolute right-4 bottom-6 text-white/15 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 pointer-events-none">
        <Icon className="h-16 w-16 shrink-0 stroke-[1.2]" />
      </div>

      <div className="relative z-10">
        <p className="text-[11px] font-semibold tracking-wider text-white/80 uppercase">{title}</p>
        <p className="text-3xl font-extrabold font-display mt-2 tracking-tight">{value}</p>
      </div>

      <div className="relative z-10 mt-auto">
        <p className="text-[10px] font-medium text-white/70">{subtitle}</p>
      </div>
    </div>
  );
}

export default function StudentPortalHome() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["portal", "summary"],
    queryFn: () => portalApi.summary(),
  });

  const overall = data?.data?.overall || { present: 0, absent: 0, total: 0, percentage: 0 };
  const courses = data?.data?.courses || [];
  const lastMarkedDate = data?.data?.lastMarkedDate || null;

  // All courses this student's class is enrolled in (from teacher assignments),
  // regardless of whether attendance has been recorded yet.
  const { data: myCoursesData, isLoading: loadingMyCourses } = useQuery({
    queryKey: ["portal", "myCourses"],
    queryFn: () => portalApi.myCourses(),
  });
  const allCourses = myCoursesData?.data?.courses || [];

  // Attendance stats keyed by session+course, merged into the course list.
  const statsByCourse = useMemo(
    () => new Map(courses.map((c) => [`${c.sessionName}||${c.courseName || ""}`, c])),
    [courses]
  );

  // Every course the class is enrolled in (from teacher assignments), unioned
  // with any tracked course that no longer has an assignment.
  const mergedCourses = useMemo(() => {
    const map = new Map();
    for (const c of allCourses) {
      map.set(`${c.sessionName}||${c.courseName}`, { ...c });
    }
    for (const c of courses) {
      const key = `${c.sessionName}||${c.courseName || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          sessionName: c.sessionName,
          courseName: c.courseName || "",
          teachers: [],
          isActiveSession: false,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.sessionName.localeCompare(a.sessionName) || a.courseName.localeCompare(b.courseName)
    );
  }, [allCourses, courses]);

  const goToHistory = (c) =>
    navigate(
      `/portal/history?course=${encodeURIComponent(c.courseName)}&session=${encodeURIComponent(c.sessionName)}`
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Must-change-password banner */}
      {student?.mustChangePassword && (
        <Link
          to="/portal/profile"
          className="flex items-start sm:items-center gap-3 p-4 rounded-2xl border border-amber-300/70 bg-amber-50/80 dark:border-amber-500/25 dark:bg-amber-500/[0.08] transition hover:bg-amber-100/80 dark:hover:bg-amber-500/[0.14]"
        >
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              You are using a temporary password
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
              Please set your own password to secure your account.
            </p>
          </div>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold shrink-0">
            <KeyRound className="h-3.5 w-3.5" />
            Change now
          </span>
        </Link>
      )}

      {/* Header */}
      <div>
        <h1 className="text-4xl sm:text-2xl font-extrabold font-display tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
          <LayoutDashboard className="h-7 w-7 text-slate-600" />
          Dashboard
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          {student?.name} · <span className="font-mono">{student?.studentId}</span> ·{" "}
          {student?.department}-{student?.batch}-{student?.section}
          {lastMarkedDate && <> · Last marked {lastMarkedDate}</>}
        </p>
      </div>

      {/* Scan Attendance action */}
      <button
        onClick={() => setScanOpen(true)}
        className="w-full flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#4f46e5] via-indigo-500 to-violet-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300"
      >
        <span className="p-3 rounded-xl bg-white/15 shrink-0">
          <ScanLine className="h-6 w-6" />
        </span>
        <span className="text-left flex-1 min-w-0">
          <span className="block text-sm font-bold">Scan Attendance</span>
          <span className="block text-xs text-white/80 mt-0.5">
            Point your camera at the class QR code to mark yourself present
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </button>

      {isLoading ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Loading your attendance…
        </div>
      ) : (
        <>
          {/* Overall stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatWidget
              icon={Percent}
              title="Overall Attendance"
              value={`${overall.percentage}%`}
              subtitle={`across ${overall.total} recorded classes`}
              bgGradient="from-[#2563eb] via-[#3b82f6] to-[#60a5fa]"
            />
            <StatWidget
              icon={BookOpen}
              title="Courses Tracked"
              value={mergedCourses.length}
              subtitle="Total courses assigned to your class"
              bgGradient="from-[#11b877] via-[#14c9a2] to-[#1ad1c8]"
            />
            <StatWidget
              icon={CalendarCheck}
              title="Days Present"
              value={overall.present}
              subtitle="Classes you attended"
              bgGradient="from-[#f43f5e] to-[#ec4899]"
            />
            <StatWidget
              icon={CalendarX}
              title="Days Absent"
              value={overall.absent}
              subtitle="Classes you missed"
              bgGradient="from-[#ffb03a] via-[#ff8d52] to-[#ff6b6b]"
            />
          </div>

          {/* Course-wise breakdown */}
          <div className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                Course-wise Breakdown
              </h3>
              <Link
                to="/portal/history"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
              >
                <History className="h-3.5 w-3.5" />
                View class history
              </Link>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
              Select a course below to view your full class history for it.
            </p>

            {loadingMyCourses ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading your courses…</div>
            ) : mergedCourses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No courses assigned to your class yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mergedCourses.map((c) => {
                  const stats = statsByCourse.get(`${c.sessionName}||${c.courseName}`);
                  return (
                    <button
                      key={`${c.sessionName}-${c.courseName}`}
                      onClick={() => goToHistory(c)}
                      title={`View history for ${c.courseName || "General"}`}
                      className="p-5 rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800 hover:border-slate-400/60 hover:shadow-lg hover:scale-[1.01] transition-[transform,box-shadow,border-color] duration-150 transform-gpu group flex flex-col justify-between text-left"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-500/10 text-slate-500 dark:text-slate-300 font-mono font-bold text-xs truncate">
                            {c.sessionName}
                          </span>
                          {stats && (
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-[11px] border shrink-0 ${
                                stats.percentage >= 75
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                                  : stats.percentage < 50
                                  ? "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {stats.percentage}%
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {c.courseName || "General"}
                        </h4>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        <span className="truncate font-normal">
                          {stats
                            ? `${stats.present} present · ${stats.absent} absent · ${stats.total} days`
                            : c.isActiveSession
                            ? "No attendance yet"
                            : "Previous session"}
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <QrScannerModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}
