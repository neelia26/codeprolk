import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (!token) {
      setError("Reset token is missing. Please request a new password reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await readResponse(response);

      if (!response.ok) {
        setError(data.detail || "Unable to reset password.");
        return;
      }

      setMessage("Your password has been updated. Redirecting to login...");
      window.setTimeout(() => navigate("/login"), 1400);
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
        <p className="auth-page-tag">CODEPRO LK / NEW PASSWORD</p>
        <h2>Reset password</h2>

        <form onSubmit={submit}>
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label htmlFor="reset-confirm-password">Confirm password</label>
          <input
            id="reset-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Updating..." : "Update password"}
          </button>
        </form>

        {message && <p className="success" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <p className="auth-page-footer">
          Need a new link? <Link to="/forgot-password">Request another</Link>
        </p>
      </div>
    </section>
  );
}
