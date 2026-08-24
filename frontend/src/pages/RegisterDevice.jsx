import { useState } from "react";
import toast from "react-hot-toast";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import { webauthnApi } from "../api/endpoints";
import { Fingerprint, ShieldCheck, Smartphone, AlertTriangle, Check } from "lucide-react";

export default function RegisterDevice() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [registeredCount, setRegisteredCount] = useState(null);
  const supported = browserSupportsWebAuthn();
  const platformAvailable = platformAuthenticatorIsAvailable();

  const handleRegister = async () => {
    if (!supported) {
      setError({
        message:
          "This browser doesn't support passkeys/biometrics. Use Chrome or Safari on your phone.",
      });
      return;
    }

    setStatus("working");
    setError(null);
    try {
      const { data } = await webauthnApi.registerOptions();
      setRegisteredCount(data.registeredDevices ?? null);

      const attestation = await startRegistration({ optionsJSON: data.options });
      await webauthnApi.registerVerify({ response: attestation });

      setStatus("success");
      toast.success("Device registered successfully!");
    } catch (err) {
      setStatus("idle");
      if (err.name === "NotAllowedError") {
        setError({ message: "Registration was cancelled. Please try again." });
      } else if (err.name === "InvalidStateError") {
        setError({ message: "This device is already registered to your account." });
      } else {
        setError({
          message: err.response?.data?.message || err.message || "Registration failed",
        });
      }
    }
  };

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <Fingerprint className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          Register Device
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
          One-time setup · bind this phone's biometrics to your account
        </p>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 text-center space-y-4">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-200 flex items-center justify-center">
          <Smartphone className="h-8 w-8" />
        </div>

        {status === "success" ? (
          <>
            <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold font-display text-emerald-600 dark:text-emerald-400">
              This device is ready
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
              Next time your teacher shows the class QR code, just scan it and confirm with Face ID /
              Touch ID / fingerprint. Your attendance selection will appear on the teacher's screen.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
              Bind biometrics to your account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
              Your phone will ask for Face ID / Touch ID / fingerprint. We store only a cryptographic
              public key — your biometric data never leaves your device.
              {registeredCount > 0 && " You already have a registered device; adding another is fine."}
            </p>
          </>
        )}

        {!supported && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 text-left">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400">
              WebAuthn isn't available in this browser. Open this page in Chrome (Android) or Safari
              (iPhone).
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 text-left">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400">{error.message}</p>
          </div>
        )}

        {status !== "success" && (
          <button
            onClick={handleRegister}
            disabled={status === "working" || !supported}
            className="glass-btn-primary px-8 py-3 text-sm font-semibold inline-flex items-center gap-2 justify-center"
          >
            {status === "working" ? (
              "Waiting for biometric prompt…"
            ) : (
              <>
                <Fingerprint className="h-4 w-4" />
                {registeredCount > 0 ? "Add another device" : "Register this device"}
              </>
            )}
          </button>
        )}

        {status === "success" && (
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" strokeWidth={3} />
            Credential saved securely
          </p>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-relaxed max-w-md mx-auto">
        Tip: use the same browser you'll use to scan the QR code in class. Registering once per
        device is enough.
      </p>
    </div>
  );
}
