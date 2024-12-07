// src/frontend/src/components/ProtectedRoute.tsx

import React, { useContext, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext.js';

interface ProtectedRouteProps {
  children: React.ReactElement;
  adminOnly?: boolean;
}

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