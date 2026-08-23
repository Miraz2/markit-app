import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // send httpOnly auth cookies
});

let isRefreshing = false;
let queue = [];

function flushQueue(error) {
  queue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  queue = [];
}

// Teachers/admins and students have separate session endpoints — remember
// which kind signed in so the interceptor renews against the right one.
function refreshUrl() {
  try {
    return localStorage.getItem("markit.kind") === "student"
      ? "/student-auth/refresh-token"
      : "/auth/refresh-token";
  } catch {
    return "/auth/refresh-token";
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";
    const isAuthRoute =
      url.includes("/auth/signin") ||
      url.includes("/auth/signup") ||
      url.includes("/auth/refresh-token") ||
      url.includes("/student-auth/login") ||
      url.includes("/student-auth/refresh-token");

    if (status === 401 && !original._retry && !isAuthRoute) {
      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;
      try {
        await api.post(refreshUrl());
        flushQueue(null);
        return api(original);
      } catch (refreshError) {
        flushQueue(refreshError);
        // A network/DB hiccup (no HTTP response) shouldn't destroy a valid
        // session — only sign out when the server explicitly rejects the
        // refresh token.
        const rejected = Boolean(refreshError.response);
        if (rejected && !url.includes("/auth/me") && !url.includes("/student-auth/me")) {
          window.location.href = "/signin";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
