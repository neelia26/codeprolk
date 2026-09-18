import React, { useEffect, useState } from "react";
import { CircleHelp, Clock3, Play, Search, ShieldCheck } from "lucide-react";
import { getToken, getTokenPayload } from "../utils/auth";

function pathBetween(start, end) {
  const dr = Math.sign(end[0] - start[0]);
  const dc = Math.sign(end[1] - start[1]);
  const rows = Math.abs(end[0] - start[0]);
  const cols = Math.abs(end[1] - start[1]);
  if (!(rows === 0 || cols === 0 || rows === cols)) return [];
  const length = Math.max(rows, cols) + 1;
  return Array.from({ length }, (_, index) => [start[0] + dr * index, start[1] + dc * index]);
}

export default function WordSearchQuiz({ quiz, onComplete }) {
  const participant = getTokenPayload(getToken())?.sub || "CodePRO LK member";
  const [game, setGame] = useState(quiz.word_search);
  const [start, setStart] = useState(null);
  const [hover, setHover] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const path = start && hover ? pathBetween(start, hover) : [];
  const selected = new Set(path.map(([row, col]) => `${row}-${col}`));
  const found = new Set((game.found_paths || []).flat().map(([row, col]) => `${row}-${col}`));

  useEffect(() => {
    if (!game.started || game.finished) return undefined;
    const timer = window.setInterval(() => setGame((current) => ({ ...current, remaining_seconds: Math.max(0, current.remaining_seconds - 1) })), 1000);
    return () => window.clearInterval(timer);
  }, [game.started, game.finished]);

  useEffect(() => {
    if (game.started && game.remaining_seconds === 0 && !game.finished) onComplete();
  }, [game.started, game.remaining_seconds, game.finished, onComplete]);

  const beginChallenge = async () => {
    if (game.started || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/quiz/${quiz.id}/word-search/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to start the challenge.");
      setGame(data);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };

  const submitPath = async (end) => {
    const cells = pathBetween(start, end);
    setStart(null); setHover(null);
    if (cells.length < 3 || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/quiz/word-search/select", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ quiz_id: quiz.id, cells }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to check that word.");
      setGame(data);
      setMessage(data.correct_selection ? "Word discovered." : "That is not the current hidden word.");
      if (data.finished) await onComplete();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };

  const cellAtPointer = (event) => {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-word-cell]");
    if (!element) return null;
    return [Number(element.dataset.row), Number(element.dataset.col)];
  };

  const moveSelection = (event) => {
    if (!start) return;
    const cell = cellAtPointer(event);
    if (cell) setHover(cell);
  };

  const finishSelection = (event) => {
    if (!start) return;
    const cell = cellAtPointer(event) || hover;
    if (cell) submitPath(cell);
    else { setStart(null); setHover(null); }
  };

  const minutes = String(Math.floor(game.remaining_seconds / 60)).padStart(2, "0");
  const seconds = String(game.remaining_seconds % 60).padStart(2, "0");
  const resultMessage = game.completion_reason === "timeout"
    ? `Time is up. You found ${game.found_count} of ${game.total_words} words.`
    : game.completion_reason === "completed"
      ? `All words found${game.time_bonus ? ` with a ${game.time_bonus}-point speed bonus.` : "."}`
      : "";

  if (!game.started) return (
    <section className="word-search-quiz word-search-intro">
      <span className="word-search-intro-icon"><Search /></span>
      <p className="word-search-intro-kicker">WORD CHALLENGE</p>
      <h2>{quiz.question}</h2>
      <p>The puzzle and first clue stay sealed until you begin. Once opened, the countdown runs continuously.</p>
      <div className="word-search-intro-meta"><span>{game.total_words} hidden words</span><i /><span>{game.remaining_seconds}s</span><i /><span>{game.max_score} pts</span></div>
      <details className="word-search-guide"><summary><CircleHelp /> How to play</summary><ul><li>Drag horizontally, vertically, or diagonally.</li><li>Words may run forwards or backwards.</li><li>The grid changes after every discovery.</li><li>The timer starts when you press the button below.</li></ul></details>
      <button type="button" className="word-search-start" onClick={beginChallenge} disabled={busy}><Play /> {busy ? "Preparing…" : "Start Word Challenge"}</button>
      {message && <p role="alert">{message}</p>}
    </section>
  );

  return (
    <section className="word-search-quiz" onContextMenu={(event) => event.preventDefault()}>
      <header className="word-search-head">
        <div><p>Special challenge</p><h2>{quiz.question}</h2></div>
        <span className={`word-search-timer ${game.started ? "is-running" : "is-ready"}`}><Clock3 />{game.started ? `${minutes}:${seconds}` : "READY"}</span>
      </header>
      <div className="word-search-status">
        <div><Search /><span>Current clue</span><strong>{game.finished ? resultMessage : game.clue}</strong></div>
        <div><ShieldCheck /><span>Discovered</span><strong>{game.found_count} / {game.total_words}</strong></div>
      </div>
      <details className="word-search-guide">
        <summary><CircleHelp /> How to play</summary>
        <ul>
          <li>Drag across a word in a straight horizontal, vertical, or diagonal line.</li>
          <li>Words may run forwards or backwards. Follow the current clue.</li>
          <li>The timer starts when you press Start Word Challenge.</li>
          <li>After a discovery, the grid changes while every found word stays highlighted.</li>
          <li>Each word earns 1 point. Find them all to earn 1 bonus point per full 30 seconds remaining, capped at the number of words.</li>
        </ul>
      </details>
      <div
        className={`word-search-grid ${start ? "is-selecting" : ""}`}
        key={`word-grid-${game.found_count}`}
        style={{ "--grid-size": game.grid.length }}
        onPointerMove={moveSelection}
        onPointerUp={finishSelection}
        onPointerCancel={() => { setStart(null); setHover(null); }}
      >
        <span className="word-search-watermark" aria-hidden="true">{participant}</span>
        {game.grid.map((row, rowIndex) => row.map((letter, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          return <button
            type="button"
            key={key}
            data-word-cell
            data-row={rowIndex}
            data-col={colIndex}
            className={`${selected.has(key) ? "selected" : ""} ${found.has(key) ? "found" : ""}`}
            disabled={game.finished || busy}
            onPointerDown={(event) => {
              event.preventDefault();
              setStart([rowIndex, colIndex]);
              setHover([rowIndex, colIndex]);
            }}
          >{letter}</button>;
        }))}
      </div>
      <footer className="word-search-foot">
        <span>{resultMessage || message || "Drag across the letters that match the clue."}</span>
        <strong>{game.score} / {game.max_score} points</strong>
      </footer>
    </section>
  );
}
