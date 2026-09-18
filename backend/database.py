from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def migrate_users_table():
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50)"
        ))
        connection.execute(text(
            "UPDATE users SET username = 'user_' || id "
            "WHERE username IS NULL OR username = ''"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username "
            "ON users (username)"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "whatsapp_number VARCHAR(20)"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "password_reset_token_hash VARCHAR"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "password_reset_expires_at TIMESTAMP"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_users_password_reset_token_hash "
            "ON users (password_reset_token_hash)"
        ))
        connection.execute(text(
            "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_active BOOLEAN "
            "NOT NULL DEFAULT TRUE"
        ))
        connection.execute(text(
            "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS explanation TEXT "
            "NOT NULL DEFAULT ''"
        ))
        connection.execute(text("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS quiz_type VARCHAR(30) NOT NULL DEFAULT 'multiple_choice'"))
        connection.execute(text("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS word_search_config JSONB"))
        connection.execute(text("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS bug_hunt_config JSONB"))
        connection.execute(text("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS optimal_point_config JSONB"))
        connection.execute(text("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 180"))
        connection.execute(text("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0"))
        connection.execute(text("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS max_score INTEGER NOT NULL DEFAULT 1"))
        connection.execute(text("UPDATE submissions SET score = CASE WHEN is_correct THEN 1 ELSE 0 END WHERE max_score = 1"))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS word_search_progress ("
            "id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, found_words JSONB NOT NULL DEFAULT '[]'::jsonb, "
            "started_at TIMESTAMP NOT NULL DEFAULT NOW(), completed_at TIMESTAMP, UNIQUE(user_id, quiz_id))"
        ))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS bug_hunt_progress ("
            "id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, "
            "current_round INTEGER NOT NULL DEFAULT 0, answers JSONB NOT NULL DEFAULT '[]'::jsonb, "
            "started_at TIMESTAMP NOT NULL DEFAULT NOW(), completed_at TIMESTAMP, UNIQUE(user_id, quiz_id))"
        ))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS optimal_point_progress ("
            "id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, "
            "current_round INTEGER NOT NULL DEFAULT 0, answers JSONB NOT NULL DEFAULT '[]'::jsonb, "
            "started_at TIMESTAMP NOT NULL DEFAULT NOW(), completed_at TIMESTAMP, UNIQUE(user_id, quiz_id))"
        ))
        connection.execute(text(
            "UPDATE quizzes SET is_active = TRUE WHERE date >= CURRENT_DATE"
        ))
        connection.execute(text(
            "UPDATE quizzes older SET is_active = FALSE "
            "WHERE older.id NOT IN ("
            "SELECT DISTINCT ON (date) id FROM quizzes "
            "WHERE is_active = TRUE "
            "ORDER BY date, id DESC"
            ")"
        ))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS quiz_comments ("
            "id SERIAL PRIMARY KEY, "
            "quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, "
            "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "body TEXT NOT NULL, "
            "is_anonymous BOOLEAN NOT NULL DEFAULT FALSE, "
            "created_at TIMESTAMP NOT NULL DEFAULT NOW()"
            ")"
        ))
        connection.execute(text(
            "ALTER TABLE quiz_comments ADD COLUMN IF NOT EXISTS "
            "is_anonymous BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_quiz_comments_quiz_id "
            "ON quiz_comments (quiz_id)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_quiz_comments_user_id "
            "ON quiz_comments (user_id)"
        ))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
