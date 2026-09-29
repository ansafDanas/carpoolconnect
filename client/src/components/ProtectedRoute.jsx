import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { token, loading, hasAnyRole, isAdmin } = useAuth();

  if (loading) {
    return <p role="status" aria-live="polite">Loading...</p>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    return <Navigate to={isAdmin ? "/admin/dashboard" : "/app/dashboard"} replace />;
  }

  return children || <Outlet />;
}

export default ProtectedRoute;