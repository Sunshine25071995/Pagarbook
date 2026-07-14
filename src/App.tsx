import React, { useState, useEffect } from "react";
import { AuthState } from "./types";
import LoginScreen from "./components/LoginScreen";
import AdminDashboard from "./components/AdminDashboard";
import EmployeeDashboard from "./components/EmployeeDashboard";

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
  });

  // Load auth state from localStorage on init for convenient PWA session preservation!
  useEffect(() => {
    const savedAuth = localStorage.getItem("sunshine_auth_state");
    if (savedAuth) {
      try {
        setAuth(JSON.parse(savedAuth));
      } catch (e) {
        console.error("Failed to parse saved auth:", e);
      }
    }
  }, []);

  const handleLoginSuccess = (userState: AuthState) => {
    setAuth(userState);
    localStorage.setItem("sunshine_auth_state", JSON.stringify(userState));
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, role: null });
    localStorage.removeItem("sunshine_auth_state");
  };

  if (!auth.isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return auth.role === "admin" ? (
    <AdminDashboard auth={auth} onLogout={handleLogout} />
  ) : (
    <EmployeeDashboard auth={auth} onLogout={handleLogout} />
  );
}
