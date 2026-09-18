import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChartNoAxesCombined, CheckCircle2, Clock3, Crosshair, Target } from "lucide-react";
import { getToken } from "../utils/auth";

export default function OptimalPointQuiz({ quiz, onComplete }) {
  const [game, setGame] = useState(quiz.optimal_point);
  const [armed, setArmed] = useState(game.started);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const chartRef = useRef(null);

  useEffect(() => {
    if (!game.started || game.finished) return undefined;
    const timer = window.setInterval(() => setGame((current) => ({ ...current, remaining_seconds: Math.max(0, current.remaining_seconds - 1) })), 1000);
    return () => window.clearInterval(timer);
  }, [game.started, game.finished]);

  useEffect(() => {
    if (game.started && !game.finished && game.remaining_seconds === 0) onComplete();
  }, [game.started, game.finished, game.remaining_seconds, onComplete]);

  const polyline = useMemo(() => (game.round?.points || []).map((point) => `${point.x},${100 - point.y}`).join(" "), [game.round]);
  const secondaryPolyline = useMemo(() => (game.round?.secondary_points || []).map((point) => `${point.x},${100 - point.y}`).join(" "), [game.round]);

  const choosePoint = async (event) => {
    if (busy || game.finished) return;
    const box = chartRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100));
    const y = Math.max(0, Math.min(100, 100 - ((event.clientY - box.top) / box.height) * 100));
    setBusy(true); setMessage("");
    try {
      if (!game.started) {
        const startResponse = await fetch(`/api/quiz/${quiz.id}/optimal-point/start`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } });
        const startData = await startResponse.json();
        if (!startResponse.ok) throw new Error(startData.detail || "Unable to start the challenge.");
      }
      const response = await fetch("/api/quiz/optimal-point/answer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ quiz_id: quiz.id, x, y }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to lock this point.");
      const earned = data.round_result?.points;
      setMessage(Number.isInteger(earned) ? `${earned} points secured. Next signal loaded.` : "Point locked.");
      setGame(data);
      if (data.finished) await onComplete();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const minutes = String(Math.floor(game.remaining_seconds / 60)).padStart(2, "0");
  const seconds = String(game.remaining_seconds % 60).padStart(2, "0");

  if (!armed && !game.started) return (
    <section className="optimal-point optimal-point-intro">
      <span className="optimal-point-icon"><Target /></span>
      <p className="optimal-point-kicker">SIGNAL LAB</p>
      <h2>{quiz.question}</h2>
      <p>Read the curve, locate the strongest operating point, and click once to lock your answer.</p>
      <div className="optimal-point-meta"><span>{game.total_rounds} rounds</span><i /><span>{game.remaining_seconds}s</span><i /><span>{game.max_score} pts</span></div>
      <button type="button" onClick={() => setArmed(true)}>Enter Signal Lab</button>
    </section>
  );

  if (game.finished) return (
    <section className="optimal-point optimal-point-finished">
      <CheckCircle2 />
      <p className="optimal-point-kicker">ANALYSIS COMPLETE</p>
      <h2>{game.score} points</h2>
      <p>{game.completion_reason === "timeout" ? "Time expired. Every locked point was still recorded." : game.speed_bonus ? "Perfect calibration. Speed bonus included." : "Your chart decisions have been recorded."}</p>
      <div className="optimal-point-results">{(game.results || []).map((result) => <article key={result.round}><span>ROUND {result.round}</span><strong>{result.points} / 3</strong><p>{result.explanation}</p></article>)}</div>
    </section>
  );

  const round = game.round;
  return (
    <section className="optimal-point">
      <header className="optimal-point-head">
        <div><p className="optimal-point-kicker">SIGNAL LAB / ROUND {game.round_number} OF {game.total_rounds}</p><h2>{round.title}</h2><p>{round.prompt}</p></div>
        <span><Clock3 /> {minutes}:{seconds}</span>
      </header>
      <div className="optimal-point-progress"><i style={{ width: `${((game.round_number - 1) / game.total_rounds) * 100}%` }} /></div>
      <div className="optimal-point-chart-shell">
        <div className="optimal-point-chart-label"><ChartNoAxesCombined /> LIVE MODEL SIGNAL <span>{round.chart_type.replaceAll("_", " ")}</span></div>
        <div className="optimal-point-y-label">{round.y_label}</div>
        <svg ref={chartRef} className={`optimal-point-chart ${busy ? "is-busy" : ""}`} viewBox="0 0 100 100" preserveAspectRatio="none" role="button" aria-label={`${round.prompt}. Click the optimal point.`} onClick={choosePoint}>
          {[20,40,60,80].map((value) => <g key={value}><line x1="0" x2="100" y1={value} y2={value} /><line y1="0" y2="100" x1={value} x2={value} /></g>)}
          <polyline points={polyline} />
          {secondaryPolyline && <polyline className="secondary" points={secondaryPolyline} />}
        </svg>
        <div className="optimal-point-x-label">{round.x_label}</div>
        <div className="optimal-point-hint"><Crosshair /> Click directly on the curve where performance is optimal. Your first click starts the timer.</div>
      </div>
      <footer className="optimal-point-footer"><span>{message || `${game.score} points secured`}</span><strong>{busy ? "CALIBRATING…" : "ONE CLICK LOCKS THIS ROUND"}</strong></footer>
    </section>
  );
}
