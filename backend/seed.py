import os
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import SessionLocal
from models import User
from auth import get_password_hash


def create_default_admin():
    db: Session = SessionLocal()

    try:
        admin_username = os.getenv("ADMIN_USERNAME")
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        admin_role = os.getenv("ADMIN_ROLE")

        if not admin_username or not admin_email or not admin_password:
            print("Default admin not created: admin environment variables are incomplete.")
            return

        existing_admin = db.query(User).filter(
            or_(
                User.email == admin_email,
                User.username == admin_username,
            )
        ).first()

        if existing_admin:
            existing_admin.username = admin_username
            existing_admin.email = admin_email
            existing_admin.role = admin_role
            db.commit()
            print("Default admin already exists. Admin role checked/updated.")
            return

        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            role=admin_role
        )

        db.add(admin_user)
        db.commit()

        print("Default admin user created successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error creating default admin: {e}")

    finally:
        db.close()
