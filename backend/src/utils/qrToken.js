import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const CLOCK_TOLERANCE_SECONDS = 5;

export function buildScanKey({ department, batch, section, courseName = "", date }) {
  return [department, batch, section, courseName || "", date].join("|");
}

export function encodeClassId(ctx) {
  const json = JSON.stringify({
    department: ctx.department,
    batch: ctx.batch,
    section: ctx.section,
    courseName: ctx.courseName || "",
    date: ctx.date,
  });
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeClassId(classId) {
  try {
    const json = Buffer.from(String(classId), "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed?.department || !parsed?.batch || !parsed?.section || !parsed?.date) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function signClassToken(ctx) {
  return jwt.sign(
    { kind: "class-qr", ctx, nonce: crypto.randomBytes(12).toString("hex") },
    env.jwt.qrSecret,
    { expiresIn: `${env.jwt.qrExpiresSeconds}s` }
  );
}

export function verifyClassToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.qrSecret, {
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }

  if (payload.kind !== "class-qr" || !payload.ctx) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, ctx: payload.ctx, issuedAt: payload.iat, expiresAt: payload.exp };
}
