import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import RequireAuth, { RequireRole, RequireStudent } from "./components/layout/RequireAuth";
import AppLayout from "./components/layout/AppLayout";

import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import TeacherManagement from "./pages/TeacherManagement";
import TeacherEnroll from "./pages/TeacherEnroll";
import SessionManagement from "./pages/SessionManagement";
import SessionDetail from "./pages/SessionDetail";
import TeacherAssign from "./pages/TeacherAssign";
import Students from "./pages/Students";
import StudentEnroll from "./pages/StudentEnroll";
import StudentEdit from "./pages/StudentEdit";
import StudentCourses from "./pages/StudentCourses";
import ClassStudents from "./pages/ClassStudents";
import AttendanceTake from "./pages/AttendanceTake";
import TakeCourses from "./pages/TakeCourses";
import ScanAttendance from "./pages/ScanAttendance";
import RegisterDevice from "./pages/RegisterDevice";
import SummarySessions from "./pages/SummarySessions";
import SummaryClasses from "./pages/SummaryClasses";
import AttendanceSummary from "./pages/AttendanceSummary";
import AttendanceHistory from "./pages/AttendanceHistory";
import AttendanceClasses from "./pages/AttendanceClasses";
import AttendanceClassDay from "./pages/AttendanceClassDay";
import Profile from "./pages/Profile";
import StudentPortalHome from "./pages/StudentPortalHome";
import StudentPortalHistory from "./pages/StudentPortalHistory";
import StudentPortalProfile from "./pages/StudentPortalProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// /students/courses shows the course picker; with department/batch/section
// params it renders the students of that class.
function StudentCoursesRoute() {
  const [searchParams] = useSearchParams();
  const isClassView = ["department", "batch", "section"].every((k) => searchParams.get(k));
  return isClassView ? <ClassStudents /> : <StudentCourses />;
}

// Sends each account kind to its own home once the session has been restored.
function HomeRedirect() {
  const { student, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={student ? "/portal" : "/dashboard"} replace />;
}

// Short QR links (/s/:ticketId) forward to the scanner page.
function TicketRedirect() {
  const { ticketId } = useParams();
  return <Navigate to={`/attendance/scan?t=${encodeURIComponent(ticketId || "")}`} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "#1e293b",
                  color: "#f8fafc",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                },
              }}
            />
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />

              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />

                <Route
                  element={
                    <RequireRole role="admin">
                      <Outlet />
                    </RequireRole>
                  }
                >
                  <Route path="/admin/teachers" element={<TeacherManagement />} />
                  <Route path="/admin/teachers/enroll" element={<TeacherEnroll />} />
                  <Route path="/admin/sessions" element={<SessionManagement />} />
                  <Route path="/admin/sessions/:id" element={<SessionDetail />} />
                  <Route path="/admin/sessions/assign/:teacherId" element={<TeacherAssign />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/students/enroll" element={<StudentEnroll />} />
                  <Route path="/students/:id/edit" element={<StudentEdit />} />
                </Route>

                <Route path="/students/courses" element={<StudentCoursesRoute />} />
                <Route path="/attendance/take" element={<TakeCourses />} />
                <Route path="/attendance/take/class" element={<AttendanceTake />} />
                <Route path="/attendance/history" element={<AttendanceHistory />} />
                <Route path="/attendance/history/class/:id" element={<AttendanceClassDay />} />
                <Route path="/attendance/history/:sessionName" element={<AttendanceClasses />} />
                <Route path="/attendance/summary" element={<SummarySessions />} />
                <Route path="/attendance/summary/:sessionName/class" element={<AttendanceSummary />} />
                <Route path="/attendance/summary/:sessionName" element={<SummaryClasses />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* Student portal — separate session kind, teacher routes blocked */}
              <Route
                element={
                  <RequireStudent>
                    <AppLayout />
                  </RequireStudent>
                }
              >
                <Route path="/portal" element={<StudentPortalHome />} />
                <Route path="/portal/history" element={<StudentPortalHistory />} />
                <Route path="/portal/profile" element={<StudentPortalProfile />} />
                <Route path="/student/register-device" element={<RegisterDevice />} />
              </Route>

              {/* QR scan landing — student session required, but full-screen (no layout) */}
              <Route
                element={
                  <RequireStudent>
                    <Outlet />
                  </RequireStudent>
                }
              >
                <Route path="/attendance/scan" element={<ScanAttendance />} />
              </Route>

              <Route path="/s/:ticketId" element={<TicketRedirect />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
