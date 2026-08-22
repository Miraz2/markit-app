import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../api/endpoints";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMe = useCallback(async () => {
    // Silently renew the short-lived access token first so /auth/me
    // doesn't hit a predictable 401 after the token has expired.
    try {
      await authApi.refreshToken();
    } catch {
      setTeacher(null);
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      setTeacher(data.teacher);
    } catch {
      setTeacher(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const signin = async (payload) => {
    const { data } = await authApi.signin(payload);
    setTeacher(data.teacher);
    return data.teacher;
  };

  const signup = async (payload) => {
    return authApi.signup(payload);
  };

  const signout = async () => {
    await authApi.signout().catch(() => {});
    setTeacher(null);
  };

  return (
    <AuthContext.Provider value={{ teacher, isLoading, signin, signup, signout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
