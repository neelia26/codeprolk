import React, { useEffect, useState } from "react";
import { Bug, CheckCircle2, Clock3, Crosshair, ShieldCheck, Wrench } from "lucide-react";
import { getToken } from "../utils/auth";

export default function BugHuntQuiz({ quiz, onComplete }) {
  const [game, setGame] = useState(quiz.bug_hunt);
  const [lineIndex, setLineIndex] = useState(null);
  const [diagnosisIndex, setDiagnosisIndex] = useState(null);
  const [fixIndex, setFixIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!game.started || game.finished) return undefined;
    const timer = window.setInterval(() => {
      setGame((current) => ({ ...current, remaining_seconds: Math.max(0, current.remaining_seconds - 1) }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [game.started, game.finished]);

  useEffect(() => {
    if (game.started && !game.finished && game.remaining_seconds === 0) onComplete();
  }, [game.started, game.finished, game.remaining_seconds, onComplete]);

  const start = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/quiz/${quiz.id}/bug-hunt/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to start Bug Hunt.");
      setGame(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitRound = async () => {
    if (lineIndex === null || diagnosisIndex === null || fixIndex === null || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/quiz/bug-hunt/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ quiz_id: quiz.id, line_index: lineIndex, diagnosis_index: diagnosisIndex, fix_index: fixIndex }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to submit this round.");
      const earned = data.round_result?.points;
      setMessage(Number.isInteger(earned) ? `Round locked: ${earned} of 3 points earned.` : "Round submitted.");
      setGame(data);
      setLineIndex(null);
      setDiagnosisIndex(null);
      setFixIndex(null);
      if (data.finished) await onComplete();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const minutes = String(Math.floor(game.remaining_seconds / 60)).padStart(2, "0");
  const seconds = String(game.remaining_seconds % 60).padStart(2, "0");
  const readyToSubmit = lineIndex !== null && diagnosisIndex !== null && fixIndex !== null;

  if (!game.started) {
    const roundLabel = `${game.total_rounds} round${game.total_rounds === 1 ? "" : "s"}`;
    const maxScore = game.max_score || game.total_rounds * 3 + 1;
    return (
      <section className="bug-hunt bug-hunt-intro">
        <div className="bug-hunt-intro-topline">
          <div className="bug-hunt-mark"><Bug /></div>
          <p className="bug-hunt-kicker">BUG HUNT</p>
        </div>
        <h2>{quiz.question}</h2>
        <p className="bug-hunt-brief">Spot it. Name it. Fix it.</p>
        <div className="bug-hunt-meta" aria-label={`${roundLabel}, ${game.remaining_seconds} seconds, ${maxScore} available points`}>
          <span>{roundLabel}</span><i /><span>{game.remaining_seconds}s</span><i /><span>{maxScore} pts</span>
        </div>
        <button type="button" className="bug-hunt-start" onClick={start} disabled={busy}>{busy ? "Preparing…" : "Start Hunt"}</button>
        {message && <p role="alert" className="bug-hunt-message">{message}</p>}
      </section>
    );
  }

  if (game.finished) {
    return (
      <section className="bug-hunt bug-hunt-finished">
        <CheckCircle2 className="bug-hunt-complete-icon" />
        <p className="bug-hunt-kicker">HUNT COMPLETE</p>
        <h2>{game.score} points</h2>
        <p>{game.completion_reason === "timeout" ? "Time expired, but every point you earned was saved." : game.speed_bonus ? "Perfect hunt. Your speed bonus is included." : "Your final result has been recorded."}</p>
        <div className="bug-hunt-results">
          {(game.results || []).map((result) => (
            <article key={result.round}>
              <strong>Round {result.round}</strong><span>{result.points} / 3</span>
              {result.explanation && <p>{result.explanation}</p>}
            </article>
          ))}
        </div>
      </section>
    );
  }

  const round = game.round;
  return (
    <section className="bug-hunt">
      <header className="bug-hunt-head">
        <div><p className="bug-hunt-kicker">BUG HUNT / ROUND {game.round_number} OF {game.total_rounds}</p><h2>{round.title}</h2></div>
        <span className="bug-hunt-timer"><Clock3 /> {minutes}:{seconds}</span>
      </header>

      <div className="bug-hunt-progress" aria-label={`Round ${game.round_number} of ${game.total_rounds}`}>
        <i style={{ width: `${((game.round_number - 1) / game.total_rounds) * 100}%` }} />
      </div>

      <div className="bug-hunt-workspace">
        <section className="bug-hunt-code-panel">
          <h3><Crosshair /> 1. Select the faulty line</h3>
          <ol className="bug-hunt-code">
            {round.code_lines.map((line, index) => (
              <li key={`${index}-${line}`} className={lineIndex === index ? "selected" : ""}>
                <button type="button" onClick={() => setLineIndex(index)}><code>{line}</code></button>
              </li>
            ))}
          </ol>
        </section>

        <div className="bug-hunt-decisions">
          <fieldset>
            <legend><ShieldCheck /> 2. Diagnose the bug</legend>
            {round.diagnoses.map((option, index) => (
              <label key={option} className={diagnosisIndex === index ? "selected" : ""}>
                <input type="radio" name={`diagnosis-${game.round_number}`} checked={diagnosisIndex === index} onChange={() => setDiagnosisIndex(index)} />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend><Wrench /> 3. Choose the repair</legend>
            {round.fixes.map((option, index) => (
              <label key={option} className={fixIndex === index ? "selected" : ""}>
                <input type="radio" name={`fix-${game.round_number}`} checked={fixIndex === index} onChange={() => setFixIndex(index)} />
                <span><code>{option}</code></span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>

      <footer className="bug-hunt-actions">
        <span>{message || `${game.score} points secured`}</span>
        <button type="button" onClick={submitRound} disabled={!readyToSubmit || busy}>{busy ? "Locking…" : "Lock Round"}</button>
      </footer>
    </section>
  );
}
