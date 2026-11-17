import {
  Activity,
  BookOpen,
  ChevronDown,
  Compass,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const primaryNav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/explore", label: "Learn library", icon: BookOpen },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const closeMenu = () => setMobileOpen(false);
  const initials = (user?.name || user?.email || "Student")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  const title =
    location.pathname === "/app"
      ? "Overview"
      : location.pathname.startsWith("/app/explore")
        ? "Learn library"
        : location.pathname.startsWith("/app/roadmap")
          ? "Your learning path"
          : location.pathname.startsWith("/app/lesson")
            ? "Lesson workspace"
            : location.pathname.startsWith("/app/start")
              ? "Create a learning path"
              : location.pathname.startsWith("/app/feasibility")
                ? "Learning assessment"
                : "Your workspace";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      {mobileOpen ? (
        <button
          className="mobile-scrim"
          onClick={closeMenu}
          aria-label="Close navigation"
        />
      ) : null}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <GraduationCap size={20} />
          </div>
          <span>
            path<span className="brand-accent">ai</span>
          </span>
          <button className="icon-btn sidebar-close" onClick={closeMenu}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">{initials || "ST"}</div>
          <div className="workspace-copy">
            <strong>My workspace</strong>
            <span>Personal learning</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeMenu}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-label nav-label-spaced">YOUR LEARNING</div>
        <nav className="side-nav">
          <NavLink
            to="/app/start"
            onClick={closeMenu}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Plus size={18} />
            <span>New learning path</span>
          </NavLink>
          <NavLink
            to="/app/explore"
            onClick={closeMenu}
            className={({ isActive }) =>
              `nav-link ${isActive && location.pathname === "/explore" ? "active" : ""}`
            }
          >
            <Compass size={18} />
            <span>Explore topics</span>
          </NavLink>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon">
            <SparklesIcon />
          </div>
          <strong>Small steps, real progress.</strong>
          <p>Your next focused session is more valuable than a perfect plan.</p>
          <button onClick={() => navigate("/app/start")}>
            Build a learning path <span>↗</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <NavLink
            to="/app/profile"
            onClick={closeMenu}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Settings2 size={18} />
            <span>Account settings</span>
          </NavLink>
          <div className="user-row">
            <div className="avatar">{initials}</div>
            <div className="user-copy">
              <strong>{user?.name || "Learner"}</strong>
              <span>{user?.email || "Signed in"}</span>
            </div>
            <button
              className="icon-btn"
              title="Sign out"
              onClick={handleLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumbs">
              <span>Workspace</span>
              <span className="crumb-divider">/</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <button className="top-search" onClick={() => navigate("/app/explore")}>
              <Search size={15} />
              <span>Find a lesson</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="avatar avatar-top"
              onClick={() => navigate("/app/profile")}
              title="Open profile"
            >
              {initials}
            </button>
          </div>
        </header>
        <div className="page-container">
          <Outlet />
        </div>
        <footer className="app-footer">
          <span>PathAI</span>
          <span>Learn with direction. Build with confidence.</span>
        </footer>
      </main>
    </div>
  );
}

function SparklesIcon() {
  return <Activity size={17} />;
}
