import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { X, ScanLine, Zap, Camera } from "lucide-react";

const REGION_ID = "markit-qr-scan-region";

export default function QrScannerModal({ open, onClose }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("app"); // "app" = in-app live scan, "help" = external camera app
  const [error, setError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const instRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setMode("app");
      setError(null);
      setTorchOn(false);
      return;
    }
    if (mode !== "app") return;

    handledRef.current = false;
    setError(null);

    if (!window.isSecureContext) {
      setError(
        "The camera needs a secure (https) connection. Open this page over https, or use the Camera app option."
      );
      return;
    }

    const inst = new Html5Qrcode(REGION_ID, { verbose: false });
    instRef.current = inst;
    const view = document.getElementById(REGION_ID);
    const box = Math.max(160, Math.floor(Math.min(((view?.clientWidth || 300) * 0.75), 260)));

    inst
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: box, height: box } },
        handleDecode,
        () => {}
      )
      .then(() => {
        try {
          const caps = inst.getRunningTrackCapabilities();
          setTorchSupported(Boolean(caps && "torch" in caps));
        } catch {
          setTorchSupported(false);
        }
      })
      .catch((e) => {
        const msg = String(e?.message || e);
        setError(
          /permission|NotAllowed/i.test(msg)
            ? "Camera permission denied. Allow it in your browser settings, or use the Camera app option."
            : /NotFound|Overconstrained|no camera/i.test(msg)
            ? "No back camera was found on this device."
            : "Couldn't start the camera. Use the Camera app option instead."
        );
      });

    return () => {
      const running = instRef.current;
      instRef.current = null;
      if (running) {
        running
          .stop()
          .then(() => running.clear())
          .catch(() => {});
      }
    };
  }, [open, mode]);

  const handleDecode = (text) => {
    if (handledRef.current) return;
    let token = null;
    try {
      token = new URL(text).searchParams.get("t");
    } catch {
      token = null;
    }
    if (!token && typeof text === "string" && text.includes("?")) {
      token = new URLSearchParams(text.slice(text.indexOf("?") + 1)).get("t");
    }
    if (!token) return; // not a MarkIt attendance code — keep scanning

    handledRef.current = true;
    navigate(`/attendance/scan?t=${encodeURIComponent(token)}`);
  };

  const toggleTorch = async () => {
    const inst = instRef.current;
    if (!inst || !torchSupported) return;
    try {
      await inst.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch {
      setTorchSupported(false);
    }
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

        {/* Mode switch */}
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
            <div className="relative w-full min-h-[260px] rounded-2xl overflow-hidden bg-black [&_video]:w-full [&_video]:object-cover">
              <div id={REGION_ID} className="w-full" />
              {!error && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-[11px] font-semibold">
                    Point at the projector&apos;s QR code
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300/70 dark:border-amber-500/25 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                {error}
                <button onClick={() => window.location.reload()} className="ml-2 underline underline-offset-2">
                  Retry
                </button>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-300">
                Stay on this screen — verification continues after the scan.
              </p>
              {torchSupported && (
                <button
                  onClick={toggleTorch}
                  title="Toggle flashlight"
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition ${
                    torchOn
                      ? "bg-amber-400 text-slate-900"
                      : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200"
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Light
                </button>
              )}
            </div>
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
