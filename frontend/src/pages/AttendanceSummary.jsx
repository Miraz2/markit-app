import { useState, useMemo, Fragment, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { attendanceApi, reportApi } from "../api/endpoints";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
} from "lucide-react";

export default function AttendanceSummary() {
  // Class context comes from the drill-down route (/attendance/summary/:sessionName/class)
  const { sessionName: rawSessionName } = useParams();
  const [searchParams] = useSearchParams();
  const sessionName = decodeURIComponent(rawSessionName || "");
  const department = searchParams.get("department") || "";
  const batch = searchParams.get("batch") || "";
  const section = searchParams.get("section") || "";
  const courseName = searchParams.get("courseName") || "";

  const [search, setSearch] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtersReady = Boolean(department && batch && section);

  // Fetch the full class summary once — filtering happens client-side
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ["attendance", "summary", department, batch, section, sessionName, courseName],
    queryFn: () =>
      attendanceApi.summary({
        department,
        batch,
        section,
        sessionName: sessionName || undefined,
        courseName: courseName || undefined,
      }),
    enabled: filtersReady,
  });

  const allStudents = summaryData?.data?.summary || [];
  const sessions = summaryData?.data?.sessions || [];

  // Default range: first recorded day of this class → today
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDate = useMemo(() => {
    if (sessions.length === 0) return "";
    return sessions.reduce((min, s) => (s.date < min ? s.date : min), sessions[0].date);
  }, [sessions]);

  const rangeInitRef = useRef("");
  useEffect(() => {
    const key = `${department}|${batch}|${section}|${courseName}|${sessionName}`;
    if (sessions.length > 0 && rangeInitRef.current !== key) {
      rangeInitRef.current = key;
      setFromDate(firstDate);
      setToDate(todayStr);
    }
  }, [sessions, firstDate, department, batch, section, courseName, sessionName]);

  // Date-range filter (YYYY-MM-DD strings compare correctly as text)
  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) => (!fromDate || s.date >= fromDate) && (!toDate || s.date <= toDate)
      ),
    [sessions, fromDate, toDate]
  );

  // Recompute per-student totals from the filtered sessions only
  const statsById = useMemo(() => {
    const map = new Map();
    for (const s of filteredSessions) {
      for (const r of s.records || []) {
        const sid = r.student?._id || r.student;
        const e = map.get(sid) || { present: 0, absent: 0, total: 0 };
        e.total += 1;
        if (r.status === "present") e.present += 1;
        else e.absent += 1;
        map.set(sid, e);
      }
    }
    return map;
  }, [filteredSessions]);

  // Client-side: roster + recomputed stats + name/ID search
  const summaryList = useMemo(() => {
    let list = allStudents.map((item) => {
      const st = statsById.get(item.student.id) || { present: 0, absent: 0, total: 0 };
      return {
        ...item,
        present: st.present,
        absent: st.absent,
        total: st.total,
        percentage: st.total > 0 ? Math.round((st.present / st.total) * 1000) / 10 : 0,
      };
    });
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (item) =>
          item.student?.name?.toLowerCase().includes(q) ||
          String(item.student?.studentId || "").toLowerCase().includes(q)
      );
    return list;
  }, [allStudents, statsById, search]);

  // Per-student day-by-day attendance from the filtered sessions
  const daysByStudent = useMemo(() => {
    const map = new Map();
    for (const s of filteredSessions) {
      for (const r of s.records || []) {
        const sid = r.student?._id || r.student;
        if (!map.has(sid)) map.set(sid, []);
        map.get(sid).push({ date: s.date, status: r.status });
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [filteredSessions]);

  const handleDownloadCsv = async () => {
    try {
      toast.loading("Generating CSV…");
      await reportApi.downloadSummaryCsv({
        department,
        batch,
        section,
        sessionName: sessionName || undefined,
        courseName: courseName || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      toast.dismiss();
      toast.success("CSV downloaded!");
    } catch {
      toast.dismiss();
      toast.error("Failed to download CSV");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      toast.loading("Generating PDF…");
      await reportApi.downloadSummaryPdf({
        department,
        batch,
        section,
        sessionName: sessionName || undefined,
        courseName: courseName || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      toast.dismiss();
      toast.success("PDF downloaded!");
    } catch {
      toast.dismiss();
      toast.error("Failed to download PDF");
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to={`/attendance/summary/${encodeURIComponent(sessionName)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to classes
          </Link>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-slate-700 dark:text-slate-200" />
            {courseName || "General"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {department}-{batch}-{section}
            </span>{" "}
            · {sessionName}
          </p>
        </div>
        {filtersReady && (
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadCsv} className="glass-btn-secondary text-xs">
              <FileSpreadsheet className="h-4 w-4 text-slate-600" /> CSV
            </button>
            <button onClick={handleDownloadPdf} className="glass-btn-primary text-xs">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="glass-input font-mono w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="glass-input font-mono w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
              Search Student
            </label>
            <input
              type="text"
              placeholder="Name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input w-full"
            />
          </div>
        </div>
        {(fromDate || toDate) && (
          <button
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          >
            Clear date range
          </button>
        )}
      </div>

      {/* Content */}
      {!filtersReady ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Select an assigned section above to view attendance analytics.
        </div>
      ) : isLoading ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400">
          Calculating attendance summary…
        </div>
      ) : (
        <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          {/* Student Summary Table */}
          <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Student Breakdown
              </h3>
              <span className="text-xs text-slate-500">
                {filteredSessions.length} day{filteredSessions.length === 1 ? "" : "s"} · {summaryList.length} students
              </span>
            </div>

            {summaryList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No attendance records found for this section.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="px-3 py-3">Roll ID</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3 text-center">Present</th>
                      <th className="px-3 py-3 text-center">Absent</th>
                      <th className="px-3 py-3 text-center">Total</th>
                      <th className="px-3 py-3 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryList.map((item) => {
                      const pct = item.percentage;
                      const isGood = pct >= 75;
                      const isLow = pct < 50;
                      const sid = item.student.id || item.student.studentId;
                      const isExpanded = expandedStudentId === sid;
                      const days = daysByStudent.get(item.student.id) || [];
                      return (
                        <Fragment key={sid}>
                          <tr
                            onClick={() => setExpandedStudentId(isExpanded ? null : sid)}
                            className={`cursor-pointer transition ${
                              isExpanded
                                ? "bg-slate-500/10 dark:bg-white/[0.07]"
                                : "hover:bg-slate-500/5 dark:hover:bg-white/5 border-b border-slate-100 dark:border-slate-800/60"
                            }`}
                          >
                            <td className="px-3 py-3 font-mono font-bold text-slate-900 dark:text-white">{item.student.studentId}</td>
                            <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-200">
                              {item.student.name}
                              {isExpanded && <span className="sr-only"> (expanded)</span>}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-600">{item.present}</td>
                            <td className="px-3 py-3 text-center font-bold text-slate-600">{item.absent}</td>
                            <td className="px-3 py-3 text-center text-slate-500 font-mono">{item.total}</td>
                            <td className="px-3 py-3 text-right">
                              <span className="inline-flex items-center justify-end gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-[11px] border ${
                                  isGood
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                                    : isLow
                                    ? "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30"
                                }`}>
                                  {pct}%
                                </span>
                                <ChevronDown
                                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-300 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </span>
                            </td>
                          </tr>
                          {/* Day-by-day detail (animated) */}
                          <tr aria-hidden={!isExpanded} className={isExpanded ? "border-b border-slate-100 dark:border-slate-800/60" : ""}>
                            <td colSpan={6} className="!p-0 align-top">
                              <div
                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                                  isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                }`}
                              >
                                <div className="overflow-hidden min-h-0">
                                  <div className="px-3 pb-4 bg-slate-500/[0.04] dark:bg-white/[0.03]">
                                    <div className="rounded-xl p-3">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                                        <CalendarDays className="h-3 w-3" />
                                        Day-by-day — {item.present} present · {item.absent} absent
                                      </p>
                                      {days.length === 0 ? (
                                        <p className="text-xs text-slate-400">No recorded days.</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {days.map((d) => (
                                            <span
                                              key={d.date}
                                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border font-mono text-[10px] ${
                                                d.status === "present"
                                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                                  : "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30"
                                              }`}
                                            >
                                              {d.date}
                                              <b>{d.status === "present" ? "P" : "A"}</b>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
