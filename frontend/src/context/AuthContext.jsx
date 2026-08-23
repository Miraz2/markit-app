import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, studentAuthApi } from "../api/endpoints";

const AuthContext = createContext(null);

const KIND_KEY = "markit.kind";

// Session restore must never run twice concurrently (React StrictMode mounts
// effects twice in dev) — two parallel refresh calls rotate tokens past each
// other and can invalidate a perfectly valid session.
let loadMePromise = null;

function storedKind() {
  try {
    const kind = localStorage.getItem(KIND_KEY);
    return kind === "student" || kind === "teacher" ? kind : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [student, setStudent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const kind = student ? "student" : teacher ? "teacher" : null;

  // Restore the session on first load. The short-lived access token is
  // silently renewed first so /me doesn't hit a predictable 401.
  const loadMe = useCallback(async () => {
    if (loadMePromise) return loadMePromise;

    loadMePromise = (async () => {
      const savedKind = storedKind();
      try {
        await (savedKind === "student" ? studentAuthApi.refreshToken() : authApi.refreshToken());
      } catch {
        setTeacher(null);
        setStudent(null);
        setIsLoading(false);
        return;
      }
      try {
        if (savedKind === "student") {
          const { data } = await studentAuthApi.me();
          setStudent(data.student);
        } else {
          const { data } = await authApi.me();
          setTeacher(data.teacher);
        }
      } catch {
        setTeacher(null);
        setStudent(null);
      } finally {
        setIsLoading(false);
        loadMePromise = null;
      }
    })();

    return loadMePromise;
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const signin = async (payload) => {
    const { data } = await authApi.signin(payload);
    localStorage.setItem(KIND_KEY, "teacher");
    setTeacher(data.teacher);
    return data.teacher;
  };

  const studentSignin = async (payload) => {
    const { data } = await studentAuthApi.login(payload);
    localStorage.setItem(KIND_KEY, "student");
    setStudent(data.student);
    return data.student;
  };

  const signup = async (payload) => {
    return authApi.signup(payload);
  };

  const signout = async () => {
    if (kind === "student") {
      await studentAuthApi.logout().catch(() => {});
      setStudent(null);
    } else {
      await authApi.signout().catch(() => {});
      setTeacher(null);
    }
    try {
      localStorage.removeItem(KIND_KEY);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{ teacher, student, kind, isLoading, signin, studentSignin, signup, signout, refresh: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
