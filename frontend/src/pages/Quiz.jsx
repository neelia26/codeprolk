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
  getTokenPayload,
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
    comments,
    setComments,
  ] = useState([]);

  const [
    commentsLoading,
    setCommentsLoading,
  ] = useState(false);

  const [
    commentBody,
    setCommentBody,
  ] = useState("");

  const [
    commentMessage,
    setCommentMessage,
  ] = useState(null);

  const [
    commentSubmitting,
    setCommentSubmitting,
  ] = useState(false);

  const [
    deletingCommentId,
    setDeletingCommentId,
  ] = useState(null);

  const [
    anonymousComment,
    setAnonymousComment,
  ] = useState(false);

  const [
    emojiPickerOpen,
    setEmojiPickerOpen,
  ] = useState(false);

  const [
    liveIndex,
    setLiveIndex,
  ] = useState(0);

  const [
    animate,
    setAnimate,
  ] = useState(false);

  const lock =
    useRef(false);

  const lastLoadedDate =
    useRef(null);

  const emojiGroups = [
    {
      label: "Reactions",
      emojis: ["😀", "😄", "😂", "🤣", "😊", "😍", "🤩", "😮", "🤔", "😅", "😎", "🤯"],
    },
    {
      label: "Hands",
      emojis: ["👏", "🙌", "👍", "👎", "👌", "🤝", "🙏", "✌️", "👀", "💪", "🫡", "🫶"],
    },
    {
      label: "Learning",
      emojis: ["💡", "🧠", "📚", "✍️", "📝", "🎯", "🔍", "🧩", "📌", "📖", "🧪", "💻"],
    },
    {
      label: "Energy",
      emojis: ["🔥", "💯", "✨", "⚡", "🚀", "⭐", "🏆", "🎉", "✅", "❌", "❤️", "💙"],
    },
    {
      label: "Objects",
      emojis: ["⏰", "📈", "📊", "🔐", "🛠️", "⚙️", "🖥️", "📱", "🌐", "☕", "🎧", "🏁"],
    },
  ];

  const isAdmin =
    getTokenPayload(
      getToken(),
    )?.role === "admin";

  const lockedPreviewComments = [
    {
      id: "preview-1",
      body: "That option was trickier than it looked.",
      created_at: "2026-01-01T00:00:00",
      user: {
        username: "Member",
        initials: "M",
      },
    },
    {
      id: "preview-2",
      body: "I almost picked the same answer.",
      created_at: "2026-01-01T00:01:00",
      user: {
        username: "Anonymous",
        initials: "AN",
      },
    },
    {
      id: "preview-3",
      body: "The explanation is going to be useful today.",
      created_at: "2026-01-01T00:02:00",
      user: {
        username: "Member",
        initials: "M",
      },
    },
  ];


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


  const formatCommentTime =
    (value) => {
      const date =
        new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return date.toLocaleString(
        undefined,
        {
          month:
            "short",
          day:
            "numeric",
          hour:
            "numeric",
          minute:
            "2-digit",
        },
      );
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
          setComments([]);
          setCommentBody("");
          setCommentMessage(null);
          setEmojiPickerOpen(false);
          setLiveIndex(0);

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


  const loadComments =
    useCallback(
      async () => {
        if (!quiz?.id) {
          setComments([]);
          return;
        }

        setCommentsLoading(true);

        try {
          const response =
            await fetch(
              `/api/quiz/${quiz.id}/comments`,
              {
                headers: {
                  Authorization:
                    `Bearer ${getToken()}`,
                },
                cache:
                  "no-store",
              },
            );

          const data =
            await response
              .json()
              .catch(
                () => null,
              );

          if (!response.ok) {
            throw new Error(
              typeof data?.detail ===
                "string"
                ? data.detail
                : "Unable to load comments.",
            );
          }

          setComments(
            Array.isArray(
              data.comments,
            )
              ? data.comments
              : [],
          );
        } catch (error) {
          setCommentMessage(
            error.message ||
              "Unable to load comments.",
          );
        } finally {
          setCommentsLoading(false);
        }
      },
      [
        quiz?.id,
      ],
    );


  useEffect(() => {
    if (quiz?.id) {
      loadComments();
    }
  }, [
    quiz?.id,
    submitted,
    loadComments,
  ]);


  useEffect(() => {
    if (!quiz?.id || !submitted) {
      return undefined;
    }

    const intervalId =
      window.setInterval(
        loadComments,
        7000,
      );

    return () =>
      window.clearInterval(
        intervalId,
      );
  }, [
    quiz?.id,
    submitted,
    loadComments,
  ]);


  useEffect(() => {
    const poolLength =
      comments.length ||
      lockedPreviewComments.length;

    if (poolLength < 2) {
      setLiveIndex(0);
      return undefined;
    }

    const intervalId =
      window.setInterval(
        () => {
          setLiveIndex(
            (current) =>
              (current + 1) %
              poolLength,
          );
        },
        submitted
          ? 5500
          : 5500,
      );

    return () =>
      window.clearInterval(
        intervalId,
      );
  }, [
    comments.length,
    submitted,
  ]);

  const addEmoji =
    (emoji) => {
      setCommentBody(
        (current) =>
          `${current}${current ? " " : ""}${emoji}`,
      );
    };


  const submitComment =
    async (event) => {
      event.preventDefault();

      if (!submitted) {
        setCommentMessage(
          "Take the quiz first to unlock comments.",
        );
        return;
      }

      const body =
        commentBody.trim();

      if (!body || !quiz?.id) {
        setCommentMessage(
          "Write a comment before posting.",
        );
        return;
      }

      setCommentSubmitting(true);
      setCommentMessage(null);

      try {
        const response =
          await fetch(
            `/api/quiz/${quiz.id}/comments`,
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
                JSON.stringify({
                  body,
                  is_anonymous:
                    anonymousComment,
                }),
            },
          );

        const data =
          await response
            .json()
            .catch(
              () => null,
            );

        if (!response.ok) {
          throw new Error(
            typeof data?.detail ===
              "string"
              ? data.detail
              : "Unable to post comment.",
          );
        }

        if (data?.comment) {
          setComments(
            (current) => [
              ...current,
              data.comment,
            ],
          );
          setLiveIndex(0);
        }

        setCommentBody("");
        setEmojiPickerOpen(false);
      } catch (error) {
        setCommentMessage(
          error.message ||
            "Unable to post comment.",
        );
      } finally {
        setCommentSubmitting(false);
      }
    };


  const deleteComment =
    async (comment) => {
      if (!isAdmin || !window.confirm("Delete this comment?")) {
        return;
      }

      setDeletingCommentId(comment.id);
      setCommentMessage(null);

      try {
        const response =
          await fetch(
            `/api/admin/quiz-comments/${comment.id}`,
            {
              method:
                "DELETE",
              headers: {
                Authorization:
                  `Bearer ${getToken()}`,
              },
            },
          );

        const data =
          await response
            .json()
            .catch(
              () => null,
            );

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Unable to delete comment.",
          );
        }

        setComments(
          (current) =>
            current.filter(
              (item) =>
                item.id !== comment.id,
            ),
        );
      } catch (error) {
        setCommentMessage(
          error.message ||
            "Unable to delete comment.",
        );
      } finally {
        setDeletingCommentId(null);
      }
    };


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


  const liveComments =
    comments.length
      ? [
          ...comments.slice(
            liveIndex,
          ),
          ...comments.slice(
            0,
            liveIndex,
          ),
        ].reverse()
      : [];

  const visibleLiveComments =
    liveComments.length
      ? liveComments
      : submitted
        ? []
        : [
            ...lockedPreviewComments.slice(
              liveIndex,
            ),
            ...lockedPreviewComments.slice(
              0,
              liveIndex,
            ),
          ];

  const commentPanel = quiz && (
    <aside
      className={`quiz-live-panel ${
        submitted
          ? "quiz-live-panel-open"
          : "quiz-live-panel-locked"
      }`}
      aria-labelledby="quiz-live-title"
    >
      <div className="quiz-live-head">
        <span className="quiz-live-dot" />
        <div>
          <p className="quiz-live-kicker">
            Live comments
          </p>
          <h3 id="quiz-live-title">
            Quiz room
          </h3>
        </div>
        <span className="quiz-live-pill">
          {submitted
            ? "Open"
            : "Locked"}
        </span>
      </div>

      {!submitted && (
        <button
          type="button"
          className="quiz-live-lock"
          onClick={() =>
            setCommentMessage(
              "Take the quiz first to unlock comments.",
            )
          }
        >
          Take the quiz first
        </button>
      )}

      <div className="quiz-live-stream">
        {commentsLoading &&
        visibleLiveComments.length ===
          0 ? (
          <p className="quiz-comments-empty">
            Loading comments...
          </p>
        ) : visibleLiveComments.length ===
          0 ? (
          <p className="quiz-comments-empty">
            Waiting for the first reaction.
          </p>
        ) : (
          visibleLiveComments.map(
            (
              comment,
              index,
            ) => (
              <article
                className="quiz-live-comment"
                key={comment.id}
                style={{
                  "--delay": `${index * 90}ms`,
                }}
              >
                <span className="quiz-comment-avatar">
                  {comment.user?.initials ||
                    "U"}
                </span>
                <div className="quiz-comment-bubble">
                  {isAdmin &&
                    !String(comment.id).startsWith("preview-") && (
                      <button
                        type="button"
                        className="quiz-comment-delete"
                        onClick={() =>
                          deleteComment(comment)
                        }
                        disabled={
                          deletingCommentId ===
                          comment.id
                        }
                        title="Delete comment"
                        aria-label="Delete comment"
                      >
                        🗑
                      </button>
                    )}
                  <div className="quiz-comment-meta">
                    <strong>
                      {comment.user?.username ||
                        "Member"}
                    </strong>
                    <time dateTime={comment.created_at}>
                      {formatCommentTime(
                        comment.created_at,
                      )}
                    </time>
                  </div>
                  <p>
                    {comment.body}
                  </p>
                </div>
              </article>
            ),
          )
        )}
      </div>

      {!submitted ? (
        <p className="quiz-live-hint">
          Preview stays locked until your quiz attempt is submitted.
        </p>
      ) : (
        <form
          className="quiz-comment-form"
          onSubmit={submitComment}
        >
          <label htmlFor="quiz-comment-body">
            Add your thought
          </label>
          <textarea
            id="quiz-comment-body"
            value={commentBody}
            onChange={(event) =>
              setCommentBody(
                event.target.value,
              )
            }
            maxLength={500}
            rows={3}
            placeholder="React, ask, or share what clicked for you."
            disabled={commentSubmitting}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                submitComment(event);
              }
            }}
          />

          <div className="quiz-comment-tools">
            <button
              type="button"
              className="quiz-emoji-trigger"
              onClick={() =>
                setEmojiPickerOpen(
                  (current) => !current,
                )
              }
              aria-expanded={emojiPickerOpen}
              aria-controls="quiz-emoji-picker"
            >
              ☺
            </button>

            <span>
              Add emoji
            </span>
          </div>

          {emojiPickerOpen && (
            <div
              className="quiz-emoji-picker"
              id="quiz-emoji-picker"
            >
              {emojiGroups.map(
                (group) => (
                  <section key={group.label}>
                    <p>
                      {group.label}
                    </p>
                    <div className="quiz-emoji-grid">
                      {group.emojis.map(
                        (emoji) => (
                          <button
                            type="button"
                            key={`${group.label}-${emoji}`}
                            onClick={() =>
                              addEmoji(emoji)
                            }
                            aria-label={`Add ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ),
                      )}
                    </div>
                  </section>
                ),
              )}
            </div>
          )}

          <label className="quiz-anonymous-toggle">
            <input
              type="checkbox"
              checked={anonymousComment}
              onChange={(event) =>
                setAnonymousComment(
                  event.target.checked,
                )
              }
            />
            <span>
              Post anonymously
            </span>
          </label>

          <div className="quiz-comment-actions">
            <span>
              {commentBody.trim().length}
              /500
            </span>
            <button
              type="submit"
              disabled={
                commentSubmitting ||
                !commentBody.trim()
              }
            >
              {commentSubmitting
                ? "Posting..."
                : "Post"}
            </button>
          </div>
        </form>
      )}

      {commentMessage && (
        <p
          className="quiz-comment-message"
          role="alert"
        >
          {commentMessage}
        </p>
      )}
    </aside>
  );


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
      <div className="quiz-live-layout">
        {commentPanel}

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
      </div>
    </section>
  );
}
