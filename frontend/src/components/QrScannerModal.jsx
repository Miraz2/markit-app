import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QrScanner from "qr-scanner";
import qrWorkerUrl from "qr-scanner/qr-scanner-worker.min.js?url";
import { X, ScanLine, Zap, Camera } from "lucide-react";

QrScanner.WORKER_PATH = qrWorkerUrl;

function describeCameraError(e) {
  const raw = `${e?.name || ""} ${e?.message || e}`;
  if (/NotAllowed|Permission/i.test(raw)) {
    return {
      blocked: true,
      text:
        "Your browser blocked the camera without showing a prompt. Fix it on this phone:\n" +
        "1. Tap the lock / ⓘ icon beside the address bar \u2192 Permissions \u2192 Camera \u2192 Allow\n" +
        "2. Still stuck? Open phone Settings \u2192 Apps \u2192 your browser \u2192 enable Camera\n" +
        "3. Arrived via WhatsApp/Facebook? Use \u201cOpen in Chrome\u201d first.",
    };
  }
  if (/NotFound|Overconstrained/i.test(raw)) {
    return { text: "No usable camera was found on this device." };
  }
  if (/NotReadable|TrackStart/i.test(raw)) {
    return { text: "The camera seems busy. Close other apps that use it, then retry." };
  }
  return { text: "Couldn't start the camera. Try again, or use the Camera app tab." };
}

export default function QrScannerModal({ open, onClose }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("app"); // "app" = in-app live scan, "help" = external camera app
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [zoomRange, setZoomRange] = useState(null);
  const [zoomVal, setZoomVal] = useState(1);
  const [scanAttempt, setScanAttempt] = useState(0);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setMode("app");
      setError(null);
      setHasFlash(false);
      setFlashOn(false);
      setZoomRange(null);
      return;
    }
    if (mode !== "app") return;

    handledRef.current = false;

    if (!window.isSecureContext) {
      setError({
        text: "The camera needs a secure (https) connection. Open this page over https, or use the Camera app option.",
      });
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      setError(null);
      const video = videoRef.current;
      if (!video) return;
      try {
        const scanner = new QrScanner(video, handleDecode, {
          onDecodeError: () => {},
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 15,
        });
        scannerRef.current = scanner;
        await scanner.start();
        if (cancelled) return;
        try {
          setHasFlash(await scanner.hasFlash());
        } catch {}
        try {
          const track = video.srcObject?.getVideoTracks?.()[0];
          const caps = track?.getCapabilities?.();
          if (caps?.zoom && caps.zoom.max > caps.zoom.min) {
            setZoomRange({
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step || 0.1,
            });
            setZoomVal(track.getSettings()?.zoom ?? caps.zoom.min ?? 1);
          }
        } catch {}
      } catch (e) {
        if (!cancelled) setError(describeCameraError(e));
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => s.destroy())
          .catch(() => {});
      }
    };
  }, [open, mode, scanAttempt]);

  const handleDecode = (data) => {
    if (handledRef.current || !data) return;
    let token = null;
    try {
      token = new URL(data).searchParams.get("t");
    } catch {
      token = null;
    }
    if (!token && typeof data === "string" && data.includes("?")) {
      token = new URLSearchParams(data.slice(data.indexOf("?") + 1)).get("t");
    }
    if (!token) return;

    handledRef.current = true;
    navigate(`/attendance/scan?t=${encodeURIComponent(token)}`);
  };

  const applyZoom = async (v) => {
    setZoomVal(v);
    try {
      const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
      await track?.applyConstraints({ advanced: [{ zoom: Number(v) }] });
    } catch {}
  };

  const toggleFlash = async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      setFlashOn(await s.toggleFlash());
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-lift overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="text-base font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-indigo-500" />
            Scan Attendance
          </h3>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/10 rounded-full p-1.5 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 mx-5 mt-4 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06]">
          {[
            { id: "app", label: "In-app scanner", icon: ScanLine },
            { id: "help", label: "Camera app", icon: Camera },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                mode === id
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow"
                  : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {mode === "app" ? (
          <div className="px-5 pb-6 pt-4">
            <div className="relative w-full min-h-[260px] rounded-2xl overflow-hidden bg-black">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              {!error && (
                <p className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-[11px] font-semibold">
                    Fit the whole QR inside the frame
                  </span>
                </p>
              )}
            </div>

            {error && (
              <div
                className={`mt-3 p-3 rounded-xl border text-[11px] font-semibold whitespace-pre-line ${
                  error.blocked
                    ? "bg-red-50 dark:bg-red-500/10 border-red-300/70 dark:border-red-500/25 text-red-700 dark:text-red-300"
                    : "bg-amber-50 dark:bg-amber-500/10 border-amber-300/70 dark:border-amber-500/25 text-amber-700 dark:text-amber-300"
                }`}
              >
                {error.text}
                <button
                  onClick={() => setScanAttempt((a) => a + 1)}
                  className="ml-2 underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            )}

            {(zoomRange || hasFlash) && (
              <div className="mt-3 flex items-center gap-3">
                {zoomRange && (
                  <>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 shrink-0">
                      Zoom
                    </span>
                    <input
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step}
                      value={zoomVal}
                      onChange={(e) => applyZoom(e.target.value)}
                      className="flex-1 accent-indigo-600"
                      aria-label="Camera zoom"
                    />
                  </>
                )}
                {hasFlash && (
                  <button
                    onClick={toggleFlash}
                    title="Toggle flashlight"
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition ${
                      flashOn
                        ? "bg-amber-400 text-slate-900"
                        : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Light
                  </button>
                )}
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-300">
              Stay on this screen — verification continues after the scan.
            </p>
          </div>
        ) : (
          <div className="px-5 pb-6 pt-4 space-y-3">
            <ol className="space-y-3">
              {[
                "Leave this app and open your phone's built-in Camera app.",
                "Point it at the QR code on the classroom projector.",
                "Tap the link that appears — the attendance page opens automatically.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-200 pt-1">{step}</span>
                </li>
              ))}
            </ol>
            <p className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-300">
              Tip: choose &quot;Open in Chrome&quot; if your camera opens another browser — you must stay signed
              in here for the scan to count.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
