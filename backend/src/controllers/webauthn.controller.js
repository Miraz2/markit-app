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
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";
import {
  buildScanKey,
  encodeClassId,
  decodeClassId,
  signClassToken,
  verifyClassToken,
} from "../utils/qrToken.js";

const CHALLENGE_COOKIE_OPTS = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "strict",
  path: "/api/webauthn",
  maxAge: 3 * 60 * 1000,
};

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
  const classId = encodeClassId(ctx);
  const token = signClassToken(ctx);
  const url = `${env.clientOrigin}/attendance/scan?classId=${classId}&token=${token}`;

  return sendOk(res, {
    classId,
    token,
    url,
    expiresInMs: env.jwt.qrExpiresSeconds * 1000,
  });
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

  const options = await generateRegistrationOptions({
    rpName: env.webauthn.rpName,
    rpID: env.webauthn.rpID,
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
      expectedOrigin: env.webauthn.expectedOrigin,
      expectedRPID: env.webauthn.rpID,
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

// --- Student: validate scanned QR token, then request biometric assertion ---
export const postAuthenticateOptions = asyncHandler(async (req, res) => {
  const student = req.student;
  const { classId, token } = req.body;
  if (!classId || !token) throw ApiError.badRequest("classId and token are required");

  const decodedCtx = decodeClassId(classId);
  if (!decodedCtx) throw ApiError.badRequest("Malformed QR code data");

  const result = verifyClassToken(token);
  if (!result.ok) {
    if (result.reason === "expired") {
      throw new ApiError(400, "QR code expired. Ask your teacher to refresh it and rescan.", {
        code: "QR_EXPIRED",
      });
    }
    throw new ApiError(400, "Invalid QR code", { code: "QR_INVALID" });
  }

  const tokenCtx = result.ctx;
  const normalized = (c) =>
    [c.department, c.batch, c.section, c.courseName || "", c.date].join("|");
  if (normalized(decodedCtx) !== normalized(tokenCtx)) {
    throw ApiError.badRequest("QR code data mismatch", { code: "QR_INVALID" });
  }

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
    rpID: env.webauthn.rpID,
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
      expectedOrigin: env.webauthn.expectedOrigin,
      expectedRPID: env.webauthn.rpID,
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
