import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("pdf_user");
    const t = localStorage.getItem("pdf_token");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch (e) {}
    }
    if (t) setToken(t);
    setLoading(false);
  }, []);

  const login = useCallback((u, t) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("pdf_user", JSON.stringify(u));
    if (t) localStorage.setItem("pdf_token", t);
  }, []);

  const loginGuest = useCallback(() => {
    const u = {
      id: "guest",
      name: "Guest",
      email: "guest@local",
      picture: "",
      isGuest: true,
    };
    setUser(u);
    localStorage.setItem("pdf_user", JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("pdf_user");
    localStorage.removeItem("pdf_token");
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginGuest, logout, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { API };
