import React, { useContext } from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import Upload from './components/Upload.js';
import Login from './components/Login.js';
import Home from './components/Home.js';
import CreateAccount from './components/CreateAccount.js';
import Search from './components/Search.js';
import Update from './components/Update.js';
import Cost from './components/Cost.js';
import Reset from './components/Reset.js';
import Manage from './components/Manage.js';
import Rate from './components/Rate.js';
import './components/Styling/App.css'; // Import the CSS file for styling
import { AuthContext } from './AuthContext.js';
import ProtectedRoute from './components/ProtectedRoute.js'; // Import ProtectedRoute

/**
 * The main application component that handles routing and navigation.
 * 
 * @component
 * @returns {JSX.Element} The rendered component.
 * 
 * @example
 * <App />
 * 
 * @remarks
 * This component uses the `AuthContext` to determine the user's authentication status and role.
 * It conditionally renders navigation links and routes based on the user's authentication status and role.
 * 
 * @context
 * - `isLoggedIn`: A boolean indicating if the user is logged in.
 * - `isAdmin`: A boolean indicating if the user is an admin.
 * - `username`: The username of the logged-in user.
 * - `logout`: A function to log out the user.
 * 
 * @routes
 * - `/`: Home component.
 * - `/login`: Login component.
 * - `/upload`: Upload component (admin only).
 * - `/create-account`: CreateAccount component (admin only).
 * - `/search`: Search component.
 * - `/update`: Update component (admin only).
 * - `/cost`: Cost component.
 * - `/reset`: Reset component (admin only).
 * - `/manage`: Manage component.
 * - `/rate`: Rate component.
 * 
 * @protectedRoutes
 * The routes are protected using the `ProtectedRoute` component, which ensures that only authenticated users can access them.
 * Some routes are further restricted to admin users only.
 */
const App: React.FC = () => {
    const { isLoggedIn, isAdmin, username, logout } = useContext(AuthContext); // Use AuthContext
  
    return (
      <div>
        <header className="app-header">
          <nav className="nav-container">
            {/* Home Link */}
            <Link to="/" className="nav-logo">
              Home
            </Link>
            
            <div className="nav-links">
              {isLoggedIn ? (
                <>
                  <span style={{ paddingTop: '6px' }}>
                    {`Logged in as: ${username}` }
                  </span>
                  <span style={{ paddingTop: '6px' }}>
                    {isAdmin ? 'Admin' : 'Not Admin'}
                  </span>
                  {isAdmin && (
                    <Link to="/create-account" className="nav-button">
                      Create Account
                    </Link>
                  )}
                  <button onClick={logout} className="nav-button">
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="nav-button">
                  Login
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/upload"
            element={
              <ProtectedRoute adminOnly>
                <Upload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-account"
            element={
              <ProtectedRoute adminOnly>
                <CreateAccount />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />
          <Route
            path="/update"
            element={
              <ProtectedRoute adminOnly>
                <Update />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cost"
            element={
              <ProtectedRoute>
                <Cost />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reset"
            element={
              <ProtectedRoute adminOnly>
                <Reset />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage"
            element={
              <ProtectedRoute>
                <Manage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate"
            element={
              <ProtectedRoute>
                <Rate />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      </div>
    );
  };
  
  export default App;