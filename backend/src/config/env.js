import dotenv from "dotenv";
dotenv.config();

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

const resolvedClientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientOrigin: resolvedClientOrigin,
  mongoUri: required("MONGO_URI"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    qrSecret: process.env.JWT_QR_SECRET || required("JWT_ACCESS_SECRET"),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
    qrExpiresSeconds: Number(process.env.QR_TOKEN_EXPIRES_SECONDS) || 10,
    qrClockToleranceSeconds: Number(process.env.QR_CLOCK_TOLERANCE_SECONDS) || 20,
  },
  webauthn: {
    rpName: process.env.WEBAUTHN_RP_NAME || "Attendance System",
    rpID: (process.env.WEBAUTHN_RP_ID || "").trim(),
  },
  geo: {
    // Anti-relay check: scans must come within this distance of the teacher's
    // anchored classroom position. Generous enough for indoor GPS drift.
    radiusMeters: Number(process.env.QR_GEO_RADIUS_METERS) || 150,
  },
  cookieSecure: process.env.COOKIE_SECURE === "true",
};
