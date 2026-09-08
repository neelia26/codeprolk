import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import {
  getToken,
} from "../utils/auth";


export default function QuizPage() {
  const location =
    useLocation();

  const [
    quiz,
    setQuiz,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    correctIndex,
    setCorrectIndex,
  ] = useState(null);

  const [
    message,
    setMessage,
  ] = useState(null);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    animate,
    setAnimate,
  ] = useState(false);

  const lock =
    useRef(false);

  const lastLoadedDate =
    useRef(null);


  const resultOf = (
    value,
  ) =>
    value === true
      ? "correct"
      : value === false
        ? "incorrect"
        : "submitted";


  const browserDateKey =
    () => {
      const now =
        new Date();

      return [
        now.getFullYear(),
        String(
          now.getMonth() +
            1,
        ).padStart(
          2,
          "0",
        ),
        String(
          now.getDate(),
        ).padStart(
          2,
          "0",
        ),
      ].join("-");
    };


  const loadQuiz =
    useCallback(
      async ({
        showLoading = true,
      } = {}) => {
        if (showLoading) {
          setLoading(true);
        }

        setMessage(null);

        try {
          const response =
            await fetch(
              "/api/quiz/today",
              {
                method:
                  "GET",

                headers: {
                  Authorization:
                    `Bearer ${getToken()}`,
                },

                cache:
                  "no-store",
              },
            );

          if (!response.ok) {
            throw new Error(
              response.status ===
                401
                ? "Your session has expired. Please log in again."
                : "Unable to load the quiz. Please refresh to try again.",
            );
          }

          const data =
            await response.json();

          /*
           * Always clear the previous quiz state before applying
           * today's backend response. This is what prevents
           * yesterday's submission from remaining on screen.
           */
          setQuiz(
            data.quiz ||
              null,
          );

          setSelected(null);

          setSubmitted(
            Boolean(
              data.submitted,
            ),
          );

          setResult(null);

          setCorrectIndex(
            null,
          );

          setAnimate(false);

          if (
            data.submitted &&
            data.submission
          ) {
            setSelected(
              data.submission
                .selected_index ??
                null,
            );

            setResult(
              resultOf(
                data.submission
                  .is_correct,
              ),
            );

            setCorrectIndex(
              data.submission
                .correct_index ??
                null,
            );
          }

          if (
            data.expired &&
            !data.submitted
          ) {
            setMessage(
              "Today's quiz has expired.",
            );
          }

          lastLoadedDate.current =
            browserDateKey();
        } catch (error) {
          setQuiz(null);

          setMessage(
            error.message ||
              "Unable to load today's quiz.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  /*
   * Load today's quiz when this route is opened.
   */
  useEffect(() => {
    loadQuiz();

    // location.pathname is intentional:
    // when React returns to /quiz, we ask the backend again.
  }, [
    loadQuiz,
    location.pathname,
  ]);


  /*
   * Re-check when the user comes back to the browser tab.
   *
   * Example:
   * Monday -> user completes Monday's quiz.
   * They leave the tab open overnight.
   * Tuesday -> they return to the same tab.
   *
   * The backend is queried again and Tuesday's quiz replaces
   * Monday's state without requiring logout/login.
   */
  useEffect(() => {
    const refreshIfNeeded =
      () => {
        if (
          document.visibilityState !==
          "visible"
        ) {
          return;
        }

        const currentDate =
          browserDateKey();

        if (
          lastLoadedDate.current !==
          currentDate
        ) {
          loadQuiz({
            showLoading:
              false,
          });
        }
      };


    const handleFocus =
      () => {
        /*
         * Re-fetch even on the same day.
         *
         * This is useful when the admin creates today's quiz
         * after a user previously opened the page and saw
         * "No quiz available".
         */
        loadQuiz({
          showLoading:
            false,
        });
      };


    document.addEventListener(
      "visibilitychange",
      refreshIfNeeded,
    );

    window.addEventListener(
      "focus",
      handleFocus,
    );


    return () => {
      document.removeEventListener(
        "visibilitychange",
        refreshIfNeeded,
      );

      window.removeEventListener(
        "focus",
        handleFocus,
      );
    };
  }, [loadQuiz]);


  const submit =
    async () => {
      if (
        !quiz ||
        selected === null ||
        submitted ||
        lock.current
      ) {
        return;
      }

      lock.current =
        true;

      setSubmitting(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            "/api/quiz/submit",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${getToken()}`,
              },

              body:
                JSON.stringify(
                  {
                    quiz_id:
                      quiz.id,

                    selected_index:
                      selected,
                  },
                ),
            },
          );

        const data =
          await response
            .json()
            .catch(
              () => null,
            );

        if (!response.ok) {
          setMessage(
            typeof data?.detail ===
              "string"
              ? data.detail
              : "Submission failed.",
          );

          return;
        }

        setResult(
          resultOf(
            data.is_correct,
          ),
        );

        setCorrectIndex(
          data.correct_index ??
            null,
        );

        setSubmitted(true);
        setAnimate(true);
      } catch {
        setMessage(
          "Could not confirm your submission. Refresh to check whether your attempt was recorded before trying again.",
        );
      } finally {
        lock.current =
          false;

        setSubmitting(false);
      }
    };


  if (
    loading ||
    !quiz
  ) {
    return (
      <section className="challenge-surface">
        <div className="quiz-page quiz-status-page">
          <h2>
            {loading
              ? "Loading today's quiz…"
              : "No quiz available at the moment"}
          </h2>

          {!loading && (
            <>
              <p>
                {message ||
                  "Please check back later."}
              </p>

              <Link
                className="quiz-status-link"
                to="/leaderboard"
              >
                View
                leaderboard
              </Link>
            </>
          )}
        </div>
      </section>
    );
  }


  return (
    <section className="challenge-surface">
      <div
        className={`quiz-page quiz-review ${
          submitted
            ? `quiz-review-${result}`
            : ""
        } ${
          animate
            ? "quiz-review-animate"
            : ""
        }`}
      >
        {animate &&
          result ===
            "correct" && (
            <div
              className="quiz-review-confetti"
              aria-hidden="true"
            >
              {Array.from(
                {
                  length:
                    36,
                },
                (
                  _,
                  index,
                ) => (
                  <i
                    key={
                      index
                    }
                    style={{
                      "--x": `${
                        3 +
                        ((index *
                          19) %
                          94)
                      }%`,

                      "--delay": `${
                        (index %
                          9) *
                        0.06
                      }s`,

                      "--drift": `${
                        ((index *
                          31) %
                          121) -
                        60
                      }px`,

                      "--color":
                        [
                          "#7dd3fc",
                          "#e4c985",
                          "#f1f5f9",
                          "#6ee7b7",
                        ][
                          index %
                            4
                        ],
                    }}
                  />
                ),
              )}
            </div>
          )}


        <h2>
          Daily Quiz
        </h2>

        <p
          className="quiz-review-question"
          id="quiz-question"
        >
          {quiz.question}
        </p>


        <ul
          className="quiz-review-options"
          aria-labelledby="quiz-question"
        >
          {quiz.options.map(
            (
              option,
              index,
            ) => {
              const chosen =
                selected ===
                index;

              const revealed =
                submitted &&
                Number.isInteger(
                  correctIndex,
                );

              const isRight =
                index ===
                correctIndex;


              let choiceClass =
                "";

              if (revealed) {
                if (chosen) {
                  choiceClass =
                    isRight
                      ? "quiz-review-choice-correct"
                      : "quiz-review-choice-incorrect";
                } else {
                  choiceClass =
                    "quiz-review-choice-neutral";
                }
              }


              let circleClass =
                "";

              if (revealed) {
                if (chosen) {
                  circleClass =
                    isRight
                      ? "quiz-answer-circle-correct"
                      : "quiz-answer-circle-incorrect";
                } else {
                  circleClass =
                    "quiz-answer-circle-neutral";
                }
              }


              return (
                <li
                  key={
                    index
                  }
                >
                  <label
                    className={
                      choiceClass
                    }
                  >
                    {submitted ? (
                      <span
                        className={`quiz-answer-circle ${circleClass}`}
                        role="img"
                        aria-label={
                          revealed
                            ? isRight
                              ? "Correct answer"
                              : "Incorrect answer"
                            : "Answer recorded"
                        }
                      >
                        <span
                          aria-hidden="true"
                        >
                          {revealed
                            ? isRight
                              ? "✓"
                              : "×"
                            : chosen
                              ? "•"
                              : ""}
                        </span>
                      </span>
                    ) : (
                      <input
                        type="radio"
                        name="opt"
                        checked={
                          chosen
                        }
                        disabled={
                          submitting
                        }
                        onChange={() =>
                          setSelected(
                            index,
                          )
                        }
                      />
                    )}

                    <span className="quiz-review-option-text">
                      {option}
                    </span>

                    {submitted &&
                      chosen && (
                        <span className="quiz-review-badge">
                          Your
                          answer
                        </span>
                      )}
                  </label>
                </li>
              );
            },
          )}
        </ul>


        {submitted ? (
          <div
            className="quiz-review-summary"
            role="status"
            aria-live="polite"
          >
            <strong>
              {result ===
              "correct"
                ? "Correct answer!"
                : result ===
                    "incorrect"
                  ? "Not quite this time"
                  : "Answer submitted"}
            </strong>

            <p>
              {result ===
              "correct"
                ? "Excellent work! Stay tuned to our WhatsApp channel for the answer and a short explanation."
                : result ===
                    "incorrect"
                  ? "Keep learning! Stay tuned to our WhatsApp channel to see the correct answer and understand why."
                  : "Stay tuned to our WhatsApp channel for the answer and explanation."}
            </p>

            <p className="quiz-review-locked">
              No attempts
              available — you
              have already
              submitted this
              quiz.
            </p>

            <Link
              className="quiz-status-link"
              to="/leaderboard"
            >
              View
              leaderboard
            </Link>
          </div>
        ) : (
          <button
            onClick={
              submit
            }
            disabled={
              selected ===
                null ||
              submitting
            }
          >
            {submitting
              ? "Submitting..."
              : "Submit"}
          </button>
        )}

        {message && (
          <p role="alert">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}