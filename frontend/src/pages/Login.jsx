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

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await readResponse(res);
    if (!res.ok) {
      setError(data.detail || "Login failed");
      return;
    }
    setToken(data.access_token);
    navigate("/quiz");
  };

  return (
    <div className="auth-page">
      <h2>Login</h2>
      <form onSubmit={submit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>
        New user? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}
