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

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthRoute =
      original?.url?.includes("/auth/signin") ||
      original?.url?.includes("/auth/signup") ||
      original?.url?.includes("/auth/refresh-token");

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
        await api.post("/auth/refresh-token");
        flushQueue(null);
        return api(original);
      } catch (refreshError) {
        flushQueue(refreshError);
        // Only force redirect if the original request was NOT /auth/me
        if (!original?.url?.includes("/auth/me")) {
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
