import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
} from "@simplewebauthn/browser";
import { webauthnApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/ui/Spinner";
import { Fingerprint, ShieldCheck, RefreshCw, QrCode, AlertTriangle, Check } from "lucide-react";

export default function ScanAttendance() {
  const { student } = useAuth();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId") || "";
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("starting");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [platformAvailable, setPlatformAvailable] = useState(true);
  const startedRef = useRef(false);

  const runVerification = async () => {
    if (!classId || !token) {
      setError({ kind: "invalid", message: "This link is incomplete. Scan the QR code again." });
      setStatus("error");
      return;
    }
    if (!browserSupportsWebAuthn()) {
      setError({
        kind: "unsupported",
        message: "This browser doesn't support biometric sign-in. Please update it or try another device.",
      });
      setStatus("error");
      return;
    }

    setStatus("starting");
    setError(null);
    setResult(null);

    try {
      const { data } = await webauthnApi.authOptions({ classId, token });
      setPlatformAvailable(await platformAuthenticatorIsAvailable().catch(() => true));

      setStatus("verifying");
      const assertion = await startAuthentication({ optionsJSON: data.options });
      const verifyRes = await webauthnApi.authVerify({ response: assertion });

      setResult(verifyRes.data?.student || null);
      setStatus("success");
    } catch (err) {
      const code = err.response?.data?.details?.code;
      const message =
        err.response?.data?.message ||
        (err.name === "NotAllowedError"
          ? "Biometric prompt cancelled"
          : err.message || "Something went wrong");

      if (code === "QR_EXPIRED") {
        setError({ kind: "expired", message });
      } else if (code === "NO_DEVICE") {
        setError({ kind: "no-device", message });
      } else if (err.response) {
        setError({ kind: "rejected", message });
      } else if (err.name === "NotAllowedError") {
        setError({ kind: "cancelled", message: "Biometric prompt cancelled. Tap retry to try again." });
      } else {
        setError({ kind: "failed", message: message || "Something went wrong" });
      }
      setStatus("error");
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    startedRef.current = false;
    runVerification();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-[#1a2032] dark:via-[#171c2b] dark:to-[#1e2536]">
      <div className="glass-card w-full max-w-sm rounded-3xl shadow-2xl border border-white/20 bg-white/95 dark:bg-[#242b3d]/95 p-8 text-center">
        {status === "starting" && (
          <>
            <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-200 flex items-center justify-center">
              <QrCode className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-lg font-bold font-display text-slate-900 dark:text-white">
              QR code detected
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              Preparing biometric verification…
            </p>
            <Spinner label="" />
          </>
        )}

        {status === "verifying" && (
          <>
            <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-200 flex items-center justify-center animate-pulse">
              <Fingerprint className="h-9 w-9" />
            </div>
            <h1 className="mt-4 text-lg font-bold font-display text-slate-900 dark:text-white">
              Verify it's you
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
              Complete the Face ID / Touch ID / fingerprint prompt on this device.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-lg font-bold font-display text-emerald-600 dark:text-emerald-400">
              You're verified!
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
              Hi <span className="font-semibold">{student?.name || result?.name}</span>, your identity
              has been confirmed for this class.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              Your teacher will confirm your attendance
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className={`h-16 w-16 mx-auto rounded-2xl flex items-center justify-center ${
                error?.kind === "expired"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-lg font-bold font-display text-slate-900 dark:text-white">
              {error?.kind === "expired"
                ? "QR code expired"
                : error?.kind === "no-device"
                  ? "Device not registered"
                  : error?.kind === "cancelled"
                    ? "Verification cancelled"
                    : "Couldn't verify"}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
              {error?.message}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {(error?.kind === "expired" || error?.kind === "cancelled" || error?.kind === "failed") && (
                <button
                  onClick={retry}
                  className="glass-btn-primary w-full py-2.5 text-xs justify-center flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
              {error?.kind === "expired" && (
                <p className="text-[11px] text-slate-400">
                  Ask your teacher to show the latest QR and scan it again.
                </p>
              )}
              {error?.kind === "no-device" && (
                <Link
                  to="/student/register-device"
                  className="glass-btn-primary w-full py-2.5 text-xs justify-center flex items-center gap-1.5"
                >
                  <Fingerprint className="h-3.5 w-3.5" />
                  Register this device
                </Link>
              )}
            </div>
          </>
        )}

        {!platformAvailable && status === "verifying" && (
          <p className="mt-3 text-[11px] text-amber-500">
            No platform authenticator found — you may be asked for an alternate method.
          </p>
        )}
      </div>
    </div>
  );
}
