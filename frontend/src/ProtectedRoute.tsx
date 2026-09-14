import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "./store";

export function ProtectedRoute({ role, children }: { role?: "student" | "admin"; children: ReactNode }) {
  const isLoggedIn = useAppSelector((state) => state.auth.isLoggedIn);
  const userRole = useAppSelector((state) => state.auth.user?.role);

  if (!isLoggedIn) return <Navigate to="/login" replace />;              // not logged in
  if (role && userRole !== role) return <Navigate to="/login" replace />; // wrong role
  return <>{children}</>;
}
