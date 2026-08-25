import jwt from "jsonwebtoken";
import crypto from "crypto";
import { body } from "express-validator";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import UserCredential from "../models/UserCredential.js";
import QrTicket from "../models/QrTicket.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";
import { buildScanKey } from "../utils/qrToken.js";

const CHALLENGE_COOKIE_OPTS = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "strict",
  path: "/api/webauthn",
  maxAge: 3 * 60 * 1000,
};

// The public origin the request actually arrived on. Behind Vercel's monorepo
// rewrite this is the deployment domain itself, so QR links and WebAuthn RP
// configuration follow whatever URL the app is being used on — localhost in
// dev, the live domain in production — with zero manual configuration.
function getRequestOrigin(req) {
  const protoHeader = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const hostHeader = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const proto = protoHeader || req.protocol || "http";
  const host = hostHeader || req.get("host") || "";
  if (!host) return null;
  try {
    const origin = `${proto}://${host}`;
    return { origin, hostname: new URL(origin).hostname };
  } catch {
    return null;
  }
}

function resolveWebAuthnRp(req) {
  if (env.webauthn.rpID) {
    return {
      rpID: env.webauthn.rpID,
      expectedOrigins: [`https://${env.webauthn.rpID}`, `http://${env.webauthn.rpID}`],
    };
  }
  const resolved = getRequestOrigin(req);
  if (!resolved) throw ApiError.internal("Cannot determine deployment origin");
  return { rpID: resolved.hostname, expectedOrigins: [resolved.origin] };
}

function signChallengeCookie(res, cookieName, payload) {
  const token = jwt.sign(payload, env.jwt.qrSecret, { expiresIn: "3m" });
  res.cookie(cookieName, token, CHALLENGE_COOKIE_OPTS);
}

function readChallengeCookie(req, cookieName, expectedKind) {
  const raw = req.cookies?.[cookieName];
  if (!raw) throw ApiError.badRequest("Challenge expired. Please restart the verification.");
  let payload;
  try {
    payload = jwt.verify(raw, env.jwt.qrSecret);
  } catch {
    throw ApiError.badRequest("Challenge expired. Please restart the verification.");
  }
  if (payload.kind !== expectedKind) {
    throw ApiError.badRequest("Invalid challenge. Please restart the verification.");
  }
  return payload;
}

// Great-circle distance in meters between two WGS84 points.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// --- Teacher: fresh short-lived QR token for a class session ---
export const getClassQr = asyncHandler(async (req, res) => {
  if (req.teacher.role === "admin") {
    throw ApiError.forbidden("Admins cannot take attendance");
  }

  const { department, batch, section, courseName = "", date } = req.query;
  if (!department || !batch || !section || !date) {
    throw ApiError.badRequest("department, batch, section and date are required");
  }

  const ctx = { department, batch, section, courseName, date };

  // Anchor the ticket to the classroom when the teacher's browser provides
  // coordinates; scans are then rejected beyond env.geo.radiusMeters.
  const rawLat = Number(req.query.latitude);
  const rawLng = Number(req.query.longitude);
  const hasLoc =
    req.query.latitude !== undefined &&
    req.query.longitude !== undefined &&
    req.query.latitude !== "" &&
    req.query.longitude !== "" &&
    Number.isFinite(rawLat) &&
    Number.isFinite(rawLng);

  // Opaque ticket instead of a long signed JWT keeps the encoded URL tiny so
  // the projected QR stays coarse and scannable from across a classroom.
  const ttlSeconds = env.jwt.qrExpiresSeconds + env.jwt.qrClockToleranceSeconds;
  const ticketId = crypto.randomBytes(9).toString("base64url");
  await QrTicket.create({
    _id: ticketId,
    ctx,
    ...(hasLoc ? { loc: { latitude: rawLat, longitude: rawLng } } : {}),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });

  const resolved = getRequestOrigin(req);
  const url = `${resolved?.origin || env.clientOrigin}/s/${ticketId}`;

  return sendOk(res, {
    ticketId,
    url,
    // Rotation window shown on the projector clock. The ticket's real TTL is
    // longer (rotation + clock tolerance) but that detail stays server-side.
    expiresInMs: env.jwt.qrExpiresSeconds * 1000,
    geoEnabled: hasLoc,
    radiusMeters: env.geo.radiusMeters,
  });
});

// --- Teacher: revoke the live ticket when the QR modal closes ---
export const closeClassQr = asyncHandler(async (req, res) => {
  const { ticketId } = req.body;
  if (ticketId) await QrTicket.deleteOne({ _id: String(ticketId) }).catch(() => {});
  return sendOk(res, { closed: true });
});

// --- Teacher: students whose biometric scan matched this exact class window ---
export const getRecentScans = asyncHandler(async (req, res) => {
  const { department, batch, section, courseName = "", date } = req.query;
  if (!department || !batch || !section || !date) {
    throw ApiError.badRequest("department, batch, section and date are required");
  }

  const key = buildScanKey({ department, batch, section, courseName, date });
  const since = new Date(Date.now() - 120 * 1000);

  const creds = await UserCredential.find({
    lastScanKey: key,
    lastScanAt: { $gte: since },
  })
    .populate("student", "studentId name")
    .lean();

  const byStudent = new Map();
  for (const c of creds) {
    if (!c.student?._id) continue;
    const id = String(c.student._id);
    const existing = byStudent.get(id);
    if (!existing || new Date(c.lastScanAt) > new Date(existing.at)) {
      byStudent.set(id, {
        student: id,
        roll: c.student.studentId,
        name: c.student.name,
        at: c.lastScanAt,
      });
    }
  }

  return sendOk(res, {
    scans: Array.from(byStudent.values()).sort((a, b) => new Date(a.at) - new Date(b.at)),
    serverTime: new Date().toISOString(),
  });
});

// --- Student: one-time device registration (Face ID / Touch ID / Fingerprint) ---
export const postRegisterOptions = asyncHandler(async (req, res) => {
  const student = req.student;

  const existing = await UserCredential.find({ student: student._id }).select("credentialID").lean();

  const { rpID } = resolveWebAuthnRp(req);
  const options = await generateRegistrationOptions({
    rpName: env.webauthn.rpName,
    rpID,
    userID: Buffer.from(student._id.toString(), "hex"),
    userName: String(student.studentId || student.email || "student"),
    userDisplayName: student.name,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialID })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  signChallengeCookie(res, "waRegChallenge", {
    kind: "reg-challenge",
    challenge: options.challenge,
    sub: student._id.toString(),
  });

  return sendOk(res, { options, registeredDevices: existing.length });
});

export const postRegisterVerify = asyncHandler(async (req, res) => {
  const student = req.student;
  const { response } = req.body;
  if (!response) throw ApiError.badRequest("Missing WebAuthn registration response");

  const challengePayload = readChallengeCookie(req, "waRegChallenge", "reg-challenge");
  if (challengePayload.sub !== student._id.toString()) {
    throw ApiError.unauthorized("Challenge does not belong to this account");
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengePayload.challenge,
      expectedOrigin: resolveWebAuthnRp(req).expectedOrigins,
      expectedRPID: resolveWebAuthnRp(req).rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    throw ApiError.badRequest(err?.message || "Device registration verification failed");
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw ApiError.badRequest("Device registration could not be verified");
  }

  const { credential, counter } = verification.registrationInfo;

  await UserCredential.findOneAndUpdate(
    { credentialID: credential.id },
    {
      student: student._id,
      credentialID: credential.id,
      credentialPublicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: counter ?? 0,
      createdAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.clearCookie("waRegChallenge", CHALLENGE_COOKIE_OPTS);
  return sendOk(res, { verified: true }, "Device registered successfully");
});

// --- Student: validate scanned QR ticket, then request biometric assertion ---
export const postAuthenticateOptions = asyncHandler(async (req, res) => {
  const student = req.student;
  const { ticket } = req.body;
  if (!ticket) throw ApiError.badRequest("ticket is required");

  const doc = await QrTicket.findById(String(ticket)).lean();
  if (!doc) {
    throw new ApiError(400, "Invalid QR code", { code: "QR_INVALID" });
  }
  if (new Date(doc.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(400, "QR code expired. Ask your teacher to refresh it and rescan.", {
      code: "QR_EXPIRED",
    });
  }

  // Anti-relay: a ticket anchored to the classroom only accepts scans from
  // students whose browser reports a position inside the allowed radius.
  if (doc.loc && doc.loc.latitude != null && doc.loc.longitude != null) {
    const sLat = Number(req.body.latitude);
    const sLng = Number(req.body.longitude);
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) {
      throw new ApiError(
        400,
        "Location access is required for attendance. Allow location in your browser and scan again.",
        { code: "GEO_REQUIRED" }
      );
    }
    const distance = haversineMeters(doc.loc.latitude, doc.loc.longitude, sLat, sLng);
    if (distance > env.geo.radiusMeters) {
      throw new ApiError(
        403,
        "You don't appear to be inside the classroom. Attendance can only be marked on site.",
        { code: "TOO_FAR" }
      );
    }
  }

  const decodedCtx = doc.ctx;

  const credentials = await UserCredential.find({ student: student._id })
    .select("credentialID")
    .lean();
  if (credentials.length === 0) {
    throw new ApiError(
      404,
      "No registered device found for your account. Register this phone first.",
      { code: "NO_DEVICE" }
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: resolveWebAuthnRp(req).rpID,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({ id: c.credentialID })),
  });

  signChallengeCookie(res, "waAuthChallenge", {
    kind: "auth-challenge",
    challenge: options.challenge,
    sub: student._id.toString(),
    scanKey: buildScanKey(decodedCtx),
    nonce: crypto.randomBytes(8).toString("hex"),
  });

  return sendOk(res, {
    options,
    context: {
      department: decodedCtx.department,
      batch: decodedCtx.batch,
      section: decodedCtx.section,
      courseName: decodedCtx.courseName || "",
      date: decodedCtx.date,
    },
  });
});

export const postAuthenticateVerify = asyncHandler(async (req, res) => {
  const student = req.student;
  const { response } = req.body;
  if (!response?.id) throw ApiError.badRequest("Missing WebAuthn authentication response");

  const challengePayload = readChallengeCookie(req, "waAuthChallenge", "auth-challenge");
  if (challengePayload.sub !== student._id.toString()) {
    throw ApiError.unauthorized("Challenge does not belong to this account");
  }

  const credentialDoc = await UserCredential.findOne({
    student: student._id,
    credentialID: response.id,
  });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengePayload.challenge,
      expectedOrigin: resolveWebAuthnRp(req).expectedOrigins,
      expectedRPID: resolveWebAuthnRp(req).rpID,
      credential: {
        id: credentialDoc.credentialID,
        publicKey: isoBase64URL.toBuffer(credentialDoc.credentialPublicKey),
        counter: credentialDoc.counter,
      },
      requireUserVerification: true,
    });
  } catch (err) {
    throw ApiError.badRequest(err?.message || "Biometric verification failed");
  }

  if (!verification.verified) {
    throw ApiError.unauthorized("Biometric verification failed");
  }

  credentialDoc.counter = verification.authenticationInfo.newCounter;
  await credentialDoc.save();

  await UserCredential.updateMany(
    { student: student._id },
    { lastScanAt: new Date(), lastScanKey: challengePayload.scanKey }
  );

  res.clearCookie("waAuthChallenge", CHALLENGE_COOKIE_OPTS);
  return sendOk(
    res,
    {
      verified: true,
      student: { id: student._id, roll: student.studentId, name: student.name },
    },
    "Identity verified. Your teacher will confirm your attendance."
  );
});
