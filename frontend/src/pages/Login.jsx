import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setToken } from "../utils/auth";

// const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const readResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return { detail: `Request failed with status ${response.status}` };
    }
    return response.json();
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await readResponse(response);
    if (!response.ok) {
      setError(data.detail || "Login failed");
      return;
    }
    setToken(data.access_token);
    navigate("/quiz");
  };

  return (
    <section className="auth-surface">
      <div className="auth-surface-grid" aria-hidden="true" />
      <div className="auth-surface-orb auth-surface-orb-left" aria-hidden="true" />
      <div className="auth-surface-orb auth-surface-orb-right" aria-hidden="true" />

      <div className="auth-page">
        <p className="auth-page-tag">CODEPRO LK / MEMBER ACCESS</p>
        <h2>Login</h2>

        <form onSubmit={submit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit">Login</button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        <p className="auth-page-footer">
          New user? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}
