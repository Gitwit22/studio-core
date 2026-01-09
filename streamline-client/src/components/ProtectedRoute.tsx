import { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthMe } from "../hooks/useAuthMe";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuthMe();

  if (loading) return null; // could swap for spinner later
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
