from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from database import Base
from datetime import datetime


class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    whatsapp_number = Column(String(20), nullable=True)
    hashed_password = Column(String, nullable=False)
    password_reset_token_hash = Column(String, nullable=True, index=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    role = Column(String, default='user')
    created_at = Column(DateTime, default=datetime.utcnow)

    submissions = relationship('Submission', back_populates='user')
    quiz_comments = relationship('QuizComment', back_populates='user')


class Quiz(Base):
    __tablename__ = 'quizzes'
    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    options = Column(JSONB, nullable=False)
    correct_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=False, default='')
    quiz_type = Column(String(30), nullable=False, default='multiple_choice')
    word_search_config = Column(JSONB, nullable=True)
    bug_hunt_config = Column(JSONB, nullable=True)
    optimal_point_config = Column(JSONB, nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=180)
    date = Column(Date, nullable=False, index=True)
    expiry = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    submissions = relationship('Submission', back_populates='quiz')
    comments = relationship('QuizComment', back_populates='quiz')


class Submission(Base):
    __tablename__ = 'submissions'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    quiz_id = Column(Integer, ForeignKey('quizzes.id'), nullable=False)
    selected_index = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    score = Column(Integer, nullable=False, default=0)
    max_score = Column(Integer, nullable=False, default=1)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='submissions')
    quiz = relationship('Quiz', back_populates='submissions')


class WordSearchProgress(Base):
    __tablename__ = 'word_search_progress'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False, index=True)
    found_words = Column(JSONB, nullable=False, default=list)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class BugHuntProgress(Base):
    __tablename__ = 'bug_hunt_progress'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False, index=True)
    current_round = Column(Integer, nullable=False, default=0)
    answers = Column(JSONB, nullable=False, default=list)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class OptimalPointProgress(Base):
    __tablename__ = 'optimal_point_progress'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False, index=True)
    current_round = Column(Integer, nullable=False, default=0)
    answers = Column(JSONB, nullable=False, default=list)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class QuizComment(Base):
    __tablename__ = 'quiz_comments'
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    body = Column(Text, nullable=False)
    is_anonymous = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    quiz = relationship('Quiz', back_populates='comments')
    user = relationship('User', back_populates='quiz_comments')
