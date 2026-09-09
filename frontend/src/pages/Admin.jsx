import React, { useEffect, useMemo, useState } from "react";
import { getToken, getTokenPayload } from "../utils/auth";

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readableDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AdminPage() {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [stats, setStats] = useState([]);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState(null);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingQuizId, setDeletingQuizId] = useState(null);

  const token = getToken();
  const headers = { Authorization: `Bearer ${token}` };
  const currentAdminEmail = getTokenPayload(token)?.sub;
  const isPrimaryAdmin = currentAdminEmail === "codeprolkyt@gmail.com";

  const loadAdminData = async () => {
    try {
      const [quizResponse, userResponse, statsResponse] = await Promise.all([
        fetch("/api/admin/quizzes", { headers, cache: "no-store" }),
        fetch("/api/admin/users", { headers, cache: "no-store" }),
        fetch("/api/admin/stats", { headers, cache: "no-store" }),
      ]);

      const [quizData, userData, statsData] = await Promise.all([
        quizResponse.json(),
        userResponse.json(),
        statsResponse.json(),
      ]);

      if (!quizResponse.ok) throw new Error(quizData.detail || "Unable to load quizzes.");
      if (!userResponse.ok) throw new Error(userData.detail || "Unable to load users.");
      if (!statsResponse.ok) throw new Error(statsData.detail || "Unable to load statistics.");

      setQuizzes(quizData.quizzes || []);
      setUsers(userData.users || []);
      setStats(statsData.days || []);
    } catch (error) {
      setMessage(error.message || "Unable to load the admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetQuizForm = () => {
    setEditingQuizId(null);
    setQuestion("");
    setOptions(["", "", "", ""]);
    setCorrect(0);
    setDate(today);
  };

  const editQuiz = (quiz) => {
    if (quiz.status === "completed") {
      setMessage("Completed quizzes are kept as historical records and cannot be edited.");
      return;
    }

    setEditingQuizId(quiz.id);
    setQuestion(quiz.question);
    setOptions(Array.isArray(quiz.options) ? [...quiz.options] : ["", "", "", ""]);
    setCorrect(quiz.correct_index ?? 0);
    setDate(quiz.date);
    setMessage(`Editing quiz scheduled for ${readableDate(quiz.date)}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    resetQuizForm();
    setMessage(null);
  };

  const deleteQuiz = async (quiz) => {
    if (quiz.status === "completed") return;

    const firstConfirmed = window.confirm(
      quiz.status === "today"
        ? "Delete today's quiz?"
        : `Delete the quiz scheduled for ${readableDate(quiz.date)}?`,
    );

    if (!firstConfirmed) return;

    setDeletingQuizId(quiz.id);
    setMessage(null);

    try {
      let response = await fetch(`/api/admin/quiz/${quiz.id}`, {
        method: "DELETE",
        headers,
      });

      let data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to delete quiz.");
      }

      if (data?.requires_confirmation) {
        const count = data.submission_count || 0;
        const confirmed = window.confirm(
          `This quiz has ${count} submission${count === 1 ? "" : "s"}. ` +
          "Deleting it will also delete those submissions and may change the leaderboard. " +
          "Do you still want to delete this quiz?",
        );

        if (!confirmed) {
          setMessage("Quiz deletion cancelled.");
          return;
        }

        response = await fetch(`/api/admin/quiz/${quiz.id}?force=true`, {
          method: "DELETE",
          headers,
        });

        data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.detail || "Unable to delete quiz.");
        }
      }

      if (editingQuizId === quiz.id) resetQuizForm();
      setMessage("Quiz deleted successfully.");
      await loadAdminData();
    } catch (error) {
      setMessage(error.message || "Unable to delete quiz.");
    } finally {
      setDeletingQuizId(null);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (savingQuiz) return;

    setMessage(null);
    const cleanedQuestion = question.trim();
    const cleanedOptions = options.map((option) => option.trim());

    if (!cleanedQuestion) {
      setMessage("Please enter a question.");
      return;
    }

    if (cleanedOptions.some((option) => !option)) {
      setMessage("Please complete all four answer options.");
      return;
    }

    if (date < today) {
      setMessage("You cannot schedule a quiz for a past date.");
      return;
    }

    setSavingQuiz(true);

    try {
      const payload = {
        question: cleanedQuestion,
        options: cleanedOptions,
        correct_index: Number(correct),
        date,
      };

      const response = await fetch(
        `/api/admin/quiz${editingQuizId ? `/${editingQuizId}` : ""}`,
        {
          method: editingQuizId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        let detail = data?.detail;
        if (Array.isArray(detail)) {
          detail = detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
        }
        throw new Error(typeof detail === "string" ? detail : "Unable to save quiz.");
      }

      const wasEditing = editingQuizId !== null;
      const savedDate = date;
      resetQuizForm();

      setMessage(
        wasEditing
          ? "Quiz updated successfully."
          : `Quiz scheduled for ${readableDate(savedDate)}.`,
      );

      await loadAdminData();
    } catch (error) {
      setMessage(error.message || "Unable to save quiz.");
    } finally {
      setSavingQuiz(false);
    }
  };

  const searchUsers = async (event) => {
    const value = event.target.value;
    setUserSearch(value);
    setUserPage(1);

    try {
      const response = await fetch(
        `/api/admin/users?search=${encodeURIComponent(value)}`,
        { headers, cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Unable to search users.");
      setUsers(data.users || []);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Remove this user?")) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Unable to remove user.");
      setMessage("User removed.");
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const makeAdmin = async (userId) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/make-admin`, {
        method: "POST",
        headers,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Unable to grant admin access.");
      setMessage("User is now an admin.");
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const todayQuizzes = quizzes.filter((quiz) => quiz.status === "today");
  const scheduledQuizzes = quizzes
    .filter((quiz) => quiz.status === "scheduled")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const quizActions = (quiz) => (
    <span className="admin-row-actions">
      <button type="button" onClick={() => editQuiz(quiz)}>
        Edit
      </button>
      <button
        type="button"
        onClick={() => deleteQuiz(quiz)}
        disabled={deletingQuizId === quiz.id}
      >
        {deletingQuizId === quiz.id ? "Deleting..." : "Delete"}
      </button>
    </span>
  );

  return (
    <div className="admin-page">
      <div className="admin-hero">
        <p className="admin-kicker">CODEPRO LK / CONTROL ROOM</p>
        <h2>Admin Dashboard</h2>
        <p>Schedule quizzes, manage members, publish the latest post, and watch the current month’s quiz performance.</p>
      </div>

      <section className="admin-section">
        <h3>{editingQuizId ? "Edit Quiz" : "Schedule a Quiz"}</h3>

        <form onSubmit={submit}>
          <label htmlFor="quiz-date">Quiz Date</label>
          <input
            id="quiz-date"
            type="date"
            value={date}
            min={today}
            required
            onChange={(event) => setDate(event.target.value)}
          />
          <small>
            Choose today or any future date. The quiz will be available on that date automatically.
          </small>

          <label htmlFor="quiz-question">Question</label>
          <textarea
            id="quiz-question"
            value={question}
            required
            onChange={(event) => setQuestion(event.target.value)}
          />

          {options.map((option, index) => (
            <div key={index}>
              <label htmlFor={`quiz-option-${index}`}>Option {index + 1}</label>
              <input
                id={`quiz-option-${index}`}
                value={option}
                required
                onChange={(event) => {
                  const copy = [...options];
                  copy[index] = event.target.value;
                  setOptions(copy);
                }}
              />
            </div>
          ))}

          <label htmlFor="correct-option">Correct Option</label>
          <select
            id="correct-option"
            value={correct}
            onChange={(event) => setCorrect(Number(event.target.value))}
          >
            {options.map((option, index) => (
              <option value={index} key={index}>
                Option {index + 1}: {option || "Empty"}
              </option>
            ))}
          </select>

          <p>
            This quiz will become available automatically on{" "}
            <strong>{readableDate(date)}</strong> and will remain available until the end of that day.
          </p>

          <button type="submit" disabled={savingQuiz}>
            {savingQuiz ? "Saving..." : editingQuizId ? "Save Quiz Changes" : "Schedule Quiz"}
          </button>

          {editingQuizId && (
            <button
              type="button"
              className="admin-cancel-button"
              onClick={cancelEdit}
              disabled={savingQuiz}
            >
              Cancel Edit
            </button>
          )}
        </form>

        {message && <p role="status">{message}</p>}
      </section>

      <section className="admin-section">
        <h3>Today's Quiz</h3>
        {loading ? (
          <p>Loading…</p>
        ) : todayQuizzes.length === 0 ? (
          <p>No quiz is scheduled for today.</p>
        ) : (
          todayQuizzes.map((quiz) => (
            <div className="admin-list-row" key={quiz.id}>
              <span>
                <strong>{quiz.question}</strong>{" "}
                <small>{quiz.date} · Today</small>
              </span>
              {quizActions(quiz)}
            </div>
          ))
        )}
      </section>

      <section className="admin-section">
        <h3>Upcoming Quizzes</h3>
        {loading ? (
          <p>Loading…</p>
        ) : scheduledQuizzes.length === 0 ? (
          <p>No future quizzes scheduled.</p>
        ) : (
          scheduledQuizzes.map((quiz) => (
            <div className="admin-list-row" key={quiz.id}>
              <span>
                <strong>{quiz.question}</strong>{" "}
                <small>{quiz.date} · Scheduled</small>
              </span>
              {quizActions(quiz)}
            </div>
          ))
        )}
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
              <strong>{user.username}</strong>{" "}
              <small>
                {user.email} · WhatsApp: {user.whatsapp_number || "Not provided"}
              </small>
            </span>

            {isPrimaryAdmin && user.role !== "admin" && (
              <button type="button" onClick={() => makeAdmin(user.id)}>
                Make Admin
              </button>
            )}

            <button
              type="button"
              disabled={user.role === "admin"}
              title={user.role === "admin" ? "Admin accounts cannot be removed" : "Remove user"}
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
        <h3>Current Month Statistics</h3>
        <div className="admin-stats-grid" aria-label="Daily quiz statistics">
          {stats.length === 0 ? (
            <p>No quiz activity has been recorded this month.</p>
          ) : (
            stats.map((day) => {
              return (
                <div key={day.date}>
                  <strong>{day.date.slice(8)}</strong>
                  <span>{day.attempts} attempts</span>
                  <span>{day.correct} correct</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
