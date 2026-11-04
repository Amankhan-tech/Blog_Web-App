import { useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserContext } from "../UserContext";
import { postJson } from "../api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { userInfo, setUserInfo } = useContext(UserContext);
  const location = useLocation();

  async function login(ev) {
    ev.preventDefault();
    setError("");
    setSubmitting(true);
    const { ok, data, error } = await postJson("/login", { username, password });
    setSubmitting(false);
    if (ok) setUserInfo(data);
    else setError(error);
  }

  // Already logged in (or just logged in): go back where they came from.
  if (userInfo) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  return (
    <form className="login" onSubmit={login}>
      <h1>Login</h1>
      {location.state?.registered && !error && (
        <p className="success">Account created. You can log in now.</p>
      )}
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="username"
        autoComplete="username"
        required
        value={username}
        onChange={(ev) => setUsername(ev.target.value)}
      />
      <input
        type="password"
        placeholder="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(ev) => setPassword(ev.target.value)}
      />
      <button disabled={submitting}>{submitting ? "Logging in…" : "Login"}</button>
    </form>
  );
}
