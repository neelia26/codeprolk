import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [registered, setRegistered] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setRegistered(false);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        email,
        whatsapp_number: whatsappNumber,
        password,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
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
      <div className="auth-page auth-success-page">
        <span className="auth-success-mark" aria-hidden="true">
          ✓
        </span>
        <h2>Registration successful</h2>
        <p>
          Your account <strong>{username}</strong> is ready. You can now log in.
        </p>
        <button type="button" onClick={() => navigate("/login")}>
          Go to login
        </button>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h2>Register</h2>
      <form onSubmit={submit}>
        <label>Username</label>
        <input
          value={username}
          minLength={3}
          maxLength={50}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label>WhatsApp number</label>
        <input
          type="tel"
          value={whatsappNumber}
          minLength={7}
          maxLength={20}
          pattern="\\+?[0-9\\s()\\-]+"
          onChange={(e) => setWhatsappNumber(e.target.value)}
          placeholder="e.g. +94771234567"
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          minLength={8}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Register</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
