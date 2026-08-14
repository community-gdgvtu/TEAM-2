import { Link, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <nav className="navbar">
        <Link to="/" className="logo">
          <span className="logo-icon">🧠</span>
          MINDTRACE
        </Link>
        <div className="nav-links">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            Home
          </Link>
          <Link to="/play" className={`nav-link ${location.pathname.startsWith('/play') ? 'active' : ''}`}>
            Play
          </Link>
          <Link to="/dashboard" className={`nav-link ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}>
            Dashboard
          </Link>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
