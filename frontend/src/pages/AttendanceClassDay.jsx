import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  Edit3,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { attendanceApi } from "../api/endpoints";

export default function AttendanceClassDay() {
  const { id } = useParams();
  const { teacher } = useAuth();
  const isAdmin = teacher?.role === "admin";
  const queryClient = useQueryClient();

  const [editPresent, setEditPresent] = useState(null); // null = not editing, Set = editing
  const [confirmSave, setConfirmSave] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["attendance", "history-detail", id],
    queryFn: () => attendanceApi.historyDetail(id),
  });
  const session = data?.data?.session || null;

  const updateMutation = useMutation({
    mutationFn: ({ records }) => attendanceApi.updateSession(id, { records }),
    onSuccess: () => {
      toast.success("Attendance updated!");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setConfirmSave(false);
      setEditPresent(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Update failed"),
  });

  const toggleStudent = (sid) => {
    if (isAdmin || !editPresent) return;
    setConfirmSave(false);
    setEditPresent((prev) => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  };

  const saveEdit = () => {
    if (!session || !editPresent) return;
    const records = session.records.map((r) => ({
      student: r.student?._id || r.student,
      status: editPresent.has(r.student?._id || r.student) ? "present" : "absent",
    }));
    updateMutation.mutate({ records });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Loading attendance…
        </div>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="glass-card p-16 rounded-3xl text-center text-xs text-slate-400 border border-slate-200/80 dark:border-slate-800">
          Attendance record not found or you do not have access to it.
        </div>
        <div className="text-center">
          <Link
            to="/attendance/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to history
          </Link>
        </div>
      </div>
    );
  }

  const presentCount = editPresent ? editPresent.size : session.records.filter((r) => r.status === "present").length;
  const absentCount = session.records.length - presentCount;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to={`/attendance/history/${encodeURIComponent(session.sessionName || "")}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to classes
        </Link>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5 font-mono">
          <CalendarDays className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          {session.date}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <BookOpen className="h-3 w-3 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {session.department}-{session.batch}-{session.section}
          </span>
          <span>·</span>
          <span>{session.courseName || "General"}</span>
          {(isAdmin || editPresent !== null) && (
            <>
              <span>·</span>
              <span>
                taken by {session.takenBy?.name || "—"}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Status banner / actions */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {isAdmin ? (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 inline-flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            View only — administrators cannot modify attendance
          </span>
        ) : editPresent === null ? (
          <button
            onClick={() =>
              setEditPresent(
                new Set(
                  session.records
                    .filter((r) => r.status === "present")
                    .map((r) => r.student?._id || r.student)
                )
              )
            }
            className="glass-btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <Edit3 className="h-3 w-3" />
            Edit Attendance
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 inline-flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            Click rows to toggle status
          </span>
        )}
        <div className="flex items-center gap-2.5 text-xs font-bold">
          <span className="px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-400/25">
            {presentCount}P
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-400/25">
            {absentCount}A
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/25">
            {session.records.length} Total
          </span>
        </div>
      </div>

      {/* Student rows */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-500/[0.06] dark:bg-white/[0.04] border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 w-28 shrink-0">
              ID
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 flex-1 min-w-0">
              Name
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 w-9 text-center mr-2">
              Status
            </span>
          </div>
        </div>
        {session.records.map((r, idx) => {
          const sid = r.student?._id || r.student;
          const isPresent = editPresent ? editPresent.has(sid) : r.status === "present";
          const clickable = !isAdmin && editPresent !== null;
          return (
            <div
              key={idx}
              onClick={() => toggleStudent(sid)}
              role={clickable ? "button" : undefined}
              className={`flex items-center justify-between px-5 py-3 transition-colors ${
                clickable ? "cursor-pointer" : "cursor-default"
              } ${
                isPresent
                  ? "bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/10"
                  : "hover:bg-slate-100/70 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition ${
                    isPresent
                      ? "bg-slate-700 border-slate-700 dark:bg-white dark:border-white"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {isPresent && <Check className="h-3 w-3 text-white dark:text-slate-900" strokeWidth={3} />}
                </div>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-300 w-28 shrink-0">
                  {r.student?.studentId || "—"}
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {r.student?.name || "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`w-9 text-center px-1 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border mr-2 ${
                    isPresent
                      ? "bg-slate-700 text-white shadow-sm dark:bg-white dark:text-slate-900 border-slate-700 dark:border-white"
                      : "bg-slate-500/15 text-slate-500 dark:text-slate-300 border-slate-400/25"
                  }`}
                >
                  {isPresent ? "P" : "A"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit footer */}
      {!isAdmin && editPresent !== null && (
        <div className="flex justify-end items-center gap-3">
          {confirmSave ? (
            <>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 mr-auto flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                Overwrite the existing record for {session.date}?
              </span>
              <button onClick={() => setConfirmSave(false)} className="glass-btn-secondary">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={updateMutation.isPending}
                className="glass-btn-danger"
              >
                {updateMutation.isPending ? "Saving…" : "Yes, Overwrite"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditPresent(null);
                  setConfirmSave(false);
                }}
                className="glass-btn-secondary"
              >
                Close
              </button>
              <button
                onClick={() => setConfirmSave(true)}
                disabled={updateMutation.isPending}
                className="glass-btn-primary"
              >
                Save Changes
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
