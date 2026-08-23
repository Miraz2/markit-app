import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "../api/endpoints";
import { History, CalendarDays, Search, UserCheck, Check, X } from "lucide-react";

export default function StudentPortalHistory() {
  const [searchParams] = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["portal", "history"],
    queryFn: () => portalApi.history(),
  });

  const history = data?.data?.history || [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | present | absent
  const [courseFilter, setCourseFilter] = useState(searchParams.get("course") || "all");
  const [sessionFilter, setSessionFilter] = useState(searchParams.get("session") || "all");

  const courseNames = useMemo(
    () => [...new Set(history.map((h) => h.courseName).filter(Boolean))].sort(),
    [history]
  );
  const sessionNames = useMemo(
    () => [...new Set(history.map((h) => h.sessionName).filter(Boolean))].sort().reverse(),
    [history]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((h) => {
      if (statusFilter !== "all" && h.status !== statusFilter) return false;
      if (courseFilter !== "all" && (h.courseName || "") !== courseFilter) return false;
      if (sessionFilter !== "all" && h.sessionName !== sessionFilter) return false;
      if (q && !(h.courseName || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [history, search, statusFilter, courseFilter, sessionFilter]);

  const presentCount = filtered.filter((h) => h.status === "present").length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <History className="h-7 w-7 text-slate-600" />
          My Class History
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          Every class day where your attendance was recorded.
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              Search Course
            </label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Course name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="glass-input w-full pl-8"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-input w-full"
            >
              <option value="all">All</option>
              <option value="present">Present only</option>
              <option value="absent">Absent only</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              Course
            </label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="glass-input w-full"
            >
              <option value="all">All courses</option>
              {!courseNames.includes(courseFilter) && courseFilter !== "all" && (
                <option value={courseFilter}>{courseFilter}</option>
              )}
              {courseNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              Session
            </label>
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="glass-input w-full"
            >
              <option value="all">All sessions</option>
              {!sessionNames.includes(sessionFilter) && sessionFilter !== "all" && (
                <option value={sessionFilter}>{sessionFilter}</option>
              )}
              {sessionNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {(search || statusFilter !== "all" || courseFilter !== "all" || sessionFilter !== "all") && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setCourseFilter("all");
              setSessionFilter("all");
            }}
            className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Loading your records…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 rounded-3xl text-center space-y-2 border border-slate-200/80 dark:border-slate-800">
          <CalendarDays className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-500" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No matching records</p>
          <p className="text-xs text-slate-400">Try changing the filters above.</p>
        </div>
      ) : (
        <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recorded Days</h3>
            <span className="text-xs text-slate-500">
              {filtered.length} day{filtered.length === 1 ? "" : "s"} ·{" "}
              <span className="text-emerald-600 dark:text-emerald-300 font-bold">{presentCount} present</span>{" "}
              · <span className="text-red-500 dark:text-red-300 font-bold">{filtered.length - presentCount} absent</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Course</th>
                  <th className="px-3 py-3 hidden sm:table-cell">Session</th>
                  <th className="px-3 py-3 hidden md:table-cell">Marked By</th>
                  <th className="px-3 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr
                    key={`${h.id}-${h.courseName}`}
                    className="hover:bg-slate-500/5 dark:hover:bg-white/5 border-b border-slate-100 dark:border-slate-800/60 transition"
                  >
                    <td className="px-3 py-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {h.date}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {h.courseName || "General"}
                    </td>
                    <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{h.sessionName}</td>
                    <td className="px-3 py-3 text-slate-500 hidden md:table-cell">
                      {h.markedBy ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                          {h.markedBy}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1.5 px-2.5 py-0.5 rounded-full font-bold border text-[11px] ${
                          h.status === "present"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30"
                        }`}
                      >
                        {h.status === "present" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {h.status === "present" ? "Present" : "Absent"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
