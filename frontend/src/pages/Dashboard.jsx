import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { studentApi, metaApi, adminApi, courseStudentApi } from "../api/endpoints";
import {
  Users,
  UserCheck,
  Calendar,
  CheckSquare,
  BarChart3,
  UserPlus,
  BookOpen,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  History,
} from "lucide-react";

export default function Dashboard() {
  const { teacher } = useAuth();
  const isAdmin = teacher?.role === "admin";
  const navigate = useNavigate();

  const { data: studentsData } = useQuery({
    queryKey: ["students", "count"],
    queryFn: () => studentApi.list({ limit: 1 }),
    enabled: !!teacher && isAdmin,
  });
  const { data: deptData } = useQuery({
    queryKey: ["meta", "departments"],
    queryFn: () => metaApi.departments(),
    enabled: !!teacher,
  });
  const { data: teacherData } = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: () => adminApi.listTeachers(),
    enabled: !!teacher && isAdmin,
  });
  const { data: sessionData } = useQuery({
    queryKey: ["meta", "sessions"],
    queryFn: () => metaApi.sessions(),
    enabled: !!teacher,
  });

  const activeSessionName = sessionData?.data?.activeSession?.name || null;

  // Personally enrolled students — counted alongside the official roster.
  // Teachers get their own enrollments back; admins get everyone's.
  const { data: personalData } = useQuery({
    queryKey: ["course-students", "count", activeSessionName || "any"],
    queryFn: () => courseStudentApi.list(activeSessionName ? { sessionName: activeSessionName } : {}),
    enabled: !!teacher,
  });
  const personalTotal = personalData?.data?.students?.length ?? 0;

  // Teacher's assigned sections for the active session
  const assignedSections = useMemo(() => {
    if (!teacher?.assignments) return [];
    if (!activeSessionName) return teacher.assignments;
    return teacher.assignments.filter((a) => a.sessionName === activeSessionName);
  }, [teacher, activeSessionName]);

  // Roster count per unique section -> total assigned students
  // (dedupe: one teacher may hold several courses in the same section)
  const uniqueSections = useMemo(() => {
    const seen = new Set();
    return assignedSections.filter((a) => {
      const key = `${a.department}-${a.batch}-${a.section}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assignedSections]);

  const assignedQueries = useQueries({
    queries: uniqueSections.map((a) => ({
      queryKey: ["students", "roster-count", a.department, a.batch, a.section],
      queryFn: () =>
        studentApi.list({ department: a.department, batch: a.batch, section: a.section, limit: 1 }),
      enabled: !!teacher && !isAdmin,
    })),
  });
  const assignedStudents =
    assignedQueries.reduce((sum, q) => sum + (q.data?.data?.pagination?.total ?? 0), 0) + personalTotal;

  const rosterTotal = studentsData?.data?.pagination?.total;
  const totalStudents =
    rosterTotal === undefined && !personalData ? "—" : (rosterTotal ?? 0) + personalTotal;
  const totalDepartments = deptData?.data?.departments?.length ?? "—";
  const totalTeachers = teacherData?.data?.teachers?.length ?? "—";
  const activeSession = sessionData?.data?.activeSession?.name || "Summer-26";

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Page Title & Breadcrumbs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold font-display tracking-tight text-slate-800 dark:text-white">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 max-w-xl">
            {isAdmin
              ? "University Admin Portal — Manage professors, sessions, student enrollments and system reports."
              : `Logged in as ${teacher?.designation || "Professor"}. Active session: ${activeSession}`}
          </p>
        </div>
      </div>

{/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatWidget
          title={isAdmin ? "Enrolled Students" : "My Assigned Students"}
          value={isAdmin ? totalStudents : assignedStudents}
          subtitle={
            isAdmin
              ? "Total university students"
              : assignedSections.length > 0
                ? `Across ${assignedSections.length} assigned section${assignedSections.length > 1 ? "s" : ""} · ${activeSession}`
                : "No sections assigned for this session"
          }
          icon={Users}
          bgGradient="from-[#5c56e6] via-[#7a5bf0] to-[#9d68f2]"
        />
        <StatWidget
          title="Departments"
          value={totalDepartments}
          subtitle="Active academic depts"
          icon={BookOpen}
          bgGradient="from-[#11b877] via-[#14c9a2] to-[#1ad1c8]"
        />
        {isAdmin ? (
          <StatWidget
            title="Professors & Staff"
            value={totalTeachers}
            subtitle="Faculty members enrolled"
            icon={UserCheck}
            bgGradient="from-[#f43f5e] to-[#ec4899]"
          />
        ) : (
          <StatWidget
            title="Assigned Classes"
            value={assignedSections.length}
            subtitle="Active section classes"
            icon={CheckSquare}
            bgGradient="from-[#f43f5e] via-[#f0448c] to-[#ec4899]"
          />
        )}
<StatWidget
          title="Active Term"
          value={activeSession}
          subtitle="Academic year session"
          icon={Calendar}
          bgGradient="from-[#ffb03a] via-[#ff8d52] to-[#ff6b6b]"
        />
      </div>

      {/* TEACHER ASSIGNED SECTIONS WIDGET (for Teachers) */}
      {!isAdmin && (
        <div className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-1">
            My Assigned Class Sections ({activeSession})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
            Select a class section below to take or view attendance.
          </p>

          {assignedSections.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No section classes assigned yet for {activeSession}. Contact the admin to get assigned.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedSections.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    navigate("/attendance/take", {
                      state: {
                        assignment: {
                          department: item.department,
                          batch: item.batch,
                          section: item.section,
                          courseName: item.courseName || "",
                        },
                      },
                    })
                  }
                  className="p-5 rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800 hover:border-slate-400/60 hover:shadow-lg hover:scale-[1.01] transition-[transform,box-shadow,border-color] duration-150 transform-gpu group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-500/10 text-slate-500 dark:text-slate-300 font-mono font-bold text-xs">
                        {item.department}-{item.batch}-{item.section}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                      {item.courseName || `Section ${item.section}`}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                    <span>Take Attendance</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QUICK ACTIONS SECTION */}
      <div>
        <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-4">
          Quick Portals & Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {isAdmin && (
            <>
              <ActionPortal
                to="/admin/teachers"
                title="Enroll Teacher"
                desc="Create professor accounts for faculty members."
                icon={UserCheck}
              />
              <ActionPortal
                to="/admin/sessions"
                title="Academic Sessions"
                desc="Create new terms (Summer-26) & assign teachers."
                icon={Calendar}
              />
              <ActionPortal
                to="/students/enroll"
                title="Enroll Student"
                desc="Add new student with roll ID (e.g. 202411068030)."
                icon={UserPlus}
              />
            </>
          )}

          {!isAdmin && (
            <>
              <ActionPortal
                to="/attendance/take"
                title="Take Attendance"
                desc="Mark roll attendance for your assigned sections."
                icon={CheckSquare}
              />
              <ActionPortal
                to="/students/courses"
                title="View Students"
                desc="Browse students in your assigned courses."
                icon={Users}
              />
            </>
          )}

          {isAdmin && (
            <ActionPortal
              to="/students"
              title="Browse Student Roster"
              desc="Search and edit enrolled students by department & batch."
              icon={Users}
            />
          )}
          <ActionPortal
            to="/attendance/history"
            title="Attendance History"
            desc="Review past attendance records & daily logs."
            icon={History}
          />
          <ActionPortal
            to="/attendance/summary"
            title="Attendance Summary"
            desc="Interactive calendar view, reports & CSV exports."
            icon={BarChart3}
          />
        </div>
      </div>
    </div>
  );
}

function StatWidget({ title, value, subtitle, icon: Icon, bgGradient }) {
  return (
    <div           className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br ${bgGradient} text-white shadow-lg border border-white/10 hover:shadow-xl hover:scale-[1.01] transition-all duration-300 group flex flex-col justify-between h-36`}>
      {/* Absolute positioned translucent large icon */}
      <div className="absolute right-4 bottom-6 text-white/15 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 pointer-events-none">
        <Icon className="h-16 w-16 shrink-0 stroke-[1.2]" />
      </div>
      
      <div className="relative z-10">
        <p className="text-[11px] font-semibold tracking-wider text-white/80 uppercase">{title}</p>
        <p className="text-3xl font-extrabold font-display mt-2 tracking-tight">{value}</p>
      </div>
      
      <div className="relative z-10 mt-auto">
        <p className="text-[10px] font-medium text-white/70">{subtitle}</p>
      </div>
    </div>
  );
}

function ActionPortal({ to, title, desc, icon: Icon }) {
  return (
    <Link
      to={to}
      className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-400/60 hover:shadow-xl hover:scale-[1.01] transition-[transform,box-shadow,border-color] duration-150 transform-gpu group flex flex-col justify-between"
    >
      <div>
        <div className="h-10 w-10 rounded-2xl bg-slate-500/10 text-slate-500 dark:text-slate-300 flex items-center justify-center mb-3 group-hover:scale-110 transition">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 leading-relaxed">{desc}</p>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300 group-hover:gap-2.5 transition-all">
        <span>Open Portal</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
