from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo
from email.message import EmailMessage
import hashlib
import os
import secrets
import smtplib
import random
import string
import math

import models
from blog import make_blog_router
import schemas
import auth
from database import engine, get_db, migrate_users_table, Base
from seed import create_default_admin


models.Base.metadata.create_all(bind=engine)
migrate_users_table()

app = FastAPI()

origins = [
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
    "www.codeprolk.com",
    "https://codeprolk.com",
    "https://www.codeprolk.com",
    "http://codeprolk.com",
    "http://www.codeprolk.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

SRI_LANKA_TZ = ZoneInfo("Asia/Colombo")
PASSWORD_RESET_TOKEN_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_MINUTES", "30"))


def sri_lanka_now():
    return datetime.now(SRI_LANKA_TZ)


def sri_lanka_today():
    return sri_lanka_now().date()


def quiz_expiry_for_date(quiz_date: date):
    """
    Database currently stores naive timestamps.
    Store the Sri Lankan end-of-day wall-clock time as a naive datetime.
    """
    return datetime.combine(
        quiz_date,
        time(hour=23, minute=59, second=59),
    )


def local_naive_now():
    """
    Return current Sri Lankan wall-clock time without tzinfo so it can
    safely be compared with the existing PostgreSQL timestamp columns.
    """
    return sri_lanka_now().replace(tzinfo=None)


def word_search_layout(quiz, user_id, stage=0):
    items = (quiz.word_search_config or {}).get("items", [])
    words = ["".join(ch for ch in item["word"].upper() if ch.isalpha()) for item in items]
    longest_word = max((len(word) for word in words), default=8)
    letter_density_size = math.ceil(math.sqrt(sum(len(word) for word in words) * 3))
    size = max(10, min(20, max(longest_word, letter_density_size)))
    seed = hashlib.sha256(f"{quiz.id}:{user_id}:{stage}:{os.getenv('SECRET_KEY', 'codeprolk')}".encode()).digest()
    rng = random.Random(seed)
    grid = [[rng.choice(string.ascii_uppercase) for _ in range(size)] for _ in range(size)]
    placements = []
    directions = [(0,1),(1,0),(1,1),(1,-1),(0,-1),(-1,0),(-1,-1),(-1,1)]
    for item in items:
        word = "".join(ch for ch in item["word"].upper() if ch.isalpha())
        placed = None
        for _ in range(500):
            dr, dc = rng.choice(directions)
            row, col = rng.randrange(size), rng.randrange(size)
            end_row, end_col = row + dr*(len(word)-1), col + dc*(len(word)-1)
            if not (0 <= end_row < size and 0 <= end_col < size):
                continue
            cells = [(row + dr*i, col + dc*i) for i in range(len(word))]
            if all(grid[r][c] == word[i] or not any((r,c) in p["cells"] for p in placements) for i,(r,c) in enumerate(cells)):
                placed = cells
                for i,(r,c) in enumerate(cells): grid[r][c] = word[i]
                break
        if not placed:
            raise HTTPException(status_code=500, detail="Unable to generate word search.")
        placements.append({"word": word, "clue": item.get("clue", "Find the hidden term."), "cells": placed})
    return grid, placements


def word_search_payload(quiz, user, db):
    progress = db.query(models.WordSearchProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        _, placements = word_search_layout(quiz, user.id, 0)
        return {
            "grid": [],
            "found_count": 0,
            "total_words": len(placements),
            "found_words": [],
            "found_paths": [],
            "clue": None,
            "remaining_seconds": quiz.duration_seconds,
            "started": False,
            "finished": False,
            "score": 0,
            "max_score": len(placements) * 2,
            "time_bonus": 0,
            "completion_reason": None,
        }
    found = list(progress.found_words or [])
    grid, placements = word_search_layout(quiz, user.id, len(found))
    elapsed = int((datetime.utcnow() - progress.started_at).total_seconds())
    remaining = max(0, quiz.duration_seconds - elapsed)
    completed_all = len(found) == len(placements)
    timed_out = remaining == 0 and not completed_all
    finished = bool(progress.completed_at) or timed_out or completed_all
    submission = db.query(models.Submission).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if finished and not submission:
        if not progress.completed_at:
            progress.completed_at = datetime.utcnow()
        time_bonus = min(len(placements), remaining // 30) if completed_all else 0
        submission = models.Submission(
            user_id=user.id,
            quiz_id=quiz.id,
            selected_index=-1,
            is_correct=completed_all,
            score=len(found) + time_bonus,
            max_score=len(placements) * 2,
        )
        db.add(submission)
        db.commit()
    time_bonus = max(0, (submission.score - len(found))) if submission else 0
    current = next((p for p in placements if p["word"] not in found), None)
    return {
        "grid": grid,
        "found_count": len(found),
        "total_words": len(placements),
        "found_words": found if finished else [],
        "found_paths": [placement["cells"] for placement in placements if placement["word"] in found],
        "clue": current["clue"] if current and not finished else None,
        "remaining_seconds": remaining,
        "started": True,
        "finished": finished,
        "score": submission.score if submission else len(found),
        "max_score": len(placements) * 2,
        "time_bonus": time_bonus,
        "completion_reason": "completed" if completed_all else "timeout" if timed_out else None,
    }


def bug_hunt_round_data(quiz, user_id, round_index):
    rounds = (quiz.bug_hunt_config or {}).get("rounds", [])
    if round_index < 0 or round_index >= len(rounds):
        return None
    source = rounds[round_index]
    seed = hashlib.sha256(
        f"bug-hunt:{quiz.id}:{user_id}:{round_index}:{os.getenv('SECRET_KEY', 'codeprolk')}".encode()
    ).digest()
    rng = random.Random(seed)
    diagnosis_order = list(range(len(source["diagnoses"])))
    fix_order = list(range(len(source["fixes"])))
    rng.shuffle(diagnosis_order)
    rng.shuffle(fix_order)
    return {
        "title": source.get("title", f"Round {round_index + 1}"),
        "code_lines": source["code_lines"],
        "diagnoses": [source["diagnoses"][index] for index in diagnosis_order],
        "fixes": [source["fixes"][index] for index in fix_order],
        "correct_line": int(source["buggy_line"]),
        "correct_diagnosis": diagnosis_order.index(int(source["correct_diagnosis"])),
        "correct_fix": fix_order.index(int(source["correct_fix"])),
        "explanation": source.get("explanation", ""),
    }


def bug_hunt_payload(quiz, user, db):
    rounds = (quiz.bug_hunt_config or {}).get("rounds", [])
    progress = db.query(models.BugHuntProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        return {
            "started": False,
            "finished": False,
            "round_number": 0,
            "total_rounds": len(rounds),
            "remaining_seconds": quiz.duration_seconds,
            "score": 0,
            "max_score": len(rounds) * 3 + 1,
            "round": None,
            "results": [],
            "completion_reason": None,
        }

    elapsed = int((datetime.utcnow() - progress.started_at).total_seconds())
    remaining = max(0, quiz.duration_seconds - elapsed)
    answers = list(progress.answers or [])
    completed_all = progress.current_round >= len(rounds)
    timed_out = remaining == 0 and not completed_all
    finished = completed_all or timed_out or bool(progress.completed_at)
    base_score = sum(int(answer.get("points", 0)) for answer in answers)
    perfect = completed_all and base_score == len(rounds) * 3
    speed_bonus = 1 if perfect and remaining > 0 else 0
    submission = db.query(models.Submission).filter_by(user_id=user.id, quiz_id=quiz.id).first()

    if finished and not submission:
        if not progress.completed_at:
            progress.completed_at = datetime.utcnow()
        submission = models.Submission(
            user_id=user.id,
            quiz_id=quiz.id,
            selected_index=-1,
            is_correct=perfect,
            score=base_score + speed_bonus,
            max_score=len(rounds) * 3 + 1,
        )
        db.add(submission)
        db.commit()

    current = None if finished else bug_hunt_round_data(quiz, user.id, progress.current_round)
    if current:
        current = {key: value for key, value in current.items() if not key.startswith("correct_") and key != "explanation"}

    return {
        "started": True,
        "finished": finished,
        "round_number": min(progress.current_round + 1, len(rounds)),
        "total_rounds": len(rounds),
        "remaining_seconds": remaining,
        "score": submission.score if submission else base_score,
        "max_score": len(rounds) * 3 + 1,
        "round": current,
        "results": answers if finished else [],
        "speed_bonus": speed_bonus if finished else 0,
        "completion_reason": "completed" if completed_all else "timeout" if timed_out else None,
    }


def validate_bug_hunt_rounds(raw_rounds):
    rounds = raw_rounds or []
    if not 1 <= len(rounds) <= 5:
        raise HTTPException(status_code=400, detail="Bug Hunt requires between one and five rounds.")
    cleaned = []
    for number, item in enumerate(rounds, start=1):
        lines = [str(line).rstrip() for line in item.get("code_lines", []) if str(line).strip()]
        diagnoses = [str(option).strip() for option in item.get("diagnoses", [])]
        fixes = [str(option).strip() for option in item.get("fixes", [])]
        buggy_line = int(item.get("buggy_line", -1))
        correct_diagnosis = int(item.get("correct_diagnosis", -1))
        correct_fix = int(item.get("correct_fix", -1))
        if not 3 <= len(lines) <= 12 or not 3 <= len(diagnoses) <= 5 or not 3 <= len(fixes) <= 5:
            raise HTTPException(status_code=400, detail=f"Bug Hunt round {number} requires 3–12 code lines and 3–5 diagnosis and repair choices.")
        if not all(diagnoses) or not all(fixes) or not 0 <= buggy_line < len(lines) or not 0 <= correct_diagnosis < len(diagnoses) or not 0 <= correct_fix < len(fixes):
            raise HTTPException(status_code=400, detail=f"Bug Hunt round {number} has incomplete or invalid answers.")
        cleaned.append({
            "title": str(item.get("title", f"Round {number}")).strip() or f"Round {number}",
            "code_lines": lines,
            "buggy_line": buggy_line,
            "diagnoses": diagnoses,
            "correct_diagnosis": correct_diagnosis,
            "fixes": fixes,
            "correct_fix": correct_fix,
            "explanation": str(item.get("explanation", "")).strip(),
        })
    return cleaned


OPTIMAL_POINT_TYPES = {
    "learning_curve", "roc_threshold", "precision_recall", "bias_variance",
    "elbow_curve", "convergence", "saturation", "regularization",
    "linear_intersection", "quadratic_vertex", "piecewise_transition", "break_even",
}


def validate_optimal_point_rounds(raw_rounds):
    rounds = raw_rounds or []
    if not 1 <= len(rounds) <= 5:
        raise HTTPException(status_code=400, detail="Optimal Point requires between one and five rounds.")
    cleaned = []
    for number, item in enumerate(rounds, start=1):
        chart_type = str(item.get("chart_type", "learning_curve"))
        target_x = float(item.get("target_x", 65))
        tolerance = float(item.get("tolerance", 8))
        curve_strength = float(item.get("curve_strength", 1))
        noise = float(item.get("noise", 1.2))
        if chart_type not in OPTIMAL_POINT_TYPES or not 15 <= target_x <= 85 or not 3 <= tolerance <= 15 or not .5 <= curve_strength <= 2 or not 0 <= noise <= 5:
            raise HTTPException(status_code=400, detail=f"Optimal Point round {number} has invalid chart settings.")
        cleaned.append({
            "title": str(item.get("title", f"Round {number}")).strip() or f"Round {number}",
            "prompt": str(item.get("prompt", "Select the optimal point.")).strip() or "Select the optimal point.",
            "chart_type": chart_type,
            "target_x": target_x,
            "tolerance": tolerance,
            "curve_strength": curve_strength,
            "noise": noise,
            "explanation": str(item.get("explanation", "")).strip(),
        })
    return cleaned


def optimal_point_round_data(quiz, user_id, round_index):
    rounds = (quiz.optimal_point_config or {}).get("rounds", [])
    if round_index < 0 or round_index >= len(rounds):
        return None
    source = rounds[round_index]
    seed = hashlib.sha256(f"optimal:{quiz.id}:{user_id}:{round_index}:{os.getenv('SECRET_KEY', 'codeprolk')}".encode()).digest()
    rng = random.Random(seed)
    target_x = max(15, min(85, float(source.get("target_x", 65)) + rng.uniform(-3.5, 3.5)))
    chart_type = source.get("chart_type", "learning_curve")
    strength = float(source.get("curve_strength", 1))
    noise = float(source.get("noise", 1.2))
    points = []
    secondary_points = []
    for x in range(0, 101, 5):
        if chart_type == "elbow_curve":
            y = 18 + 72 * math.exp(-x / max(8, target_x / (2.8 * strength))) + max(0, x - target_x) * .055
        elif chart_type == "roc_threshold":
            y = 18 + 67 * math.exp(-((x - target_x) ** 2) / (620 / strength))
        elif chart_type == "linear_intersection":
            slope = .38 * strength
            y = 25 + slope * x
            secondary_y = 25 + slope * target_x * 2 - slope * x
            secondary_points.append({"x": x, "y": round(max(5, min(95, secondary_y)), 2)})
        elif chart_type == "break_even":
            slope = .5 * strength
            y = 12 + slope * x
            secondary_y = 12 + slope * target_x + .12 * (x - target_x)
            secondary_points.append({"x": x, "y": round(max(5, min(95, secondary_y)), 2)})
        elif chart_type == "precision_recall":
            slope = .52 * strength
            y = 24 + slope * x
            secondary_y = 24 + slope * target_x * 2 - slope * x
            secondary_points.append({"x": x, "y": round(max(5, min(95, secondary_y)), 2)})
        elif chart_type == "bias_variance":
            y = 20 + ((x - target_x) ** 2) / (95 / strength)
        elif chart_type in {"regularization", "quadratic_vertex"}:
            direction = -1 if chart_type == "regularization" else 1
            y = (82 if direction < 0 else 18) + direction * ((x - target_x) ** 2) / (92 / strength)
        elif chart_type == "convergence":
            y = 18 + 70 * math.exp(-x / max(8, target_x / (2.5 * strength)))
        elif chart_type == "saturation":
            y = 18 + 68 * (1 - math.exp(-x / max(8, target_x / (2.5 * strength))))
        elif chart_type == "piecewise_transition":
            y = 18 + .68 * min(x, target_x) + .13 * max(0, x - target_x)
        else:
            y = 25 + 58 * (1 - math.exp(-x / (24 / strength))) - max(0, x - target_x) * (.48 * strength)
        jitter = 0 if chart_type == "linear_intersection" else rng.uniform(-noise, noise)
        points.append({"x": x, "y": round(max(5, min(95, y + jitter)), 2)})
    target_y = min(points, key=lambda point: abs(point["x"] - target_x))["y"]
    labels = {
        "learning_curve": ("Training progress", "Validation score"),
        "roc_threshold": ("Decision threshold", "Model utility"),
        "precision_recall": ("Decision threshold", "Precision / recall"),
        "elbow_curve": ("Model complexity", "Error / inertia"),
        "convergence": ("Training step", "Loss"),
        "saturation": ("Resource investment", "Performance"),
        "regularization": ("Regularization strength", "Validation score"),
        "linear_intersection": ("Input value (x)", "y = mx + c"),
        "bias_variance": ("Model complexity", "Combined error"),
        "quadratic_vertex": ("Input value (x)", "Quadratic value"),
        "piecewise_transition": ("Input value (x)", "Piecewise output"),
        "break_even": ("Units / time", "Cost and return"),
    }[chart_type]
    return {
        "title": source["title"], "prompt": source["prompt"], "chart_type": chart_type,
        "points": points, "secondary_points": secondary_points, "x_label": labels[0], "y_label": labels[1],
        "target_x": target_x, "target_y": target_y, "tolerance": float(source.get("tolerance", 8)),
        "explanation": source.get("explanation", ""),
    }


def optimal_point_payload(quiz, user, db):
    rounds = (quiz.optimal_point_config or {}).get("rounds", [])
    progress = db.query(models.OptimalPointProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        current = optimal_point_round_data(quiz, user.id, 0)
        return {"started": False, "finished": False, "round_number": 1, "total_rounds": len(rounds), "remaining_seconds": quiz.duration_seconds, "score": 0, "max_score": len(rounds) * 3 + 1, "round": {k:v for k,v in current.items() if k not in {"target_x","target_y","tolerance","explanation"}}, "results": []}
    elapsed = int((datetime.utcnow() - progress.started_at).total_seconds())
    remaining = max(0, quiz.duration_seconds - elapsed)
    answers = list(progress.answers or [])
    complete = progress.current_round >= len(rounds)
    timed_out = remaining == 0 and not complete
    finished = complete or timed_out or bool(progress.completed_at)
    base_score = sum(int(answer.get("points", 0)) for answer in answers)
    perfect = complete and base_score == len(rounds) * 3
    speed_bonus = 1 if perfect and remaining > 0 else 0
    submission = db.query(models.Submission).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if finished and not submission:
        progress.completed_at = progress.completed_at or datetime.utcnow()
        submission = models.Submission(user_id=user.id, quiz_id=quiz.id, selected_index=-1, is_correct=perfect, score=base_score + speed_bonus, max_score=len(rounds) * 3 + 1)
        db.add(submission); db.commit()
    current = None if finished else optimal_point_round_data(quiz, user.id, progress.current_round)
    if current: current = {k:v for k,v in current.items() if k not in {"target_x","target_y","tolerance","explanation"}}
    return {"started": True, "finished": finished, "round_number": min(progress.current_round + 1, len(rounds)), "total_rounds": len(rounds), "remaining_seconds": remaining, "score": submission.score if submission else base_score, "max_score": len(rounds) * 3 + 1, "round": current, "results": answers if finished else [], "speed_bonus": speed_bonus if finished else 0, "completion_reason": "completed" if complete else "timeout" if timed_out else None}


def sri_lanka_timestamp(value: datetime):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(SRI_LANKA_TZ).isoformat()


def password_reset_token_hash(token: str):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def frontend_url():
    return os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def send_password_reset_email(email: str, reset_url: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_username or "no-reply@codeprolk.com")
    smtp_tls = os.getenv("SMTP_TLS", "true").lower() != "false"

    if not smtp_host:
        if os.getenv("APP_ENV", "development") == "production":
            print("Password reset email not sent: SMTP_HOST is not configured.")
        else:
            print(f"Password reset link for {email}: {reset_url}")
        return False

    if not smtp_username or not smtp_password:
        print("Password reset email not sent: SMTP_USERNAME or SMTP_PASSWORD is missing.")
        return False

    message = EmailMessage()
    message["Subject"] = "Reset your Codepro LK password"
    message["From"] = smtp_from
    message["To"] = email
    message.set_content(
        "We received a request to reset your Codepro LK password.\n\n"
        f"Use this link within {PASSWORD_RESET_TOKEN_MINUTES} minutes:\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email."
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        if smtp_tls:
            server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(message)

    print(f"Password reset email sent to {email} via {smtp_host}:{smtp_port}.")
    return True


@app.on_event("startup")
def startup_event():
    if os.getenv("SMTP_HOST"):
        print(f"SMTP configured for password reset: {os.getenv('SMTP_HOST')}:{os.getenv('SMTP_PORT', '587')}")
    else:
        print("SMTP not configured. Password reset emails will not be delivered.")
    create_default_admin()


def get_current_user(
    token: str = Depends(lambda: None),
    db: Session = Depends(get_db),
):
    # Dependency placeholder; token will be read from Authorization header.
    return None


@app.post("/api/auth/register")
def register(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(models.User).filter(
        (models.User.email == user.email)
        | (models.User.username == user.username)
    ).first()

    if existing:
        if existing.email == user.email:
            raise HTTPException(
                status_code=400,
                detail="Email already registered",
            )

        raise HTTPException(
            status_code=400,
            detail="Username already registered",
        )

    hashed = auth.get_password_hash(user.password)

    db_user = models.User(
        username=user.username,
        email=user.email,
        whatsapp_number=user.whatsapp_number,
        hashed_password=hashed,
        role="user",
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
    }


@app.post("/api/auth/login")
def login(
    data: dict,
    db: Session = Depends(get_db),
):
    email = data.get("email")
    password = data.get("password")

    user = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if (
        not user
        or not auth.verify_password(
            password,
            user.hashed_password,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    token = auth.create_access_token(
        {
            "sub": user.email,
            "user_id": user.id,
            "role": user.role,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
    }


@app.post("/api/auth/forgot-password")
def forgot_password(
    data: dict,
    db: Session = Depends(get_db),
):
    email = str(data.get("email", "")).strip().lower()

    if email:
        user = db.query(models.User).filter(
            func.lower(models.User.email) == email
        ).first()

        if user:
            token = secrets.token_urlsafe(32)
            user.password_reset_token_hash = password_reset_token_hash(token)
            user.password_reset_expires_at = (
                datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_TOKEN_MINUTES)
            )
            db.commit()

            reset_url = f"{frontend_url()}/reset-password?token={token}"
            try:
                send_password_reset_email(user.email, reset_url)
            except Exception as exc:
                print(f"Unable to send password reset email to {user.email}: {exc}")

    return {
        "ok": True,
        "message": "If an account exists for that email, a reset link has been sent.",
    }


@app.post("/api/auth/reset-password")
def reset_password(
    data: dict,
    db: Session = Depends(get_db),
):
    token = data.get("token")
    new_password = data.get("password")

    if not isinstance(token, str) or not token.strip():
        raise HTTPException(
            status_code=400,
            detail="Reset token is required.",
        )

    if not isinstance(new_password, str) or len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters.",
        )

    user = db.query(models.User).filter(
        models.User.password_reset_token_hash == password_reset_token_hash(token)
    ).first()

    if (
        not user
        or not user.password_reset_expires_at
        or user.password_reset_expires_at < datetime.utcnow()
    ):
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired.",
        )

    user.hashed_password = auth.get_password_hash(new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.commit()

    return {"ok": True}


def get_user_from_header(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    parts = authorization.split()

    if (
        len(parts) != 2
        or parts[0].lower() != "bearer"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth header",
        )

    token = parts[1]
    payload = auth.decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = db.query(models.User).filter(
        models.User.id == payload.get("user_id")
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user



# ============================================================
# USER PROFILE
# ============================================================

@app.get("/api/profile")
def get_profile(
    user: models.User = Depends(get_user_from_header),
):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "whatsapp_number": user.whatsapp_number,
        "role": user.role,
    }


@app.put("/api/profile")
def update_profile(
    data: dict,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    username = str(data.get("username", "")).strip()
    whatsapp_number = str(data.get("whatsapp_number", "")).strip()

    if len(username) < 3 or len(username) > 50:
        raise HTTPException(
            status_code=400,
            detail="Username must contain 3–50 characters.",
        )

    if len(whatsapp_number) < 7 or len(whatsapp_number) > 20:
        raise HTTPException(
            status_code=400,
            detail="WhatsApp number must contain 7–20 characters.",
        )

    duplicate = db.query(models.User).filter(
        models.User.username == username,
        models.User.id != user.id,
    ).first()

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="That username is already taken.",
        )

    user.username = username
    user.whatsapp_number = whatsapp_number
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "whatsapp_number": user.whatsapp_number,
        "role": user.role,
    }


@app.put("/api/profile/password")
def update_profile_password(
    data: dict,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not isinstance(current_password, str) or not auth.verify_password(
        current_password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect.",
        )

    if not isinstance(new_password, str) or len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must contain at least 8 characters.",
        )

    if auth.verify_password(new_password, user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Choose a password different from your current password.",
        )

    user.hashed_password = auth.get_password_hash(new_password)
    db.commit()

    return {"ok": True}

def get_admin_user(
    user: models.User = Depends(get_user_from_header),
):
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return user


# Preserve the existing Blog API.
app.include_router(
    make_blog_router(get_admin_user)
)


# ============================================================
# QUIZ
# ============================================================

@app.get("/api/quiz/today")
def get_today_quiz(
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    today = sri_lanka_today()
    now = local_naive_now()

    # A quiz is selected by DATE, not by a globally active quiz.
    # Therefore future quizzes can safely remain scheduled.
    quiz = (
        db.query(models.Quiz)
        .filter(
            models.Quiz.date == today,
            models.Quiz.is_active == True,
        )
        .order_by(models.Quiz.id.desc())
        .first()
    )

    if not quiz:
        return {
            "quiz": None,
            "submitted": False,
            "expired": False,
        }

    quiz_data = {
        "id": quiz.id,
        "question": quiz.question,
        "options": quiz.options,
        "date": str(quiz.date),
        "expiry": quiz.expiry.isoformat(),
        "quiz_type": quiz.quiz_type,
    }

    if quiz.quiz_type == "word_search":
        quiz_data["word_search"] = word_search_payload(quiz, user, db)
    elif quiz.quiz_type == "bug_hunt":
        quiz_data["bug_hunt"] = bug_hunt_payload(quiz, user, db)
    elif quiz.quiz_type == "optimal_point":
        quiz_data["optimal_point"] = optimal_point_payload(quiz, user, db)

    submission = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == user.id,
            models.Submission.quiz_id == quiz.id,
        )
        .first()
    )

    # If the user already answered today's quiz, return the quiz
    # and their recorded attempt for review.
    if submission:
        return {
            "quiz": quiz_data,
            "submitted": True,
            "expired": quiz.expiry < now,
            "submission": {
                "selected_index": submission.selected_index,
                "is_correct": submission.is_correct,
                "correct_index": quiz.correct_index,
                "explanation": quiz.explanation or "",
            },
        }

    if quiz.expiry < now:
        return {
            "quiz": None,
            "submitted": False,
            "expired": True,
        }

    return {
        "quiz": quiz_data,
        "submitted": False,
        "expired": False,
    }


@app.get("/api/quiz/streak")
def get_quiz_streak(
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    today = sri_lanka_today()
    participation_dates = {
        row[0]
        for row in (
            db.query(models.Quiz.date)
            .join(
                models.Submission,
                models.Submission.quiz_id == models.Quiz.id,
            )
            .filter(models.Submission.user_id == user.id)
            .all()
        )
        if row[0] is not None
    }

    longest_streak = 0
    running_streak = 0
    previous_date = None

    for participation_date in sorted(participation_dates):
        if (
            previous_date is not None
            and participation_date == previous_date + timedelta(days=1)
        ):
            running_streak += 1
        else:
            running_streak = 1

        longest_streak = max(longest_streak, running_streak)
        previous_date = participation_date

    # A streak remains alive until the end of the current day. This avoids
    # showing zero before a member has had a chance to take today's quiz.
    streak_anchor = (
        today
        if today in participation_dates
        else today - timedelta(days=1)
    )
    current_streak = 0

    while streak_anchor in participation_dates:
        current_streak += 1
        streak_anchor -= timedelta(days=1)

    milestones = (3, 7, 14, 30, 60, 100)
    next_milestone = next(
        (milestone for milestone in milestones if milestone > current_streak),
        current_streak + 25,
    )

    timeline = []
    for days_ago in range(6, -1, -1):
        timeline_date = today - timedelta(days=days_ago)
        timeline.append({
            "date": timeline_date.isoformat(),
            "label": timeline_date.strftime("%a"),
            "day": timeline_date.day,
            "participated": timeline_date in participation_dates,
            "is_today": timeline_date == today,
        })

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_participation_days": len(participation_dates),
        "participated_today": today in participation_dates,
        "next_milestone": next_milestone,
        "days_to_milestone": max(next_milestone - current_streak, 0),
        "timeline": timeline,
    }


@app.post("/api/quiz/submit")
def submit_answer(
    sub: schemas.SubmitAnswer,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter(
        models.Quiz.id == sub.quiz_id
    ).first()

    if not quiz:
        raise HTTPException(
            status_code=404,
            detail="Quiz not found",
        )

    today = sri_lanka_today()
    now = local_naive_now()

    # A scheduled quiz can only be answered on its own date.
    if quiz.date != today:
        raise HTTPException(
            status_code=400,
            detail="This quiz is not available today.",
        )

    if not quiz.is_active:
        raise HTTPException(
            status_code=400,
            detail="This quiz is not active.",
        )

    if quiz.expiry < now:
        raise HTTPException(
            status_code=400,
            detail="Quiz expired",
        )

    if sub.selected_index < 0 or sub.selected_index >= len(quiz.options):
        raise HTTPException(
            status_code=400,
            detail="Invalid answer option.",
        )

    existing = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == user.id,
            models.Submission.quiz_id == quiz.id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Already submitted",
        )

    is_correct = (
        sub.selected_index == quiz.correct_index
    )

    submission = models.Submission(
        user_id=user.id,
        quiz_id=quiz.id,
        selected_index=sub.selected_index,
        is_correct=is_correct,
        score=int(is_correct),
        max_score=1,
    )

    db.add(submission)
    db.commit()

    return {
        "ok": True,
        "is_correct": is_correct,
        "correct_index": quiz.correct_index,
        "explanation": quiz.explanation or "",
    }


@app.post("/api/quiz/word-search/select")
def select_word_search(
    selection: schemas.WordSearchSelection,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter_by(id=selection.quiz_id, quiz_type="word_search").first()
    if not quiz or quiz.date != sri_lanka_today() or quiz.expiry < local_naive_now():
        raise HTTPException(status_code=400, detail="This word search is not available.")
    progress = db.query(models.WordSearchProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        progress = models.WordSearchProgress(user_id=user.id, quiz_id=quiz.id, found_words=[])
        db.add(progress)
        db.commit()
        db.refresh(progress)
    if progress.completed_at or (datetime.utcnow() - progress.started_at).total_seconds() >= quiz.duration_seconds:
        return word_search_payload(quiz, user, db)
    found = list(progress.found_words or [])
    _, placements = word_search_layout(quiz, user.id, len(found))
    selected = [tuple(cell) for cell in selection.cells]
    match = next((p for p in placements if p["word"] not in found and (selected == p["cells"] or selected == list(reversed(p["cells"])))), None)
    if match:
        found.append(match["word"]); progress.found_words = found
        if len(found) == len(placements): progress.completed_at = datetime.utcnow()
        db.commit()
    payload = word_search_payload(quiz, user, db)
    payload["correct_selection"] = bool(match)
    return payload


@app.post("/api/quiz/{quiz_id}/word-search/start")
def start_word_search(
    quiz_id: int,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter_by(id=quiz_id, quiz_type="word_search").first()
    if not quiz or quiz.date != sri_lanka_today() or quiz.expiry < local_naive_now():
        raise HTTPException(status_code=400, detail="This word search is not available.")
    progress = db.query(models.WordSearchProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        progress = models.WordSearchProgress(user_id=user.id, quiz_id=quiz.id, found_words=[])
        db.add(progress)
        db.commit()
    return word_search_payload(quiz, user, db)


@app.post("/api/quiz/{quiz_id}/bug-hunt/start")
def start_bug_hunt(
    quiz_id: int,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter_by(id=quiz_id, quiz_type="bug_hunt").first()
    if not quiz or quiz.date != sri_lanka_today() or quiz.expiry < local_naive_now():
        raise HTTPException(status_code=400, detail="This Bug Hunt is not available.")
    progress = db.query(models.BugHuntProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        progress = models.BugHuntProgress(user_id=user.id, quiz_id=quiz.id, current_round=0, answers=[])
        db.add(progress)
        db.commit()
    return bug_hunt_payload(quiz, user, db)


@app.post("/api/quiz/bug-hunt/answer")
def answer_bug_hunt(
    answer: schemas.BugHuntAnswer,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter_by(id=answer.quiz_id, quiz_type="bug_hunt").first()
    if not quiz or quiz.date != sri_lanka_today() or quiz.expiry < local_naive_now():
        raise HTTPException(status_code=400, detail="This Bug Hunt is not available.")
    progress = db.query(models.BugHuntProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        raise HTTPException(status_code=400, detail="Start the Bug Hunt before submitting an answer.")
    if progress.completed_at or (datetime.utcnow() - progress.started_at).total_seconds() >= quiz.duration_seconds:
        return bug_hunt_payload(quiz, user, db)
    round_data = bug_hunt_round_data(quiz, user.id, progress.current_round)
    if not round_data:
        return bug_hunt_payload(quiz, user, db)

    line_correct = answer.line_index == round_data["correct_line"]
    diagnosis_correct = answer.diagnosis_index == round_data["correct_diagnosis"]
    fix_correct = answer.fix_index == round_data["correct_fix"]
    points = int(line_correct) + int(diagnosis_correct) + int(fix_correct)
    answers = list(progress.answers or [])
    answers.append({
        "round": progress.current_round + 1,
        "points": points,
        "line_correct": line_correct,
        "diagnosis_correct": diagnosis_correct,
        "fix_correct": fix_correct,
        "explanation": round_data["explanation"],
    })
    progress.answers = answers
    progress.current_round += 1
    if progress.current_round >= len((quiz.bug_hunt_config or {}).get("rounds", [])):
        progress.completed_at = datetime.utcnow()
    db.commit()
    payload = bug_hunt_payload(quiz, user, db)
    payload["round_result"] = answers[-1]
    return payload


@app.post("/api/quiz/{quiz_id}/optimal-point/start")
def start_optimal_point(quiz_id: int, user: models.User = Depends(get_user_from_header), db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter_by(id=quiz_id, quiz_type="optimal_point").first()
    if not quiz or quiz.date != sri_lanka_today() or quiz.expiry < local_naive_now():
        raise HTTPException(status_code=400, detail="This Optimal Point challenge is not available.")
    progress = db.query(models.OptimalPointProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        progress = models.OptimalPointProgress(user_id=user.id, quiz_id=quiz.id, current_round=0, answers=[])
        db.add(progress); db.commit()
    return optimal_point_payload(quiz, user, db)


@app.post("/api/quiz/optimal-point/answer")
def answer_optimal_point(answer: schemas.OptimalPointAnswer, user: models.User = Depends(get_user_from_header), db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter_by(id=answer.quiz_id, quiz_type="optimal_point").first()
    if not quiz or quiz.date != sri_lanka_today() or quiz.expiry < local_naive_now():
        raise HTTPException(status_code=400, detail="This Optimal Point challenge is not available.")
    progress = db.query(models.OptimalPointProgress).filter_by(user_id=user.id, quiz_id=quiz.id).first()
    if not progress:
        raise HTTPException(status_code=400, detail="Touch the chart to start this challenge.")
    if progress.completed_at or (datetime.utcnow() - progress.started_at).total_seconds() >= quiz.duration_seconds:
        return optimal_point_payload(quiz, user, db)
    round_data = optimal_point_round_data(quiz, user.id, progress.current_round)
    dx = answer.x - round_data["target_x"]
    dy = answer.y - round_data["target_y"]
    distance = math.sqrt(dx * dx + dy * dy)
    tolerance = round_data["tolerance"]
    points = 3 if distance <= tolerance else 2 if distance <= tolerance * 1.8 else 1 if distance <= tolerance * 3 else 0
    answers = list(progress.answers or [])
    answers.append({"round": progress.current_round + 1, "points": points, "distance": round(distance, 1), "selected_x": round(answer.x, 1), "selected_y": round(answer.y, 1), "target_x": round(round_data["target_x"], 1), "target_y": round(round_data["target_y"], 1), "explanation": round_data["explanation"]})
    progress.answers = answers; progress.current_round += 1
    if progress.current_round >= len((quiz.optimal_point_config or {}).get("rounds", [])): progress.completed_at = datetime.utcnow()
    db.commit()
    payload = optimal_point_payload(quiz, user, db); payload["round_result"] = answers[-1]
    return payload


def user_has_quiz_submission(
    db: Session,
    user_id: int,
    quiz_id: int,
):
    return db.query(models.Submission).filter(
        models.Submission.user_id == user_id,
        models.Submission.quiz_id == quiz_id,
    ).first() is not None


def quiz_comment_payload(comment, locked: bool = False):
    is_anonymous = bool(comment.is_anonymous)
    username = "Anonymous" if is_anonymous else (
        comment.user.username if comment.user else "Member"
    )

    return {
        "id": comment.id,
        "body": comment.body,
        "locked": locked,
        "is_anonymous": is_anonymous,
        "created_at": sri_lanka_timestamp(comment.created_at),
        "user": {
            "id": None if is_anonymous else comment.user_id,
            "username": username,
            "initials": username.strip()[:2].upper() or "U",
        },
    }


@app.get("/api/quiz/{quiz_id}/comments")
def get_quiz_comments(
    quiz_id: int,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter(
        models.Quiz.id == quiz_id
    ).first()

    if not quiz:
        raise HTTPException(
            status_code=404,
            detail="Quiz not found",
        )

    can_comment = (
        user.role == "admin"
        or user_has_quiz_submission(db, user.id, quiz_id)
    )

    comments = (
        db.query(models.QuizComment)
        .filter(models.QuizComment.quiz_id == quiz_id)
        .order_by(models.QuizComment.created_at.asc(), models.QuizComment.id.asc())
        .limit(80)
        .all()
    )

    return {
        "can_comment": can_comment,
        "comments": [
            quiz_comment_payload(comment, locked=not can_comment)
            for comment in comments
        ],
    }


@app.post("/api/quiz/{quiz_id}/comments")
def create_quiz_comment(
    quiz_id: int,
    data: dict,
    user: models.User = Depends(get_user_from_header),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter(
        models.Quiz.id == quiz_id
    ).first()

    if not quiz:
        raise HTTPException(
            status_code=404,
            detail="Quiz not found",
        )

    if user.role != "admin" and not user_has_quiz_submission(db, user.id, quiz_id):
        raise HTTPException(
            status_code=403,
            detail="Take the quiz first to unlock comments.",
        )

    body = str(data.get("body", "")).strip()

    if len(body) < 1:
        raise HTTPException(
            status_code=400,
            detail="Comment cannot be empty.",
        )

    if len(body) > 500:
        raise HTTPException(
            status_code=400,
            detail="Comment must be 500 characters or fewer.",
        )

    comment = models.QuizComment(
        quiz_id=quiz_id,
        user_id=user.id,
        body=body,
        is_anonymous=bool(data.get("is_anonymous", False)),
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {
        "comment": quiz_comment_payload(comment),
    }

# ============================================================
# ADMIN - QUIZZES
# ============================================================

@app.post("/api/admin/quiz")
def create_quiz(
    q: schemas.QuizCreate,
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    today = sri_lanka_today()

    if q.date < today:
        raise HTTPException(
            status_code=400,
            detail="You cannot schedule a quiz for a past date.",
        )

    if q.quiz_type == "multiple_choice" and (len(q.options) != 4 or any(not option.strip() for option in q.options)):
        raise HTTPException(status_code=400, detail="Multiple-choice quizzes require four options.")
    if q.quiz_type == "word_search":
        items = q.word_search_items or []
        words = ["".join(ch for ch in str(item.get("word", "")).upper() if ch.isalpha()) for item in items]
        if not 3 <= len(words) <= 10 or any(len(word) < 3 or len(word) > 15 for word in words) or len(set(words)) != len(words):
            raise HTTPException(status_code=400, detail="Word searches require 3–10 unique words of 3–15 letters.")
    bug_hunt_rounds = validate_bug_hunt_rounds(q.bug_hunt_rounds) if q.quiz_type == "bug_hunt" else []
    optimal_point_rounds = validate_optimal_point_rounds(q.optimal_point_rounds) if q.quiz_type == "optimal_point" else []

    # Keep exactly one active quiz per calendar date.
    existing = (
        db.query(models.Quiz)
        .filter(
            models.Quiz.date == q.date,
            models.Quiz.is_active == True,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                f"A quiz is already scheduled for {q.date}. "
                "Edit the existing quiz instead."
            ),
        )

    quiz = models.Quiz(
        question=q.question,
        options=q.options,
        correct_index=q.correct_index,
        explanation=q.explanation.strip(),
        date=q.date,
        expiry=quiz_expiry_for_date(q.date),
        is_active=True,
        quiz_type=q.quiz_type,
        word_search_config={"items": [{"word": words[index], "clue": str((q.word_search_items or [])[index].get("clue", "")).strip() or "Find the hidden term."} for index in range(len(words))]} if q.quiz_type == "word_search" else None,
        bug_hunt_config={"rounds": bug_hunt_rounds} if q.quiz_type == "bug_hunt" else None,
        optimal_point_config={"rounds": optimal_point_rounds} if q.quiz_type == "optimal_point" else None,
        duration_seconds=q.duration_seconds,
    )

    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    return {
        "id": quiz.id,
        "date": str(quiz.date),
        "message": "Quiz scheduled successfully",
    }


@app.get("/api/admin/quizzes")
def admin_quizzes(
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    today = sri_lanka_today()

    quizzes = (
        db.query(models.Quiz)
        .order_by(
            models.Quiz.date.asc(),
            models.Quiz.id.asc(),
        )
        .all()
    )

    result = []

    for q in quizzes:
        if q.date < today:
            quiz_status = "completed"
        elif q.date == today:
            quiz_status = "today"
        else:
            quiz_status = "scheduled"

        result.append(
            {
                "id": q.id,
                "question": q.question,
                "options": q.options,
                "correct_index": q.correct_index,
                "explanation": q.explanation or "",
                "date": str(q.date),
                "expiry": q.expiry.isoformat(),
                "is_active": q.is_active,
                "status": quiz_status,
                "quiz_type": q.quiz_type,
                "word_search_items": (q.word_search_config or {}).get("items", []),
                "bug_hunt_rounds": (q.bug_hunt_config or {}).get("rounds", []),
                "optimal_point_rounds": (q.optimal_point_config or {}).get("rounds", []),
                "duration_seconds": q.duration_seconds,
            }
        )

    return {"quizzes": result}


@app.delete("/api/admin/quiz/{quiz_id}")
def delete_admin_quiz(
    quiz_id: int,
    force: bool = False,
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    submission_count = db.query(models.Submission).filter(
        models.Submission.quiz_id == quiz_id,
    ).count()

    if submission_count and not force:
        return {
            "requires_confirmation": True,
            "submission_count": submission_count,
        }

    db.query(models.QuizComment).filter(
        models.QuizComment.quiz_id == quiz_id,
    ).delete(synchronize_session=False)
    db.query(models.WordSearchProgress).filter(
        models.WordSearchProgress.quiz_id == quiz_id,
    ).delete(synchronize_session=False)
    db.query(models.BugHuntProgress).filter(
        models.BugHuntProgress.quiz_id == quiz_id,
    ).delete(synchronize_session=False)
    db.query(models.OptimalPointProgress).filter(
        models.OptimalPointProgress.quiz_id == quiz_id,
    ).delete(synchronize_session=False)
    db.query(models.Submission).filter(
        models.Submission.quiz_id == quiz_id,
    ).delete(synchronize_session=False)
    db.delete(quiz)
    db.commit()

    return {
        "message": "Quiz deleted successfully.",
        "deleted_quiz_id": quiz_id,
    }


@app.put("/api/admin/quiz/{quiz_id}")
def update_quiz(
    quiz_id: int,
    q: schemas.QuizCreate,
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(models.Quiz).filter(
        models.Quiz.id == quiz_id
    ).first()

    if not quiz:
        raise HTTPException(
            status_code=404,
            detail="Quiz not found",
        )

    today = sri_lanka_today()

    # Historical quiz data is kept unchanged because leaderboard and
    # submission records may depend on it.
    if quiz.date < today:
        raise HTTPException(
            status_code=400,
            detail="Completed quizzes cannot be edited.",
        )

    if q.date < today:
        raise HTTPException(
            status_code=400,
            detail="You cannot move a quiz to a past date.",
        )

    conflicting_quiz = (
        db.query(models.Quiz)
        .filter(
            models.Quiz.id != quiz_id,
            models.Quiz.date == q.date,
            models.Quiz.is_active == True,
        )
        .first()
    )

    if conflicting_quiz:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Another quiz is already scheduled for {q.date}."
            ),
        )

    previous_correct_index = quiz.correct_index

    if q.quiz_type == "multiple_choice" and (len(q.options) != 4 or any(not option.strip() for option in q.options)):
        raise HTTPException(status_code=400, detail="Multiple-choice quizzes require four options.")
    items = q.word_search_items or []
    words = ["".join(ch for ch in str(item.get("word", "")).upper() if ch.isalpha()) for item in items]
    if q.quiz_type == "word_search" and (not 3 <= len(words) <= 10 or any(len(word) < 3 or len(word) > 15 for word in words) or len(set(words)) != len(words)):
        raise HTTPException(status_code=400, detail="Word searches require 3–10 unique words of 3–15 letters.")
    bug_hunt_rounds = validate_bug_hunt_rounds(q.bug_hunt_rounds) if q.quiz_type == "bug_hunt" else []
    optimal_point_rounds = validate_optimal_point_rounds(q.optimal_point_rounds) if q.quiz_type == "optimal_point" else []

    quiz.question = q.question
    quiz.options = q.options
    quiz.correct_index = q.correct_index
    quiz.explanation = q.explanation.strip()
    quiz.date = q.date
    quiz.expiry = quiz_expiry_for_date(q.date)
    quiz.is_active = True
    quiz.quiz_type = q.quiz_type
    quiz.word_search_config = {"items": [{"word": words[index], "clue": str(items[index].get("clue", "")).strip() or "Find the hidden term."} for index in range(len(words))]} if q.quiz_type == "word_search" else None
    quiz.bug_hunt_config = {"rounds": bug_hunt_rounds} if q.quiz_type == "bug_hunt" else None
    quiz.optimal_point_config = {"rounds": optimal_point_rounds} if q.quiz_type == "optimal_point" else None
    quiz.duration_seconds = q.duration_seconds

    if previous_correct_index != q.correct_index:
        submissions = db.query(models.Submission).filter(
            models.Submission.quiz_id == quiz.id
        ).all()

        for submission in submissions:
            submission.is_correct = (
                submission.selected_index == q.correct_index
            )
            submission.score = int(submission.is_correct)
            submission.max_score = 1

    db.commit()
    db.refresh(quiz)

    return {
        "id": quiz.id,
        "date": str(quiz.date),
        "message": "Quiz updated successfully",
    }


# ============================================================
# ADMIN - USERS
# ============================================================

@app.get("/api/admin/users")
def admin_users(
    search: str = "",
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.User).order_by(
        models.User.id
    )

    if search:
        term = f"%{search}%"

        query = query.filter(
            (models.User.username.ilike(term))
            | (models.User.email.ilike(term))
        )

    return {
        "users": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "whatsapp_number": user.whatsapp_number,
                "role": user.role,
            }
            for user in query.all()
        ]
    }


@app.delete("/api/admin/users/{user_id}")
def delete_user(
    user_id: int,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own admin account",
        )

    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.role == "admin" or user.id == 2:
        raise HTTPException(
            status_code=400,
            detail="Admin accounts cannot be removed",
        )

    db.query(models.Submission).filter(
        models.Submission.user_id == user_id
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()

    return {"ok": True}


@app.post("/api/admin/users/{user_id}/make-admin")
def make_admin(
    user_id: int,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if admin.email != "codeprolkyt@gmail.com":
        raise HTTPException(
            status_code=403,
            detail="Only the primary admin can grant admin access",
        )

    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    user.role = "admin"
    db.commit()

    return {
        "ok": True,
        "id": user.id,
        "role": user.role,
    }


# ============================================================
# ADMIN - QUIZ COMMENT MODERATION
# ============================================================

@app.get("/api/admin/quiz-comments")
def admin_quiz_comments(
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    comments = (
        db.query(models.QuizComment)
        .join(models.Quiz)
        .join(models.User)
        .order_by(
            models.QuizComment.created_at.desc(),
            models.QuizComment.id.desc(),
        )
        .limit(100)
        .all()
    )

    return {
        "comments": [
            {
                "id": comment.id,
                "body": comment.body,
                "is_anonymous": comment.is_anonymous,
                "created_at": sri_lanka_timestamp(comment.created_at),
                "quiz": {
                    "id": comment.quiz_id,
                    "date": str(comment.quiz.date) if comment.quiz else "",
                    "question": comment.quiz.question if comment.quiz else "Deleted quiz",
                },
                "user": {
                    "id": comment.user_id,
                    "username": comment.user.username if comment.user else "Deleted user",
                    "email": comment.user.email if comment.user else "",
                },
            }
            for comment in comments
        ],
    }


@app.delete("/api/admin/quiz-comments/{comment_id}")
def delete_quiz_comment(
    comment_id: int,
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    comment = db.query(models.QuizComment).filter(
        models.QuizComment.id == comment_id
    ).first()

    if not comment:
        raise HTTPException(
            status_code=404,
            detail="Comment not found",
        )

    db.delete(comment)
    db.commit()

    return {"ok": True}


# ============================================================
# ADMIN - STATISTICS
# ============================================================

@app.get("/api/admin/stats")
def admin_stats(
    month: str | None = None,
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    now = local_naive_now()

    if month:
        try:
            month_start = datetime.strptime(month, "%Y-%m")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Month must use YYYY-MM format.",
            )
    else:
        month_start = now.replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

    month_end = (
        month_start.replace(day=28)
        + timedelta(days=4)
    ).replace(day=1)

    submissions = (
        db.query(models.Submission)
        .filter(
            models.Submission.submitted_at >= month_start,
            models.Submission.submitted_at < month_end,
        )
        .all()
    )

    days = {}

    current_day = month_start.date()

    while current_day < month_end.date():
        days[str(current_day)] = {
            "participants": 0,
            "correct": 0,
            "incorrect": 0,
            "earned_points": 0,
            "available_points": 0,
            "participant_ids": set(),
        }

        current_day += timedelta(days=1)

    for submission in submissions:
        day = str(
            submission.submitted_at.date()
        )

        if day not in days:
            continue

        days[day]["participant_ids"].add(submission.user_id)
        days[day]["correct"] += int(
            submission.is_correct
        )
        days[day]["incorrect"] += int(not submission.is_correct)
        days[day]["earned_points"] += max(0, submission.score or 0)
        days[day]["available_points"] += max(1, submission.max_score or 1)

    for values in days.values():
        values["participants"] = len(values.pop("participant_ids"))
        values["score_rate"] = round(
            (values["earned_points"] / values["available_points"]) * 100
        ) if values["available_points"] else 0

    return {
        "month": month_start.strftime("%Y-%m"),
        "unique_participants": len({submission.user_id for submission in submissions}),
        "days": [
            {
                "date": day,
                **values,
            }
            for day, values in days.items()
        ],
    }


@app.get("/api/admin/dashboard")
def admin_dashboard(
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    today = sri_lanka_today()
    now = local_naive_now()

    today_quiz = (
        db.query(models.Quiz)
        .filter(
            models.Quiz.date == today,
            models.Quiz.is_active == True,
        )
        .first()
    )

    expired = (
        db.query(models.Quiz)
        .filter(
            models.Quiz.expiry < now
        )
        .count()
    )

    submissions = db.query(
        models.Submission
    ).count()

    return {
        "today_quiz": bool(today_quiz),
        "expired_count": expired,
        "submissions": submissions,
    }


# ============================================================
# LEADERBOARD
# ============================================================

@app.get("/api/admin/leaderboard")
@app.get("/api/leaderboard")
def leaderboard(
    month: str = None,
    page: int = 1,
    db: Session = Depends(get_db),
):
    if page < 1:
        raise HTTPException(
            status_code=400,
            detail="Page must be at least 1",
        )

    if month:
        try:
            month_start = datetime.strptime(
                month,
                "%Y-%m",
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Month must use YYYY-MM format",
            )

        month_end = (
            month_start.replace(day=28)
            + timedelta(days=4)
        ).replace(day=1)

    else:
        current = local_naive_now()

        month_start = current.replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        month_end = (
            month_start.replace(day=28)
            + timedelta(days=4)
        ).replace(day=1)

    users = db.query(models.User).all()

    result = []

    for u in users:
        submissions = (
            db.query(models.Submission)
            .filter(
                models.Submission.user_id == u.id,
                models.Submission.submitted_at >= month_start,
                models.Submission.submitted_at < month_end,
            )
            .all()
        )

        attempts = len(submissions)

        if attempts == 0:
            continue

        scoring_submissions = [
            submission
            for submission in submissions
            if submission.score > 0
        ]

        correct = sum(submission.score for submission in submissions)
        available_points = sum(submission.max_score for submission in submissions)

        # Preserve the corrected ranking rule:
        # when monthly scores are equal, the user who reached
        # that score earlier ranks higher.
        score_reached_at = (
            max(
                submission.submitted_at
                for submission
                in scoring_submissions
            )
            if scoring_submissions
            else min(
                submission.submitted_at
                for submission
                in submissions
            )
        )

        result.append(
            {
                "username": u.username,
                "email": u.email,
                "correct": correct,
                "available_points": available_points,
                "attempts": attempts,
                "_score_reached_at": score_reached_at,
                "_user_id": u.id,
            }
        )

    result.sort(
        key=lambda entry: (
            -entry["correct"],
            entry["_score_reached_at"],
            entry["_user_id"],
        )
    )

    for i, entry in enumerate(
        result,
        start=1,
    ):
        entry["rank"] = i
        del entry["_score_reached_at"]
        del entry["_user_id"]

    page_size = 10
    total_entries = len(result)

    total_pages = max(
        1,
        (
            total_entries
            + page_size
            - 1
        )
        // page_size,
    )

    if page > total_pages:
        page = total_pages

    start = (
        page - 1
    ) * page_size

    return {
        "leaderboard": result[
            start:start + page_size
        ],
        "page": page,
        "page_size": page_size,
        "total_entries": total_entries,
        "total_pages": total_pages,
    }
