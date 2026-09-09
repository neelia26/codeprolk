from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from email.message import EmailMessage
import hashlib
import os
import secrets
import smtplib

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
    }

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
    )

    db.add(submission)
    db.commit()

    return {
        "ok": True,
        "is_correct": is_correct,
        "correct_index": quiz.correct_index,
    }


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
        "created_at": comment.created_at.isoformat(),
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

    can_comment = user_has_quiz_submission(db, user.id, quiz_id)

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

    if not user_has_quiz_submission(db, user.id, quiz_id):
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
        date=q.date,
        expiry=quiz_expiry_for_date(q.date),
        is_active=True,
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
                "date": str(q.date),
                "expiry": q.expiry.isoformat(),
                "is_active": q.is_active,
                "status": quiz_status,
            }
        )

    return {"quizzes": result}


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

    quiz.question = q.question
    quiz.options = q.options
    quiz.correct_index = q.correct_index
    quiz.date = q.date
    quiz.expiry = quiz_expiry_for_date(q.date)
    quiz.is_active = True

    if previous_correct_index != q.correct_index:
        submissions = db.query(models.Submission).filter(
            models.Submission.quiz_id == quiz.id
        ).all()

        for submission in submissions:
            submission.is_correct = (
                submission.selected_index == q.correct_index
            )

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
                "created_at": comment.created_at.isoformat(),
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
    _: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    now = local_naive_now()

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
            "attempts": 0,
            "correct": 0,
        }

        current_day += timedelta(days=1)

    for submission in submissions:
        day = str(
            submission.submitted_at.date()
        )

        if day not in days:
            continue

        days[day]["attempts"] += 1
        days[day]["correct"] += int(
            submission.is_correct
        )

    return {
        "month": month_start.strftime("%Y-%m"),
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

        correct_submissions = [
            submission
            for submission in submissions
            if submission.is_correct
        ]

        correct = len(correct_submissions)

        # Preserve the corrected ranking rule:
        # when monthly scores are equal, the user who reached
        # that score earlier ranks higher.
        score_reached_at = (
            max(
                submission.submitted_at
                for submission
                in correct_submissions
            )
            if correct_submissions
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
