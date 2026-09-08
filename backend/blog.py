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

        # Only the newest post is displayed.
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

        caption = data.get("caption")

        if (
            not isinstance(caption, str)
            or not caption.strip()
            or len(caption.strip()) > 12000
        ):
            raise HTTPException(
                status_code=400,
                detail="Caption must contain 1–12000 characters.",
            )

        caption = caption.strip()

        # The first caption line becomes the post title and alt text.
        title = next(
            (
                line.strip()
                for line in caption.splitlines()
                if line.strip()
            ),
            "",
        )[:160]

        raw, mime = image_bytes(data.get("image_base64"))

        try:
            # Prevent simultaneous publishes from interfering.
            db.execute(
                text("SELECT pg_advisory_xact_lock(684217, 1)")
            )

            # Remove every previous post, including its image and caption.
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

            # The deletion and new post are committed together.
            db.commit()

            return response_data

        except Exception:
            db.rollback()
            raise

    return router