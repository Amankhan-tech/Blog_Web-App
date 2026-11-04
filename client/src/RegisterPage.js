import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "./api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function register(ev) {
    ev.preventDefault();
    setError("");
    setSubmitting(true);
    const { ok, error } = await postJson("/register", { username, password });
    setSubmitting(false);
    if (ok) navigate("/login", { state: { registered: true } });
    else setError(error);
  }

  return (
    <form className="register" onSubmit={register}>
      <h1>Register</h1>
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="username (4-30 characters)"
        autoComplete="username"
        required
        minLength={4}
        maxLength={30}
        pattern="[a-zA-Z0-9_.\-]+"
        title="Letters, numbers, dot, dash or underscore"
        value={username}
        onChange={(ev) => setUsername(ev.target.value)}
      />
      <input
        type="password"
        placeholder="password (min 8 characters)"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        value={password}
        onChange={(ev) => setPassword(ev.target.value)}
      />
      <button disabled={submitting}>{submitting ? "Creating account…" : "Register"}</button>
    </form>
  );
}
