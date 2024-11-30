// src/frontend/src/AuthContext.tsx
import React, { createContext, useState, ReactNode } from 'react';
import SHA256 from 'crypto-js/sha256.js';

interface AuthContextType {
  isLoggedIn: boolean;
  isAdmin: boolean;
  username: string | null;
  login: (admin: boolean, username: string, authToken: string) => void;
  logout: () => void;
  x_authorization: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isAdmin: false,
  username: null,
  login: () => {},
  logout: () => {},
  x_authorization: null,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [x_authorization, setXAuthorization] = useState<string | null>(null);

  const login = (admin: boolean, user: string, authToken: string) => {
    setIsLoggedIn(true);
    setIsAdmin(admin);
    setUsername(user);
    setXAuthorization(authToken);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setUsername(null);
    setXAuthorization(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAdmin, username, login, logout, x_authorization }}>
      {children}
    </AuthContext.Provider>
  );
};