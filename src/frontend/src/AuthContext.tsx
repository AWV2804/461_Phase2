// src/frontend/src/AuthContext.tsx
import React, { createContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  isAdmin: boolean;
  username: string | null;
  userGroup: string | null;
  login: (admin: boolean, username: string, authToken: string, userGroup: string) => void;
  logout: () => void;
  x_authorization: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isAdmin: false,
  username: null,
  userGroup: null,
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
  const [userGroup, setUserGroup] = useState<string | null>(null);
  const [x_authorization, setXAuthorization] = useState<string | null>(null);

  const login = (admin: boolean, user: string, authToken: string, group: string) => {
    setIsLoggedIn(true);
    setIsAdmin(admin);
    setUsername(user);
    setUserGroup(group);
    setXAuthorization(authToken);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setUsername(null);
    setUserGroup(null);
    setXAuthorization(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAdmin, username, userGroup, login, logout, x_authorization }}>
      {children}
    </AuthContext.Provider>
  );
};