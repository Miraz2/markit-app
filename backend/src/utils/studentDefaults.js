import bcrypt from "bcryptjs";

// Shared temporary password handed to every student on enrollment.
// Students are expected to change it after their first sign-in.
export const DEFAULT_STUDENT_PASSWORD = "student123";

let cachedHashPromise = null;

// Hashing is memoized per process: a 500-row bulk import would otherwise
// pay the ~250ms bcrypt cost once per row for an identical password.
export function getDefaultStudentPasswordHash() {
  if (!cachedHashPromise) {
    cachedHashPromise = bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 12);
  }
  return cachedHashPromise;
}
