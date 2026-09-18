import React from "react";
import { Navigate } from "react-router-dom";
import { getTokenPayload } from "../utils/auth";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin) {
    const payload = getTokenPayload(token);
    if (!payload || payload.role !== "admin") {
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}
