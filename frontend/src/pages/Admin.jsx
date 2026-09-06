import React, { useState, useEffect } from "react";
import { getToken, getTokenPayload } from "../utils/auth";

// const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateTimeInputValue(date) {
  const localDate = new Date(date);
  localDate.setHours(23, 59, 0, 0);
  const localDateWithOffset = new Date(
    localDate.getTime() - localDate.getTimezoneOffset() * 60000,
  );
  return localDateWithOffset.toISOString().slice(0, 16);
}

export default function AdminPage() {
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [stats, setStats] = useState([]);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [expiry, setExpiry] = useState(() => toDateTimeInputValue(new Date()));
  const [message, setMessage] = useState(null);

  const headers = { Authorization: `Bearer ${getToken()}` };
  const currentAdminEmail = getTokenPayload(getToken())?.sub;
  const isPrimaryAdmin = currentAdminEmail === "codeprolkyt@gmail.com";

  const loadAdminData = async () => {
    const [quizResponse, userResponse, statsResponse] = await Promise.all([
      fetch("/api/admin/quizzes", { headers }),
      fetch("/api/admin/users", { headers }),
      fetch("/api/admin/stats", { headers }),
    ]);
    const [quizData, userData, statsData] = await Promise.all([
      quizResponse.json(),
      userResponse.json(),
      statsResponse.json(),
    ]);
    setQuizzes(quizData.quizzes || []);
    setUsers(userData.users || []);
    setStats(statsData.days || []);
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const searchUsers = async (event) => {
    setUserSearch(event.target.value);
    setUserPage(1);
    const response = await fetch(
      `/api/admin/users?search=${encodeURIComponent(event.target.value)}`,
      { headers },
    );
    const data = await response.json();
    setUsers(data.users || []);
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Remove this user?")) return;
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers,
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.detail || "Unable to remove user");
      return;
    }
    setMessage("User removed");
    loadAdminData();
  };

  const makeAdmin = async (userId) => {
    const response = await fetch(`/api/admin/users/${userId}/make-admin`, {
      method: "POST",
      headers,
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.detail || "Unable to grant admin access");
      return;
    }
    setMessage("User is now an admin");
    loadAdminData();
  };

  const editQuiz = (quiz) => {
    setEditingQuizId(quiz.id);
    setQuestion(quiz.question);
    setOptions(quiz.options || ["", "", "", ""]);
    setCorrect(quiz.correct_index ?? 0);
    setDate(quiz.date);
    setExpiry(quiz.expiry.slice(0, 16));
    setMessage("Editing active quiz");
  };

  const cancelEdit = () => {
    setEditingQuizId(null);
    setQuestion("");
    setOptions(["", "", "", ""]);
    setCorrect(0);
    setDate(toDateInputValue(new Date()));
    setExpiry(toDateTimeInputValue(new Date()));
    setMessage(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    const token = getToken();
    const payload = {
      question,
      options,
      correct_index: Number(correct),
      date,
      expiry,
    };
    const res = await fetch(
      `/api/admin/quiz${editingQuizId ? `/${editingQuizId}` : ""}`,
      {
        method: editingQuizId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      const detail = Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
        : data.detail && typeof data.detail === "object"
          ? data.detail.msg || JSON.stringify(data.detail)
          : data.detail;
      setMessage(String(detail || "Error creating quiz"));
      return;
    }
    setMessage(editingQuizId ? "Quiz updated" : "Quiz created");
    setEditingQuizId(null);
    loadAdminData();
  };

  return (
    <div className="admin-page">
      <h2>Admin Dashboard</h2>
      <form onSubmit={submit}>
        <label>Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        {options.map((o, i) => (
          <div key={i}>
            <label>Option {i + 1}</label>
            <input
              value={o}
              onChange={(e) => {
                const copy = [...options];
                copy[i] = e.target.value;
                setOptions(copy);
              }}
            />
          </div>
        ))}
        <label>Correct Option</label>
        <select value={correct} onChange={(e) => setCorrect(e.target.value)}>
          {options.map((option, index) => (
            <option value={index} key={index}>
              Option {index + 1}: {option || "Empty"}
            </option>
          ))}
        </select>
        <label>Date (YYYY-MM-DD)</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <label>Expiry (ISO datetime)</label>
        <input
          type="datetime-local"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
        />
        <button type="submit">
          {editingQuizId ? "Save Quiz Changes" : "Create Quiz"}
        </button>
        {editingQuizId && (
          <button
            type="button"
            className="admin-cancel-button"
            onClick={cancelEdit}
          >
            Cancel Edit
          </button>
        )}
      </form>
      {message && <p>{message}</p>}
      <section className="admin-section">
        <h3>Current quizzes</h3>
        {quizzes
          .filter((quiz) => quiz.is_active)
          .map((quiz) => (
            <div className="admin-list-row" key={quiz.id}>
              <span>
                {quiz.question}{" "}
                <small>
                  {quiz.date} · {quiz.is_active ? "Active" : "Inactive"}
                </small>
              </span>
              <button type="button" onClick={() => editQuiz(quiz)}>
                Edit
              </button>
            </div>
          ))}
      </section>
      <section className="admin-section">
        <h3>Users</h3>
        <input
          placeholder="Search username or email"
          value={userSearch}
          onChange={searchUsers}
        />
        {users.slice((userPage - 1) * 5, userPage * 5).map((user) => (
          <div className="admin-list-row" key={user.id}>
            <span>
              <strong>{user.username}</strong> <small>{user.email}</small>
            </span>
            {isPrimaryAdmin && user.role !== "admin" && (
              <button type="button" onClick={() => makeAdmin(user.id)}>
                Make Admin
              </button>
            )}
            <button
              type="button"
              disabled={user.role === "admin"}
              title={
                user.role === "admin"
                  ? "Admin accounts cannot be removed"
                  : "Remove user"
              }
              onClick={() => deleteUser(user.id)}
            >
              Remove
            </button>
          </div>
        ))}
        <nav className="admin-pagination" aria-label="User pages">
          {Array.from(
            { length: Math.max(1, Math.ceil(users.length / 5)) },
            (_, index) => index + 1,
          ).map((pageNumber) => (
            <button
              type="button"
              className={pageNumber === userPage ? "active" : ""}
              onClick={() => setUserPage(pageNumber)}
              key={pageNumber}
            >
              {pageNumber}
            </button>
          ))}
        </nav>
      </section>
      <section className="admin-section">
        <h3>Current month statistics</h3>
        <div className="admin-stats-grid">
          {stats.map((day) => (
            <div key={day.date}>
              <strong>{day.date.slice(8)}</strong>
              <span>{day.attempts} attempts</span>
              <span>{day.correct} correct</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
