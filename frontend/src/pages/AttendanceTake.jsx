import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { studentApi, attendanceApi, metaApi, webauthnApi } from "../api/endpoints";
import {
  CheckSquare,
  Sparkles,
  Check,
  X,
  ShieldAlert,
  ArrowLeft,
  QrCode,
  RefreshCw,
  Fingerprint,
  ScanLine,
  MapPin,
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

  // Dynamic QR projection
  const [qrOpen, setQrOpen] = useState(false);
  const [qrImg, setQrImg] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [scanFeed, setScanFeed] = useState([]);
  const [qrNonce, setQrNonce] = useState(0);
  const seenScanIdsRef = useRef(new Set());
  const activeTicketRef = useRef(null);

  // Classroom GPS anchor — captured when the projection opens so scans can be
  // distance-checked against the room (anti video-call relay). Teacher-toggled;
  // the choice persists between sessions.
  const [geoCheckEnabled, setGeoCheckEnabled] = useState(
    () => localStorage.getItem("markit.qrGpsCheck") !== "off"
  );
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | pending | locked | off
  const [classLoc, setClassLoc] = useState(null);
  const [geoRadius, setGeoRadius] = useState(150);

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

  // Anchor the classroom position once per projection (or whenever the
  // teacher toggles the GPS requirement mid-session — ticket rotation picks
  // up the change). The QR effect waits for this so no mismatched ticket is
  // ever projected.
  useEffect(() => {
    if (!qrOpen) return;
    setClassLoc(null);
    if (!geoCheckEnabled || !("geolocation" in navigator)) {
      setGeoStatus("off");
      return;
    }
    setGeoStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClassLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus("locked");
      },
      () => setGeoStatus("off"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  }, [qrOpen, geoCheckEnabled]);

  const toggleGeoCheck = () => {
    setGeoCheckEnabled((v) => {
      const next = !v;
      localStorage.setItem("markit.qrGpsCheck", next ? "on" : "off");
      return next;
    });
  };

  // Dynamic QR: fresh short ticket every 10s + live polling of verified scans.
  // A verified scan only auto-selects the student's row here — nothing is
  // written to the database until the teacher reviews and submits manually.
  useEffect(() => {
    if (!qrOpen || !department || !batch || !section || geoStatus === "pending") return;

    const qrParams = { department, batch, section, courseName, date };
    if (classLoc) {
      qrParams.latitude = classLoc.latitude;
      qrParams.longitude = classLoc.longitude;
    }
    let cancelled = false;

    const refreshQr = async () => {
      try {
        const { data } = await webauthnApi.classQr(qrParams);
        if (cancelled) return;
        activeTicketRef.current = data.ticketId;
        setGeoRadius(data.radiusMeters || 150);
        const img = await QRCode.toDataURL(data.url, { width: 1024, margin: 2 });
        if (cancelled) return;
        setQrImg(img);
        setSecondsLeft(Math.max(1, Math.ceil(data.expiresInMs / 1000)));
      } catch (err) {
        if (!cancelled) toast.error(err.response?.data?.message || "Failed to generate QR code");
      }
    };

    const pollScans = async () => {
      try {
        const { data } = await webauthnApi.recentScans(qrParams);
        if (cancelled || !Array.isArray(data.scans)) return;
        const fresh = data.scans.filter((s) => !seenScanIdsRef.current.has(String(s.student)));
        if (fresh.length === 0) return;
        setPresentIds((prev) => {
          const next = new Set(prev);
          fresh.forEach((s) => next.add(s.student));
          return next;
        });
        fresh.forEach((s) => seenScanIdsRef.current.add(String(s.student)));
        setScanFeed((prev) => [...[...fresh].reverse(), ...prev].slice(0, 8));
        toast.success(`${fresh.map((s) => s.name).join(", ")} verified ✓`);
      } catch {
        // transient poll failure — next tick retries
      }
    };

    refreshQr();
    pollScans();
    const qrTimer = setInterval(refreshQr, 10000);
    const scanTimer = setInterval(pollScans, 3000);
    const tickTimer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);

    return () => {
      cancelled = true;
      clearInterval(qrTimer);
      clearInterval(scanTimer);
      clearInterval(tickTimer);
      // Revoke the outstanding ticket immediately so closed/expired projections
      // can't be scanned during the remaining TTL window.
      const ticketId = activeTicketRef.current;
      activeTicketRef.current = null;
      if (ticketId) webauthnApi.classQrClose({ ticketId }).catch(() => {});
    };
  }, [qrOpen, department, batch, section, courseName, date, qrNonce, geoStatus, classLoc]);

  const closeQrModal = () => {
    setQrOpen(false);
    setQrImg(null);
    setScanFeed([]);
    seenScanIdsRef.current = new Set();
  };

  const refreshQrNow = () => {
    setSecondsLeft(10);
    setQrNonce((n) => n + 1);
  };

  // Quick roll selection
  const handleQuickSelect = (e) => {    if (e) e.preventDefault();
    if (!quickInput.trim()) return toast.error("Enter roll digits first");
    if (students.length === 0) return toast.error("No students loaded");

    const tokens = quickInput.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) return;

    const matchedSet = new Set(presentIds);
    let count = 0;
    let already = 0;
    const missed = [];

    const batchStr = String(batch || "");
    tokens.forEach((token) => {
      const raw = token.replace(/\D/g, "");
      if (!raw) return;

      // Token interpretation (batch 68, rolls like 202411068 + 0 + 013):
      //   13 / 013  → current batch serial 13 → matches only 2024110680013
      //   33 / 033 / 68033 → batch 68 serial 33 → matches only 2024110680033
      //   64033     → another batch's tail → matched literally as typed
      let core = raw.replace(/^0+/, "");
      if (batchStr && core.startsWith(batchStr)) {
        core = core.slice(batchStr.length).replace(/^0+/, "") || "";
      }

      const tail =
        core === ""
          ? null
          : core.length <= 3
            ? batchStr
              ? new RegExp(`${batchStr}0+${core}$`)
              : new RegExp(`0+${core}$`)
            : null;
      const literalTail = core.length > 3 ? core : null;

      let tokenHit = false;
      students.forEach((s) => {
        const sid = String(s.studentId || "");
        const hit =
          sid === raw ||
          Boolean(tail && tail.test(sid)) ||
          Boolean(literalTail && sid.endsWith(literalTail));
        if (hit) {
          tokenHit = true;
          if (matchedSet.has(s._id)) already++;
          else { matchedSet.add(s._id); count++; }
        }
      });
      if (!tokenHit) missed.push(token);
    });

    setPresentIds(matchedSet);
    const missedNote = missed.length ? ` · no match: ${missed.join(", ")}` : "";
    if (count > 0) toast.success(`Marked ${count} student(s) present${missedNote}`);
    else if (already > 0) toast(`Already selected${missedNote}`, { icon: "ℹ️" });
    else toast(`No matching students found${missedNote.replace(" · no match: ", " for: ")}`, { icon: "ℹ️" });
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
            <form onSubmit={handleQuickSelect} className="flex flex-col gap-2 sm:flex-row">
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
                  className="block w-full pl-10 pr-11 py-2 rounded-xl text-xs glass-input font-mono resize-none min-h-[4.75rem] sm:min-h-0"
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
              <button
                type="submit"
                className="glass-btn-primary px-5 py-2 text-xs shrink-0 w-full sm:w-auto justify-center"
              >
                <Check className="h-3.5 w-3.5" /> Select
              </button>
            </form>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 glass-card px-4 py-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <button onClick={() => setQrOpen(true)} className="glass-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5" />
                Project Dynamic QR
              </button>
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

      {/* Dynamic QR Projection Modal — full-screen so the code is scannable
          from across the room */}
      {qrOpen &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 backdrop-blur-xl overflow-y-auto">
            {/* Header */}
            <div className="shrink-0 flex items-start justify-between px-4 sm:px-6 pt-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold font-display text-white flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-emerald-400" />
                  Scan to Mark Present
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 font-mono">
                  {department}-{batch}-{section} · {courseName || "General"} · {date}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {geoStatus === "locked" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                      <MapPin className="h-3 w-3" />
                      In-classroom only · {geoRadius} m
                    </span>
                  )}
                  {!geoCheckEnabled && geoStatus !== "pending" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 text-slate-400">
                      <MapPin className="h-3 w-3" />
                      GPS check off
                    </span>
                  )}
                  {geoCheckEnabled && geoStatus === "off" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      <MapPin className="h-3 w-3" />
                      No GPS — relay check off
                    </span>
                  )}
                  {geoStatus === "pending" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 text-slate-300">
                      <MapPin className="h-3 w-3 animate-pulse" />
                      Locking location…
                    </span>
                  )}
                  <button
                    onClick={toggleGeoCheck}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white transition"
                  >
                    <span
                      className={`relative h-4 w-7 rounded-full transition-colors ${
                        geoCheckEnabled ? "bg-emerald-500/80" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                          geoCheckEnabled ? "left-3.5" : "left-0.5"
                        }`}
                      />
                    </span>
                    Require GPS presence
                  </button>
                </div>
              </div>
              <button
                onClick={closeQrModal}
                className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Giant QR + live verification list side by side */}
            <div className="flex-1 min-h-0 w-full flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 py-1.5 px-4">
              {/* QR column */}
              <div className="flex flex-col items-center min-h-0">
                <div className="relative p-2 sm:p-2.5 bg-white rounded-[1.75rem] shadow-2xl w-[min(calc(100vh_-_9.5rem),94vw)] md:w-[min(calc(100vh_-_9.5rem),48vw)]">
                  {qrImg ? (
                    <img src={qrImg} alt="Attendance QR" className="block w-full h-auto rounded-xl" />
                  ) : (
                    <div className="aspect-square w-full flex items-center justify-center text-sm text-slate-400 font-semibold">
                      Generating…
                    </div>
                  )}
                  {qrImg && secondsLeft <= 3 && (
                    <div className="absolute inset-0 rounded-[1.75rem] border-4 border-amber-400 animate-pulse pointer-events-none" />
                  )}
                </div>

                <div className="mt-2 flex flex-col items-center gap-1 w-[min(calc(100vh_-_9.5rem),94vw)] md:w-[min(calc(100vh_-_9.5rem),48vw)]">
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(secondsLeft / 10) * 100}%` }}
                    />
                  </div>
                  <div className="w-full flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-300">
                      Refreshes in {secondsLeft}s
                    </p>
                    <button
                      onClick={refreshQrNow}
                      className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh now
                    </button>
                  </div>
                </div>
              </div>

              {/* Scanned students — right of the QR on wide screens, below on small */}
              <div className="w-full md:w-80 xl:w-96 shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Fingerprint className="h-3.5 w-3.5" />
                  Live verifications
                  {scanFeed.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px]">
                      {scanFeed.length}
                    </span>
                  )}
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/5 md:max-h-[26rem] overflow-y-auto">
                  {scanFeed.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      Waiting for students to scan…
                    </p>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {scanFeed.map((s) => (
                        <li key={`${s.student}-${s.at}`} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="h-7 w-7 shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />
                          </span>
                          <span className="font-mono text-xs font-bold text-white">{s.roll}</span>
                          <span className="text-xs text-slate-400 truncate">{s.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="mt-2 text-[10px] text-slate-500 leading-relaxed hidden md:block">
                  Verified students are auto-selected in your list. Review everything, then hit
                  Submit Attendance.
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
