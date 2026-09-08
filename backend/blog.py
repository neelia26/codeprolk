"""Blog posts and small image assets stored in the existing PostgreSQL volume."""
import base64
import binascii
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import Column, Integer, String, Text, DateTime, LargeBinary
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
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

def post_json(post):
    return {
        "id": post.id, "title": post.title, "caption": post.caption,
        "image_alt": post.image_alt,
        "image_url": f"/api/blog/posts/{post.id}/image",
        "created_at": post.created_at.replace(tzinfo=timezone.utc).isoformat(),
    }

def image_bytes(encoded):
    if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_IMAGE + 2) // 3):
        raise HTTPException(400, "Choose an image up to 5 MB.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Invalid image data.")
    if not raw or len(raw) > MAX_IMAGE:
        raise HTTPException(400, "Choose an image up to 5 MB.")
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif raw.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise HTTPException(400, "Use a PNG, JPEG or WebP image.")
    return raw, mime

def make_blog_router(require_admin):
    router = APIRouter()

    @router.get("/api/blog/posts")
    def posts(page: int = 1, db: Session = Depends(get_db)):
        if page < 1:
            raise HTTPException(400, "Page must be at least 1.")
        size = 6
        total = db.query(BlogPost).count()
        pages = max(1, (total + size - 1) // size)
        page = min(page, pages)
        items = db.query(BlogPost).order_by(
            BlogPost.created_at.desc(), BlogPost.id.desc()
        ).offset((page - 1) * size).limit(size).all()
        return {"posts": [post_json(p) for p in items],
                "page": page, "total_pages": pages}

    @router.get("/api/blog/posts/{post_id}/image")
    def image(post_id: int, db: Session = Depends(get_db)):
        post = db.query(BlogPost).filter(BlogPost.id == post_id).first()
        if not post:
            raise HTTPException(404, "Post not found.")
        return Response(content=post.image_data, media_type=post.image_type,
                        headers={"X-Content-Type-Options": "nosniff",
                                 "Cache-Control": "public, max-age=3600"})

    @router.post("/api/admin/blog/posts", status_code=201)
    async def publish(request: Request, admin=Depends(require_admin),
                      db: Session = Depends(get_db)):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_BODY:
                raise HTTPException(413, "Choose an image up to 5 MB.")
        import json
        try:
            data = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(400, "Invalid post.")
        if not isinstance(data, dict):
            raise HTTPException(400, "Invalid post.")
        caption = data.get("caption")
        if not isinstance(caption, str) or not caption.strip() or len(caption.strip()) > 12000:
            raise HTTPException(400, "Caption must contain 1–12000 characters.")
        caption = caption.strip()
        title = caption.splitlines()[0][:160]
        clean = {"title": title, "caption": caption, "image_alt": title}
        raw, mime = image_bytes(data.get("image_base64"))
        post = BlogPost(**clean, image_data=raw, image_type=mime)
        db.add(post)
        db.commit()
        db.refresh(post)
        return post_json(post)

    return router
