import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [registered, setRegistered] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setRegistered(false);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        email,
        whatsapp_number: whatsappNumber,
        password,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
        : data.detail && typeof data.detail === "object"
          ? data.detail.msg || JSON.stringify(data.detail)
          : data.detail;
      setError(String(detail || "Registration failed"));
      return;
    }
    setRegistered(true);
  };

  if (registered) {
    return (
      <section className="auth-surface">
        <div className="auth-surface-grid" aria-hidden="true" />
        <div className="auth-surface-orb auth-surface-orb-left" aria-hidden="true" />
        <div className="auth-surface-orb auth-surface-orb-right" aria-hidden="true" />

        <div className="auth-page auth-success-page">
          <span className="auth-success-mark" aria-hidden="true">✓</span>
          <p className="auth-page-tag">ACCOUNT CREATED</p>
          <h2>Registration successful</h2>
          <p>
            Your account <strong>{username}</strong> is ready. You can now log in.
          </p>
          <button type="button" onClick={() => navigate("/login")}>
            Go to login
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-surface">
      <div className="auth-surface-grid" aria-hidden="true" />
      <div className="auth-surface-orb auth-surface-orb-left" aria-hidden="true" />
      <div className="auth-surface-orb auth-surface-orb-right" aria-hidden="true" />

      <div className="auth-page register-page">
        <p className="auth-page-tag">CODEPRO LK / CREATE ACCOUNT</p>
        <h2>Register</h2>

        <form onSubmit={submit}>
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            value={username}
            minLength={3}
            maxLength={50}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="register-whatsapp">WhatsApp number</label>
          <input
            id="register-whatsapp"
            type="tel"
            value={whatsappNumber}
            minLength={7}
            maxLength={20}
            pattern="\\+?[0-9\\s()\\-]+"
            onChange={(event) => setWhatsappNumber(event.target.value)}
            placeholder="e.g. +94771234567"
            autoComplete="tel"
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            value={password}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />

          <button type="submit">Register</button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        <p className="auth-page-footer">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}