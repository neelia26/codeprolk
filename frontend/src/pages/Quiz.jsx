import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getToken } from "../utils/auth";

export default function QuizPage() {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState(null);
  const [unavailableReason, setUnavailableReason] = useState(null);

  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    fetch("/api/quiz/today", {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        setQuiz(data.quiz || null);
        setUnavailableReason(
          data.submitted ? "submitted" : data.expired ? "expired" : null,
        );
        setLoading(false);
      })
      .catch(() => {
        setMessage("Unable to load the quiz. Please refresh to try again.");
        setLoading(false);
      });
  }, []);

  const submit = async () => {
    if (!quiz || selected === null || submitLock.current) return;

    submitLock.current = true;
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          quiz_id: quiz.id,
          selected_index: selected,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          typeof data.detail === "string"
            ? data.detail
            : "Submission failed.",
        );
        return;
      }

      setResult(
        data.is_correct === true
          ? "correct"
          : data.is_correct === false
            ? "incorrect"
            : "submitted",
      );

      setQuiz(null);
      setSelected(null);
      setUnavailableReason("submitted");
    } catch {
      setMessage(
        "Could not confirm your submission. Refresh to check whether your attempt was recorded before trying again.",
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (result) {
    const correct = result === "correct";
    const incorrect = result === "incorrect";

    return (
      <section className="challenge-surface">
        <div
          className={`quiz-page quiz-status-page quiz-feedback quiz-feedback-${result}`}
        >
          {correct && (
            <div className="quiz-confetti" aria-hidden="true">
              {Array.from({ length: 36 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    "--x": `${3 + ((index * 19) % 94)}%`,
                    "--delay": `${(index % 9) * 0.06}s`,
                    "--drift": `${((index * 31) % 121) - 60}px`,
                    "--spin": `${index % 2 ? 480 : -480}deg`,
                    "--color": [
                      "#7dd3fc",
                      "#e4c985",
                      "#f1f5f9",
                      "#6ee7b7",
                    ][index % 4],
                  }}
                />
              ))}
            </div>
          )}

          <div
            role="status"
            aria-live="polite"
            className="quiz-feedback-copy"
          >
            <span className="quiz-status-mark" aria-hidden="true">
              {correct ? "✓" : incorrect ? "×" : "✓"}
            </span>

            <h2>
              {correct
                ? "Correct answer!"
                : incorrect
                  ? "Not quite this time"
                  : "Answer submitted"}
            </h2>

            <p>
              {correct
                ? "Excellent work! Stay tuned to our WhatsApp channel for the correct answer and a short explanation."
                : incorrect
                  ? "Keep learning! Stay tuned to our WhatsApp channel to see the correct answer and understand why."
                  : "Your attempt has been recorded. Stay tuned to our WhatsApp channel for the answer and explanation."}
            </p>
          </div>

          <Link className="quiz-status-link" to="/leaderboard">
            View leaderboard
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="challenge-surface">
        <div className="quiz-page quiz-status-page">
          <p className="quiz-status">Loading today&apos;s quiz...</p>
        </div>
      </section>
    );
  }

  if (unavailableReason === "submitted") {
    return (
      <section className="challenge-surface">
        <div className="quiz-page quiz-status-page">
          <span className="quiz-status-mark" aria-hidden="true">
            ✓
          </span>

          <h2>No attempts available</h2>

          <p>You have already submitted today&apos;s quiz.</p>

          <Link className="quiz-status-link" to="/leaderboard">
            View leaderboard
          </Link>
        </div>
      </section>
    );
  }

  if (!quiz) {
    return (
      <section className="challenge-surface">
        <div className="quiz-page quiz-status-page">
          <span className="quiz-status-mark" aria-hidden="true">
            —
          </span>

          <h2>No quiz available at the moment</h2>

          <p>{message || "Please wait"}</p>

          <Link className="quiz-status-link" to="/leaderboard">
            View leaderboard
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="challenge-surface">
      <div className="quiz-page">
        <h2>Daily Quiz</h2>

        <p>{quiz.question}</p>

        <ul>
          {quiz.options.map((option, index) => (
            <li key={index}>
              <label>
                <input
                  type="radio"
                  name="opt"
                  checked={selected === index}
                  disabled={submitting}
                  onChange={() => setSelected(index)}
                />{" "}
                {option}
              </label>
            </li>
          ))}
        </ul>

        <button
          onClick={submit}
          disabled={selected === null || submitting}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>

        {message && <p role="alert">{message}</p>}
      </div>
    </section>
  );
}