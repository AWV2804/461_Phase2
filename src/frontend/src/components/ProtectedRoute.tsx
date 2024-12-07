// src/frontend/src/components/ProtectedRoute.tsx

import React, { useContext, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext.js';

interface ProtectedRouteProps {
  children: React.ReactElement;
  adminOnly?: boolean;
}

/**
 * A component that protects routes based on authentication and authorization status.
 * 
 * @component
 * @param {ProtectedRouteProps} props - The properties for the ProtectedRoute component.
 * @param {React.ReactNode} props.children - The child components to render if access is granted.
 * @param {boolean} [props.adminOnly=false] - Whether the route is restricted to admin users only.
 * 
 * @returns {React.ReactNode} The children components if access is granted, otherwise redirects to the appropriate route.
 * 
 * @example
 * <ProtectedRoute adminOnly={true}>
 *   <AdminPage />
 * </ProtectedRoute>
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { isLoggedIn, isAdmin } = useContext(AuthContext);
  const [alertShown, setAlertShown] = useState(false);

  useEffect(() => {
    if (!isLoggedIn && !alertShown) {
      alert('You must be logged in to view this page.');
      setAlertShown(true);
    } else if (adminOnly && !isAdmin && !alertShown) {
      alert('You must be an admin to view this page.');
      setAlertShown(true);
    }
  }, [isLoggedIn, isAdmin, adminOnly, alertShown]);

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;