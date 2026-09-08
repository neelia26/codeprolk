from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
import os

import models
from blog import make_blog_router
import schemas
import auth
from database import engine, get_db, migrate_users_table, Base
from seed import create_default_admin

models.Base.metadata.create_all(bind=engine)
migrate_users_table()

app = FastAPI()

origins = [os.getenv('FRONTEND_URL', 'http://localhost:5173'),
           "www.codeprolk.com", "https://codeprolk.com", "https://www.codeprolk.com", "http://codeprolk.com", "http://www.codeprolk.com",]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def startup_event():
    create_default_admin()


def get_current_user(token: str = Depends(lambda: None), db: Session = Depends(get_db)):
    # Dependency placeholder; token will be read from Authorization header in endpoints
    return None


@app.post('/api/auth/register')
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(
        (models.User.email == user.email) |
        (models.User.username == user.username)).first()
    if existing:
        if existing.email == user.email:
            raise HTTPException(
                status_code=400, detail='Email already registered')
        raise HTTPException(
            status_code=400, detail='Username already registered')

    hashed = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username, email=user.email,
        whatsapp_number=user.whatsapp_number,
        hashed_password=hashed, role='user')
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "username": db_user.username, "email": db_user.email}


@app.post('/api/auth/login')
def login(data: dict, db: Session = Depends(get_db)):
    email = data.get('email')
    password = data.get('password')
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not auth.verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail='Invalid credentials')

    token = auth.create_access_token(
        {"sub": user.email, "user_id": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}


def get_user_from_header(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='Not authenticated')
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid auth header')
    token = parts[1]
    payload = auth.decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')
    user = db.query(models.User).filter(
        models.User.id == payload.get('user_id')).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found')
    return user


def get_admin_user(user: models.User = Depends(get_user_from_header)):
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Forbidden')
    return user


app.include_router(make_blog_router(get_admin_user))


def deactivate_expired_quizzes(db: Session):
    db.query(models.Quiz).filter(
        models.Quiz.is_active == True,
        models.Quiz.expiry < datetime.utcnow(),
    ).update({models.Quiz.is_active: False}, synchronize_session=False)
    db.commit()


@app.get('/api/quiz/today')
def get_today_quiz(user: models.User = Depends(get_user_from_header), db: Session = Depends(get_db)):
    deactivate_expired_quizzes(db)
    today = date.today()
    # Keep today's latest quiz available for reviewing an existing attempt.
    quiz = db.query(models.Quiz).filter(
        models.Quiz.date == today
    ).order_by(models.Quiz.id.desc()).first()
    if not quiz:
        return {"quiz": None}

    submitted = db.query(models.Submission).filter(
        models.Submission.user_id == user.id,
        models.Submission.quiz_id == quiz.id,
    ).first()

    quiz_data = {
        "id": quiz.id,
        "question": quiz.question,
        "options": quiz.options,
        "date": str(quiz.date),
        "expiry": quiz.expiry.isoformat(),
    }
    if submitted:
        return {
            "quiz": quiz_data,
            "submitted": True,
            "submission": {
                "selected_index": submitted.selected_index,
                "is_correct": submitted.is_correct,
                "correct_index": quiz.correct_index,
            },
        }
    if quiz.expiry < datetime.utcnow():
        return {"quiz": None, "expired": True}
    if not quiz.is_active:
        return {"quiz": None}
    return {"quiz": quiz_data}


@app.post('/api/quiz/submit')
def submit_answer(sub: schemas.SubmitAnswer, authorization: str = Header(None), db: Session = Depends(get_db)):
    raise_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail='Not authenticated')
    if not authorization:
        raise raise_exception
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise raise_exception
    token = parts[1]
    payload = auth.decode_token(token)
    if not payload:
        raise raise_exception
    user = db.query(models.User).filter(
        models.User.id == payload.get('user_id')).first()
    if not user:
        raise raise_exception

    quiz = db.query(models.Quiz).filter(models.Quiz.id == sub.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail='Quiz not found')

    # Check expiry
    if quiz.expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail='Quiz expired')

    # Check if user already submitted
    existing = db.query(models.Submission).filter(
        models.Submission.user_id == user.id, models.Submission.quiz_id == quiz.id).first()
    if existing:
        raise HTTPException(status_code=400, detail='Already submitted')

    is_correct = (sub.selected_index == quiz.correct_index)
    submission = models.Submission(
        user_id=user.id, quiz_id=quiz.id, selected_index=sub.selected_index, is_correct=is_correct)
    db.add(submission)
    db.commit()
    return {"ok": True, "is_correct": is_correct, "correct_index": quiz.correct_index}


@app.post('/api/admin/quiz')
def create_quiz(q: schemas.QuizCreate, _: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    db.query(models.Quiz).update({models.Quiz.is_active: False})
    quiz = models.Quiz(question=q.question, options=q.options,
                       correct_index=q.correct_index, date=q.date, expiry=q.expiry,
                       is_active=True)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return {"id": quiz.id}


@app.get('/api/admin/quizzes')
def admin_quizzes(_: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    deactivate_expired_quizzes(db)
    quizzes = db.query(models.Quiz).filter(
        models.Quiz.is_active == True
    ).order_by(models.Quiz.date.desc()).all()
    result = []
    for q in quizzes:
        result.append({"id": q.id, "question": q.question,
                      "options": q.options, "correct_index": q.correct_index,
                       "date": str(q.date), "expiry": q.expiry.isoformat(),
                       "is_active": q.is_active})
    return {"quizzes": result}


@app.put('/api/admin/quiz/{quiz_id}')
def update_quiz(quiz_id: int, q: schemas.QuizCreate, _: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail='Quiz not found')
    db.query(models.Quiz).filter(models.Quiz.id != quiz_id).update(
        {models.Quiz.is_active: False})
    quiz.question = q.question
    quiz.options = q.options
    quiz.correct_index = q.correct_index
    quiz.date = q.date
    quiz.expiry = q.expiry
    quiz.is_active = True
    db.commit()
    return {"id": quiz.id}


@app.get('/api/admin/users')
def admin_users(search: str = '', _: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    query = db.query(models.User).order_by(models.User.id)
    if search:
        term = f'%{search}%'
        query = query.filter((models.User.username.ilike(term))
                             | (models.User.email.ilike(term)))
    return {"users": [{
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "whatsapp_number": user.whatsapp_number,
        "role": user.role,
    } for user in query.all()]}


@app.delete('/api/admin/users/{user_id}')
def delete_user(user_id: int, admin: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(
            status_code=400, detail='You cannot remove your own admin account')
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    if user.role == 'admin' or user.id == 2:
        raise HTTPException(
            status_code=400, detail='Admin accounts cannot be removed')
    db.query(models.Submission).filter(models.Submission.user_id ==
                                       user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return {"ok": True}


@app.post('/api/admin/users/{user_id}/make-admin')
def make_admin(user_id: int, admin: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    if admin.email != 'codeprolkyt@gmail.com':
        raise HTTPException(
            status_code=403, detail='Only the primary admin can grant admin access')
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    user.role = 'admin'
    db.commit()
    return {"ok": True, "id": user.id, "role": user.role}


@app.get('/api/admin/stats')
def admin_stats(_: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    month_start = datetime.utcnow().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end = (month_start.replace(day=28) +
                 timedelta(days=4)).replace(day=1)
    submissions = db.query(models.Submission).filter(
        models.Submission.submitted_at >= month_start,
        models.Submission.submitted_at < month_end,
    ).all()
    days = {}
    current_day = month_start.date()
    while current_day < month_end.date():
        days[str(current_day)] = {"attempts": 0, "correct": 0}
        current_day += timedelta(days=1)
    for submission in submissions:
        day = str(submission.submitted_at.date())
        days[day]["attempts"] += 1
        days[day]["correct"] += int(submission.is_correct)
    return {"month": month_start.strftime('%Y-%m'), "days": [{"date": day, **values} for day, values in days.items()]}


@app.get('/api/admin/dashboard')
def admin_dashboard(_: models.User = Depends(get_admin_user), db: Session = Depends(get_db)):
    # basic stats: today quiz, expired quizzes, submissions
    today = date.today()
    today_quiz = db.query(models.Quiz).filter(
        models.Quiz.date == today).first()
    expired = db.query(models.Quiz).filter(
        models.Quiz.expiry < datetime.utcnow()).count()
    submissions = db.query(models.Submission).count()
    return {"today_quiz": bool(today_quiz), "expired_count": expired, "submissions": submissions}


@app.get('/api/admin/leaderboard')
@app.get('/api/leaderboard')
def leaderboard(month: str = None, page: int = 1, db: Session = Depends(get_db)):
    if page < 1:
        raise HTTPException(status_code=400, detail='Page must be at least 1')
    if month:
        try:
            month_start = datetime.strptime(month, '%Y-%m')
        except ValueError:
            raise HTTPException(
                status_code=400, detail='Month must use YYYY-MM format')
        month_end = (month_start.replace(day=28) +
                     timedelta(days=4)).replace(day=1)
    else:
        current = datetime.utcnow()
        month_start = current.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start.replace(day=28) +
                     timedelta(days=4)).replace(day=1)

    users = db.query(models.User).all()
    result = []
    for u in users:
        submissions = db.query(models.Submission).filter(
            models.Submission.user_id == u.id,
            models.Submission.submitted_at >= month_start,
            models.Submission.submitted_at < month_end,
        ).all()
        attempts = len(submissions)
        if attempts == 0:
            continue

        correct_submissions = [
            submission for submission in submissions if submission.is_correct
        ]
        correct = len(correct_submissions)

        # Earlier timestamp wins when monthly scores are equal.
        # A later incorrect attempt must not change when a score was reached.
        score_reached_at = (
            max(submission.submitted_at for submission in correct_submissions)
            if correct_submissions
            else min(submission.submitted_at for submission in submissions)
        )
        result.append({
            "username": u.username,
            "email": u.email,
            "correct": correct,
            "attempts": attempts,
            "_score_reached_at": score_reached_at,
            "_user_id": u.id,
        })

    result.sort(key=lambda entry: (
        -entry["correct"],
        entry["_score_reached_at"],
        entry["_user_id"],
    ))
    for i, r in enumerate(result, start=1):
        r['rank'] = i
        del r["_score_reached_at"]
        del r["_user_id"]
    page_size = 10
    total_entries = len(result)
    total_pages = max(1, (total_entries + page_size - 1) // page_size)
    if page > total_pages:
        page = total_pages
    start = (page - 1) * page_size
    return {
        "leaderboard": result[start:start + page_size],
        "page": page,
        "page_size": page_size,
        "total_entries": total_entries,
        "total_pages": total_pages,
    }
