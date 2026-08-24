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

function deriveRpID(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
}

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
  },
  webauthn: {
    rpName: process.env.WEBAUTHN_RP_NAME || "Attendance System",
    rpID: deriveRpID(resolvedClientOrigin),
    expectedOrigin: resolvedClientOrigin,
  },
  cookieSecure: process.env.COOKIE_SECURE === "true",
};
