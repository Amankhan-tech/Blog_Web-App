import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserContext } from "./UserContext";

// Wraps pages that need a logged-in user; sends everyone else to /login.
export default function RequireAuth({ children }) {
  const { userInfo, userReady } = useContext(UserContext);
  const location = useLocation();

  if (!userReady) return <p className="status">Loading…</p>;
  if (!userInfo) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
