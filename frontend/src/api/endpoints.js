import { api } from "./axios";

// --- Auth ---
export const authApi = {
  setupStatus: () => api.get("/auth/setup-status").then((r) => r.data),
  signup: (payload) => api.post("/auth/signup", payload).then((r) => r.data),
  signin: (payload) => api.post("/auth/signin", payload).then((r) => r.data),
  signout: () => api.post("/auth/signout").then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  refreshToken: () => api.post("/auth/refresh-token").then((r) => r.data),
  updateProfile: (payload) => api.put("/auth/profile", payload).then((r) => r.data),
};

// --- Student portal auth ---
export const studentAuthApi = {
  login: (payload) => api.post("/student-auth/login", payload).then((r) => r.data),
  logout: () => api.post("/student-auth/logout").then((r) => r.data),
  me: () => api.get("/student-auth/me").then((r) => r.data),
  refreshToken: () => api.post("/student-auth/refresh-token").then((r) => r.data),
  changePassword: (payload) => api.put("/student-auth/password", payload).then((r) => r.data),
  updateProfileImage: (payload) => api.put("/student-auth/profile-image", payload).then((r) => r.data),
};

// --- Student portal data ---
export const portalApi = {
  summary: () => api.get("/student-auth/me/summary").then((r) => r.data),
  myCourses: () => api.get("/student-auth/me/courses").then((r) => r.data),
  history: () => api.get("/student-auth/me/history").then((r) => r.data),
};

// --- Admin ---
export const adminApi = {
  listTeachers: () => api.get("/admin/teachers").then((r) => r.data),
  createTeacher: (payload) => api.post("/admin/teachers", payload).then((r) => r.data),
  bulkTeachers: (teachers) => api.post("/admin/teachers/bulk", { teachers }).then((r) => r.data),
  updateTeacher: (id, payload) => api.put(`/admin/teachers/${id}`, payload).then((r) => r.data),
  deleteTeacher: (id) => api.delete(`/admin/teachers/${id}`).then((r) => r.data),

  listSessions: () => api.get("/admin/sessions").then((r) => r.data),
  createSession: (payload) => api.post("/admin/sessions", payload).then((r) => r.data),
  setActiveSession: (id) => api.put(`/admin/sessions/${id}/activate`).then((r) => r.data),

  assignSections: (payload) => api.post("/admin/assignments", payload).then((r) => r.data),
};

// --- Students ---
export const studentApi = {
  list: (params) => api.get("/students", { params }).then((r) => r.data),
  get: (id) => api.get(`/students/${id}`).then((r) => r.data),
  create: (payload) => api.post("/students", payload).then((r) => r.data),
  update: (id, payload) => api.put(`/students/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/students/${id}`).then((r) => r.data),
  bulk: (students) => api.post("/students/bulk", { students }).then((r) => r.data),
  bulkRemove: (ids) => api.post("/students/bulk-delete", { ids }).then((r) => r.data),
};

// --- Personal course students (teacher-enrolled, outside main roster) ---
export const courseStudentApi = {
  list: (params) => api.get("/course-students", { params }).then((r) => r.data),
  create: (payload) => api.post("/course-students", payload).then((r) => r.data),
  update: (id, payload) => api.put(`/course-students/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/course-students/${id}`).then((r) => r.data),
};

// --- Attendance ---
export const attendanceApi = {
  submit: (payload) => api.post("/attendance", payload).then((r) => r.data),
  session: (params) => api.get("/attendance/session", { params }).then((r) => r.data),
  summary: (params) => api.get("/attendance/summary", { params }).then((r) => r.data),
  history: (params) => api.get("/attendance/history", { params }).then((r) => r.data),
  historyOverview: () => api.get("/attendance/history/overview").then((r) => r.data),
  historyClasses: (params) => api.get("/attendance/history/records", { params }).then((r) => r.data),
  historyDetail: (id) => api.get(`/attendance/history/session/${id}`).then((r) => r.data),
  updateSession: (id, payload) => api.put(`/attendance/session/${id}`, payload).then((r) => r.data),
};

// --- Reports ---
export const reportApi = {
  downloadSummaryPdf: async (params) => {
    const res = await api.get("/reports/summary/pdf", { params, responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `attendance-summary-${params.department}-${params.batch}-${params.section}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadSummaryCsv: async (params) => {
    const res = await api.get("/reports/summary/csv", { params, responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `attendance-summary-${params.department}-${params.batch}-${params.section}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

// --- Meta ---
export const metaApi = {
  departments: () => api.get("/meta/departments").then((r) => r.data),
  batches: (department) => api.get("/meta/batches", { params: { department } }).then((r) => r.data),
  sections: (department, batch) =>
    api.get("/meta/sections", { params: { department, batch } }).then((r) => r.data),
  sessions: () => api.get("/meta/sessions").then((r) => r.data),
  courses: (department) => api.get("/meta/courses", { params: { department } }).then((r) => r.data),
};
