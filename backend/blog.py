"""Blog posts and image assets stored in the existing PostgreSQL database."""

import base64
import binascii
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    LargeBinary,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Session, deferred

from database import Base, get_db


MAX_IMAGE = 5 * 1024 * 1024
MAX_BODY = 7 * 1024 * 1024 + 65536
MAX_CAPTION = 12000


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True)
    title = Column(String(160), nullable=False)
    caption = Column(Text, nullable=False)
    image_alt = Column(String(300), nullable=False)
    image_type = Column(String(30), nullable=False)
    image_data = deferred(Column(LargeBinary, nullable=False))
    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True,
    )


def post_json(post):
    return {
        "id": post.id,
        "title": post.title,
        "caption": post.caption,
        "image_alt": post.image_alt,
        "image_url": f"/api/blog/posts/{post.id}/image",
        "created_at": post.created_at.replace(
            tzinfo=timezone.utc
        ).isoformat(),
    }


def clean_caption(value):
    if (
        not isinstance(value, str)
        or not value.strip()
        or len(value.strip()) > MAX_CAPTION
    ):
        raise HTTPException(
            status_code=400,
            detail="Caption must contain 1–12000 characters.",
        )

    caption = value.strip()
    title = next(
        (
            line.strip()
            for line in caption.splitlines()
            if line.strip()
        ),
        "",
    )[:160]

    return caption, title


def image_bytes(encoded):
    if (
        not isinstance(encoded, str)
        or len(encoded) > 4 * ((MAX_IMAGE + 2) // 3)
    ):
        raise HTTPException(
            status_code=400,
            detail="Choose an image up to 5 MB.",
        )

    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(
            status_code=400,
            detail="Invalid image data.",
        )

    if not raw or len(raw) > MAX_IMAGE:
        raise HTTPException(
            status_code=400,
            detail="Choose an image up to 5 MB.",
        )

    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif raw.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise HTTPException(
            status_code=400,
            detail="Use a PNG, JPEG or WebP image.",
        )

    return raw, mime


def make_blog_router(require_admin):
    router = APIRouter()

    @router.get("/api/blog/posts")
    def posts(
        page: int = 1,
        db: Session = Depends(get_db),
    ):
        if page < 1:
            raise HTTPException(
                status_code=400,
                detail="Page must be at least 1.",
            )

        latest = (
            db.query(BlogPost)
            .order_by(
                BlogPost.created_at.desc(),
                BlogPost.id.desc(),
            )
            .first()
        )

        return {
            "posts": [post_json(latest)] if latest else [],
            "page": 1,
            "total_pages": 1,
        }

    @router.get("/api/blog/posts/{post_id}/image")
    def image(
        post_id: int,
        db: Session = Depends(get_db),
    ):
        post = (
            db.query(BlogPost)
            .filter(BlogPost.id == post_id)
            .first()
        )

        if not post:
            raise HTTPException(
                status_code=404,
                detail="Post not found.",
            )

        return Response(
            content=post.image_data,
            media_type=post.image_type,
            headers={
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "public, max-age=3600",
            },
        )

    @router.get("/api/admin/blog/posts")
    def admin_posts(
        admin=Depends(require_admin),
        db: Session = Depends(get_db),
    ):
        posts = (
            db.query(BlogPost)
            .order_by(
                BlogPost.created_at.desc(),
                BlogPost.id.desc(),
            )
            .all()
        )

        return {
            "posts": [post_json(post) for post in posts]
        }

    @router.post("/api/admin/blog/posts", status_code=201)
    async def publish(
        request: Request,
        admin=Depends(require_admin),
        db: Session = Depends(get_db),
    ):
        body = bytearray()

        async for chunk in request.stream():
            body.extend(chunk)

            if len(body) > MAX_BODY:
                raise HTTPException(
                    status_code=413,
                    detail="Choose an image up to 5 MB.",
                )

        try:
            data = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid post.",
            )

        if not isinstance(data, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid post.",
            )

        caption, title = clean_caption(data.get("caption"))
        raw, mime = image_bytes(data.get("image_base64"))

        try:
            db.execute(
                text("SELECT pg_advisory_xact_lock(684217, 1)")
            )

            # Preserve the existing one-post blog behaviour.
            # Publishing a new post replaces the previous one.
            db.query(BlogPost).delete(
                synchronize_session=False
            )

            new_post = BlogPost(
                title=title,
                caption=caption,
                image_alt=title,
                image_data=raw,
                image_type=mime,
            )

            db.add(new_post)
            db.flush()
            db.refresh(new_post)

            response_data = post_json(new_post)
            db.commit()

            return response_data

        except Exception:
            db.rollback()
            raise

    @router.put("/api/admin/blog/posts/{post_id}")
    async def edit_post_caption(
        post_id: int,
        request: Request,
        admin=Depends(require_admin),
        db: Session = Depends(get_db),
    ):
        post = (
            db.query(BlogPost)
            .filter(BlogPost.id == post_id)
            .first()
        )

        if not post:
            raise HTTPException(
                status_code=404,
                detail="Post not found.",
            )

        try:
            data = await request.json()
        except (ValueError, json.JSONDecodeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid post.",
            )

        if not isinstance(data, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid post.",
            )

        caption, title = clean_caption(data.get("caption"))

        try:
            post.caption = caption
            post.title = title
            post.image_alt = title
            db.commit()
            db.refresh(post)
            return post_json(post)
        except Exception:
            db.rollback()
            raise

    @router.delete("/api/admin/blog/posts/{post_id}")
    def delete_post(
        post_id: int,
        admin=Depends(require_admin),
        db: Session = Depends(get_db),
    ):
        post = (
            db.query(BlogPost)
            .filter(BlogPost.id == post_id)
            .first()
        )

        if not post:
            raise HTTPException(
                status_code=404,
                detail="Post not found.",
            )

        try:
            db.delete(post)
            db.commit()
            return {
                "deleted": True,
                "message": "Blog post deleted successfully.",
            }
        except Exception:
            db.rollback()
            raise

    return router
