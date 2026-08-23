import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { metaApi } from "../../api/endpoints";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CheckSquare,
  BarChart3,
  Calendar,
  CalendarDays,
  UserCheck,
  UserCog,
  History,
  LogOut,
  Sun,
  Moon,
  User,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  ArrowLeft,
} from "lucide-react";

export default function AppLayout() {
  const { teacher, signout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("roster.sidebar.collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const profileBtnRef = useRef(null);

  const openProfile = () => {
    const rect = profileBtnRef.current?.getBoundingClientRect();
    if (rect) setProfileAnchor({ top: rect.bottom, right: window.innerWidth - rect.right });
    setProfileOpen((v) => !v);
  };

  useEffect(() => {
    if (!profileOpen) return;
    const close = () => setProfileOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [profileOpen]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("roster.sidebar.collapsed", String(!c));
      } catch {}
      return !c;
    });

  const handleSignout = async () => {
    await signout();
    toast.success("Signed out successfully");
    navigate("/signin");
  };

  const isAdmin = teacher?.role === "admin";

  const adminNav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/sessions", label: "Academic Sessions", icon: Calendar },
    { to: "/admin/teachers", label: "Professors / Teachers", icon: UserCheck, end: true },
    { to: "/admin/teachers/enroll", label: "Enroll Teacher", icon: UserCog, end: true },
    { to: "/students", label: "Student Roster", icon: Users, end: true },
    { to: "/students/enroll", label: "Enroll Student", icon: UserPlus, end: true },
    { to: "/attendance/history", label: "Attendance History", icon: History },
    { to: "/attendance/summary", label: "Attendance Summary", icon: BarChart3 },
    { to: "/profile", label: "My Profile", icon: User },
  ];

  const teacherNav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/attendance/take", label: "Take Attendance", icon: CheckSquare },
    { to: "/attendance/history", label: "Attendance History", icon: History },
    { to: "/attendance/summary", label: "Attendance Summary", icon: BarChart3 },
    { to: "/students/courses", label: "View Students", icon: Users },
    { to: "/profile", label: "My Profile", icon: User },
  ];

  const navItems = isAdmin ? adminNav : teacherNav;

  const initials = (teacher?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const closeNav = () => setMobileOpen(false);

  const location = useLocation();

  // Track in-app navigation history to know when "back" is available
  const [historyEntries, setHistoryEntries] = useState([]);
  useEffect(() => {
    setHistoryEntries((prev) => {
      const key = location.pathname + location.search;
      if (prev[prev.length - 1] === key) return prev;
      return [...prev, key].slice(-50);
    });
  }, [location.pathname, location.search]);
  const canGoBack = historyEntries.length > 1;

  const { data: sessionData } = useQuery({
    queryKey: ["meta", "sessions"],
    queryFn: () => metaApi.sessions(),
  });
  const activeSession = sessionData?.data?.activeSession?.name || null;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const pageTitle =
    [...navItems]
      .sort((a, b) => b.to.length - a.to.length)
      .find((n) => location.pathname.startsWith(n.to))?.label || "Dashboard";

  return (
    <div className="min-h-screen flex bg-[#f1f5f9] dark:bg-[#1a2130] text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-700/60 backdrop-blur-sm md:hidden" onClick={closeNav} />
      )}

      {/* Sidebar — collapsible on desktop, slide-over drawer on mobile */}
      <aside
        className={`
          md:shrink-0 md:sticky md:top-0 md:h-screen flex flex-col border-r border-slate-200/50 dark:border-slate-700/50
          bg-white dark:bg-[#242b3d]
          fixed inset-y-0 left-0 z-50 shadow-2xl md:shadow-none
          transition-all duration-300 md:transition-none
          w-64
          ${collapsed ? "md:w-[60px]" : ""}
          ${mobileOpen ? "translate-x-0 visible" : "-translate-x-full invisible"} md:translate-x-0 md:visible
        `}
      >
        {/* Brand Header */}
        <div
          className={`h-16 flex items-center border-b border-slate-200/50 dark:border-slate-700/50 ${
            collapsed ? "md:justify-center px-0" : "justify-start gap-3 pl-2 pr-1"
          }`}
        >
          <Link
            to="/dashboard"
            className="flex items-center cursor-pointer select-none rounded-xl ml-3"
            aria-label="MarkIt home"
            onClick={closeNav}
          >
            {collapsed ? (
              <span className="font-display font-extrabold text-2xl tracking-tight bg-gradient-to-r from-[#818CF8] via-[#6366F1] to-[#7C3AED] bg-clip-text text-transparent">
                M
              </span>
            ) : (
              <span className="ml-1 font-display font-extrabold text-2xl tracking-tight bg-gradient-to-r from-[#818CF8] via-[#6366F1] to-[#7C3AED] bg-clip-text text-transparent">
                MarkIt
              </span>
            )}
          </Link>
        </div>

        {/* User Card inside Sidebar */}
        <div className="py-6 flex flex-col items-center justify-center border-b border-slate-200/50 dark:border-slate-700/50 gap-1.5">
          <div
            className={`shrink-0 flex items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-500 dark:from-slate-200 dark:to-slate-400 text-white font-bold shadow-md transition-all duration-300 ${
              collapsed ? "md:h-9 md:w-9 md:text-xs" : "h-14 w-14 text-lg"
            }`}
          >
            {initials || <User className="h-4 w-4" />}
          </div>
          {!collapsed && (
            <>
<p className="mt-1 font-semibold text-sm text-slate-800 dark:text-slate-200 text-center tracking-tight">
                {teacher?.name}
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-300 text-center mt-0.5 uppercase tracking-wide">
                {teacher?.designation || (isAdmin ? "Administrator" : "Teacher")}
              </p>
            </>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              aria-label={label}
              onClick={(e) => {
                closeNav();
                e.currentTarget.focus();
              }}
              className={({ isActive }) =>
                `flex items-center rounded-xl text-xs font-medium transition-all duration-200 ${
                  collapsed ? "md:justify-center md:h-9 md:w-9 md:p-0 mx-auto" : "gap-3 px-5 py-3.5 w-full"
                } ${
                  isActive
                    ? "bg-slate-700 text-white shadow-md shadow-slate-600/25 font-semibold dark:bg-white/10"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600/45 hover:text-slate-900 dark:hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto p-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex w-full items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition"
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>{collapsed ? "Expand" : "Collapse"}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Navbar */}
        <header className="h-16 sticky top-0 z-50 bg-white/80 dark:bg-[#242b3d]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between px-2.5 sm:px-6 transition-colors duration-300">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-full bg-slate-500/10 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-500/20 dark:hover:bg-white/15 transition md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            {canGoBack && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-full bg-slate-500/[0.07] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-500/15 dark:hover:bg-white/10 transition shrink-0"
                aria-label="Go back"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold font-display tracking-tight text-slate-800 dark:text-white truncate">
                {pageTitle}
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-400 dark:text-slate-400 leading-tight">
                {isAdmin ? "University Admin Portal" : "Faculty Portal"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3.5 ml-auto">
            {/* Active Session Badge */}
            {activeSession && (
              <div
                className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 px-2 py-1 sm:gap-1.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                title="Active academic session"
              >
                <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {activeSession}
              </div>
            )}

            {/* Live Clock */}
            <div className="hidden lg:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {timeStr}
              </span>
              <span className="text-[10px] text-slate-400">{dateStr}</span>
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                ref={profileBtnRef}
                onClick={openProfile}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600/55 transition"
                aria-label="Account menu"
              >
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-500 dark:from-slate-200 dark:to-slate-400 text-white text-xs font-bold shadow-sm">
                  {initials || <User className="h-4 w-4" />}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {teacher?.name?.split(" ")[0]}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {profileOpen &&
                createPortal(
                  <div className="fixed inset-0 z-[70]" onClick={() => setProfileOpen(false)}>
                    <div
                      className="fixed w-48 rounded-2xl bg-white/60 dark:bg-[#1a2130]/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 p-2 shadow-2xl"
                      style={{
                        top: (profileAnchor?.top ?? 64) + 8,
                        right: profileAnchor?.right ?? 16,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                  <div className="px-3 py-2 border-b border-slate-200/60 dark:border-slate-800/60 mb-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{teacher?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{teacher?.email}</p>
                  </div>
                  <NavLink
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-500/10 hover:text-slate-500 dark:hover:text-slate-500 transition"
                  >
                    <User className="h-3.5 w-3.5" />
                    Profile Settings
                  </NavLink>
                  <button
                    onClick={toggleTheme}
                    role="switch"
                    aria-checked={isDark}
                    className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-500/10 transition mt-1 cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-2">
                      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                      {isDark ? "Dark Mode" : "Light Mode"}
                    </span>
                    <span
                      className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors duration-200 ${
                        isDark ? "bg-slate-700 dark:bg-white/25" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          isDark ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      handleSignout();
                    }}
                    className="w-full flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-100/70 mt-1 dark:border-red-400/10 dark:bg-red-400/[0.07] dark:text-red-300/80 dark:hover:bg-red-400/15"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}