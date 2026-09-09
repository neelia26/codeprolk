import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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
    setMessage("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await readResponse(response);

      if (!response.ok) {
        setError(data.detail || "Unable to send reset link.");
        return;
      }

      setMessage(data.message || "If an account exists for that email, a reset link has been sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-surface">
      <div className="auth-surface-grid" aria-hidden="true" />
      <div className="auth-surface-orb auth-surface-orb-left" aria-hidden="true" />
      <div className="auth-surface-orb auth-surface-orb-right" aria-hidden="true" />

      <div className="auth-page">
        <p className="auth-page-tag">CODEPRO LK / PASSWORD HELP</p>
        <h2>Forgot password</h2>

        <form onSubmit={submit}>
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message && <p className="success" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <p className="auth-page-footer">
          Remembered it? <Link to="/login">Back to login</Link>
        </p>
      </div>
    </section>
  );
}
