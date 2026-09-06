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
            "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_active BOOLEAN "
            "NOT NULL DEFAULT TRUE"
        ))
        connection.execute(text(
            "UPDATE quizzes SET is_active = FALSE WHERE id <> "
            "(SELECT id FROM quizzes ORDER BY id DESC LIMIT 1)"
        ))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
