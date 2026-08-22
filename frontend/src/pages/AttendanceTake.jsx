import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { studentApi, attendanceApi, metaApi } from "../api/endpoints";
import {
  CheckSquare,
  Sparkles,
  Check,
  X,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceTake() {
  const { teacher } = useAuth();
  const isAdmin = teacher?.role === "admin";
  const queryClient = useQueryClient();

  // Course context comes from the drill-down route (/attendance/take/class)
  const [searchParams] = useSearchParams();
  const department = searchParams.get("department") || "";
  const batch = searchParams.get("batch") || "";
  const section = searchParams.get("section") || "";
  const courseName = searchParams.get("courseName") || "";

  const [date, setDate] = useState(todayStr());
  const [quickInput, setQuickInput] = useState("");
  const [presentIds, setPresentIds] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Active session (used as sessionName on submit)
  const { data: sessionData } = useQuery({
    queryKey: ["meta", "sessions"],
    queryFn: () => metaApi.sessions(),
    enabled: !!teacher,
  });
  const activeSession = sessionData?.data?.activeSession || null;

  const filtersReady = Boolean(department && batch && section);

  // Roster query
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ["students", "roster", department, batch, section],
    queryFn: () => studentApi.list({ department, batch, section, limit: 300 }),
    enabled: !!teacher && filtersReady,
  });
  const students = studentsData?.data?.students || [];

  // Existing session pre-fill
  const { data: existingSession } = useQuery({
    queryKey: ["attendance", "session", department, batch, section, date, courseName],
    queryFn: () => attendanceApi.session({ department, batch, section, date, courseName }),
    enabled: !!teacher && filtersReady && Boolean(date),
  });

  // Populate present state
  useEffect(() => {
    const session = existingSession?.data?.session;
    if (session) {
      const present = new Set(
        session.records
          .filter((r) => r.status === "present")
          .map((r) => (r.student?._id ? r.student._id : r.student))
      );
      setPresentIds(present);
    } else if (students.length > 0) {
      setPresentIds(new Set());
    }
  }, [existingSession, students]);

  // Quick roll selection
  const handleQuickSelect = (e) => {
    if (e) e.preventDefault();
    if (!quickInput.trim()) return toast.error("Enter roll digits first");
    if (students.length === 0) return toast.error("No students loaded");

    const tokens = quickInput.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) return;

    const matchedSet = new Set(presentIds);
    let count = 0;
    let already = 0;
    tokens.forEach((token) => {
      const padded = token.padStart(2, "0");
      students.forEach((s) => {
        const sid = String(s.studentId || "");
        if (sid === token || sid.endsWith(padded)) {
          if (matchedSet.has(s._id)) already++;
          else { matchedSet.add(s._id); count++; }
        }
      });
    });

    setPresentIds(matchedSet);
    if (count > 0) toast.success(`Marked ${count} student(s) present`);
    else if (already > 0) toast("Already selected", { icon: "ℹ️" });
    else toast("No matching students found", { icon: "ℹ️" });
  };

  const toggleStudent = (id) => {
    setPresentIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markAll = (present) => {
    setPresentIds(present ? new Set(students.map((s) => s._id)) : new Set());
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      attendanceApi.submit({
        date, department, batch, section, courseName,
        sessionName: activeSession?.name || "",
        records: students.map((s) => ({
          student: s._id,
          status: presentIds.has(s._id) ? "present" : "absent",
        })),
      }),
    onSuccess: () => {
      toast.success("Attendance recorded!");
      queryClient.invalidateQueries(["attendance"]);
      setConfirmOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Submit failed");
      setConfirmOpen(false);
    },
  });

  const presentCount = presentIds.size;
  const absentCount = students.length - presentCount;

  // Admin guard
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
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/attendance/take"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Courses
          </Link>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <CheckSquare className="h-6 w-6 text-slate-700 dark:text-slate-200" />
            {courseName || "General"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
              {department}-{batch}-{section}
            </span>
            {activeSession && (
              <>
                <span>·</span>
                <span>{activeSession.name}</span>
              </>
            )}
          </p>
        </div>

        {/* Date picker */}
        <div className="w-full sm:w-44">
          <label className="block font-semibold text-slate-500 dark:text-slate-300 mb-1 uppercase tracking-wider text-[10px]">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="glass-input font-mono w-full"
          />
        </div>
      </div>

      {/* Roster */}
      {!filtersReady ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          No course selected. Pick a course from the courses page.
        </div>
      ) : loadingStudents ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400">
          Loading roster for {department}-{batch}-{section}…
        </div>
      ) : students.length === 0 ? (
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400">
          No enrolled students found in {department}-{batch}-{section}.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick Roll Input */}
          <div className="glass-card p-4 rounded-2xl border border-slate-400/20 dark:border-white/15 bg-gradient-to-r from-slate-500/10 dark:from-white/5 to-transparent">
            <form onSubmit={handleQuickSelect} className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <textarea
                  rows={2}
                  placeholder="Quick select by last digits e.g. 1, 2, 33, 45"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleQuickSelect();
                    }
                  }}
                  className="block w-full pl-10 pr-11 py-2 rounded-xl text-xs glass-input font-mono resize-none"
                />
                {quickInput && (
                  <button
                    type="button"
                    onClick={() => setQuickInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button type="submit" className="glass-btn-primary px-5 py-2 text-xs shrink-0 self-start">
                <Check className="h-3.5 w-3.5" /> Select
              </button>
            </form>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 glass-card px-4 py-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <button onClick={() => markAll(true)} className="glass-btn-secondary text-xs py-1.5 px-3">
                All Present
              </button>
              <button onClick={() => markAll(false)} className="glass-btn-secondary text-xs py-1.5 px-3">
                All Absent
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="px-3 py-1 rounded-full bg-slate-500/15 text-slate-500 dark:text-slate-300 border border-slate-400/25">
                {presentCount} Present
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-500/15 text-slate-500 dark:text-slate-300 border border-slate-400/25">
                {absentCount} Absent
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/25">
                {students.length} Total
              </span>
            </div>
          </div>

          {/* Student List */}
          <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {students.map((s) => {
                const isPresent = presentIds.has(s._id);
                return (
                  <div
                    key={s._id}
                    onClick={() => toggleStudent(s._id)}
                    className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors ${
                      isPresent
                        ? "bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/10"
                        : "hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition ${
                        isPresent
                          ? "bg-slate-700 border-slate-700 dark:bg-white dark:border-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {isPresent && <Check className="h-3 w-3 text-white dark:text-slate-900" strokeWidth={3} />}
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-300 w-28 shrink-0">
                        {s.studentId}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {s.name}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isPresent
                        ? "bg-slate-700 text-white shadow-sm dark:bg-white dark:text-slate-900 border-slate-700 dark:border-white"
                        : "bg-slate-500/15 text-slate-500 dark:text-slate-300 border-slate-400/25"
                    }`}>
                      {isPresent ? "P" : "A"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              onClick={() => setConfirmOpen(true)}
              className="glass-btn-primary px-8 py-3 text-sm font-semibold"
            >
              Submit Attendance
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-700/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/20 relative bg-white/95 dark:bg-[#242b3d]/95">
            <button onClick={() => setConfirmOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-1">
              Confirm Submission
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 mb-4">
              <strong>{department}-{batch}-{section}</strong> · {date}
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700 text-xs space-y-2 mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500">Present</span>
                <span className="font-bold text-slate-600">{presentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Absent</span>
                <span className="font-bold text-slate-600">{absentCount}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-900 dark:text-white">{students.length}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} className="glass-btn-secondary">Cancel</button>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="glass-btn-primary"
              >
                {submitMutation.isPending ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
