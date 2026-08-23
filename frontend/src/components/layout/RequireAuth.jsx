import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Spinner from "../ui/Spinner";

export default function RequireAuth({ children }) {
  const { teacher, student, isLoading } = useAuth();

  if (isLoading) return <Spinner label="Checking session…" />;
  if (!teacher) return <Navigate to={student ? "/portal" : "/signin"} replace />;

  return children;
}

export function RequireRole({ children, role = "admin" }) {
  const { teacher, isLoading } = useAuth();

  if (isLoading) return <Spinner label="Checking session…" />;
  if (!teacher) return <Navigate to="/signin" replace />;
  if (teacher.role !== role) return <Navigate to="/dashboard" replace />;

  return children;
}

// Gate for the student portal — only student accounts may pass.
export function RequireStudent({ children }) {
  const { student, isLoading } = useAuth();

  if (isLoading) return <Spinner label="Checking session…" />;
  if (!student) return <Navigate to="/signin" replace />;

  return children;
}
