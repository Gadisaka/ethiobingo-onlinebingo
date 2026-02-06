import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import Notifications from "./pages/Notifications";
import Ads from "./pages/Ads";
import Agent from "./pages/SubAdmin";
import Cashier from "./pages/Cashier";
import AllCashiers from "./pages/AllCashiers";
import Reports from "./pages/Reports";
import CashierGame from "./pages/CashierGame";
import AdminSettings from "./pages/AdminSettings";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/games" element={<Games />} />
            <Route path="/reports" element={<Reports />} />
            <Route
              path="/agents"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Agent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/all-cashiers"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AllCashiers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cashiers"
              element={
                <ProtectedRoute allowedRoles={["agent"]}>
                  <Cashier />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ads"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Ads />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game"
              element={
                <ProtectedRoute allowedRoles={["cashier"]}>
                  <CashierGame />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
