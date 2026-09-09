import React, { useRef, useEffect, useState } from "react";
import { getToken, getTokenPayload } from "../utils/auth";

function captionParts(caption) {
  const lines = caption.trim().split(/\r?\n/);
  return { heading: lines[0], body: lines.slice(1).join("\n").trim() };
}

function CaptionText({ text }) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : <React.Fragment key={index}>{part}</React.Fragment>
  );
}

function validBlogImage(file) {
  return (
    file &&
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    file.size <= 5 * 1024 * 1024
  );
}

function encodeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}

export default function Blog() {
  const [data, setData] = useState({ posts: [], total_pages: 1 });
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingCaption, setEditingCaption] = useState("");
  const [busyPostId, setBusyPostId] = useState(null);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [assetBusy, setAssetBusy] = useState("");
  const heroInputRef = useRef(null);
  const closingInputRef = useRef(null);
  const token = getToken();
  const isAdmin = getTokenPayload(token)?.role === "admin";
  const heroPost = data.posts[0];
  const heroTitle = heroPost ? captionParts(heroPost.caption).heading : "CodePRO LK Blog";
  const heroImage = assets.hero?.image_url;
  const closingImage = assets.closing?.image_url;

  const loadPosts = (signal) => {
    setLoading(true);
    setError("");
    return Promise.all([
      fetch("/api/blog/posts?page=1", { signal }),
      fetch("/api/blog/assets", { signal }),
    ])
      .then(async (r) => {
        const [postsResponse, assetsResponse] = r;
        if (!postsResponse.ok) throw new Error("Unable to load posts. Please refresh to try again.");
        if (!assetsResponse.ok) throw new Error("Unable to load blog images. Please refresh to try again.");
        return Promise.all([postsResponse.json(), assetsResponse.json()]);
      })
      .then(([postsValue, assetsValue]) => {
        if (!signal?.aborted) {
          setData(postsValue);
          setAssets(assetsValue.assets || {});
        }
      })
      .catch((e) => { if (!signal?.aborted) setError(e.message); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  };

  useEffect(() => {
    const controller = new AbortController();
    loadPosts(controller.signal);
    return () => controller.abort();
  }, []);

  const beginEdit = (post) => {
    setEditingPostId(post.id);
    setEditingCaption(post.caption);
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditingCaption("");
  };

  const saveCaption = async (postId) => {
    const cleaned = editingCaption.trim();
    if (!cleaned) {
      setError("Caption cannot be empty.");
      return;
    }

    setBusyPostId(postId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/blog/posts/${postId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caption: cleaned }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || "Unable to update caption.");

      setData((current) => ({
        ...current,
        posts: current.posts.map((post) => post.id === postId ? body : post),
      }));
      cancelEdit();
      setMessage("Caption updated.");
    } catch (e) {
      setError(e.message || "Unable to update caption.");
    } finally {
      setBusyPostId(null);
    }
  };

  const deletePost = async (post) => {
    if (!window.confirm("Delete this blog post?")) return;

    setBusyPostId(post.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/blog/posts/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || "Unable to delete post.");

      setData((current) => ({
        ...current,
        posts: current.posts.filter((item) => item.id !== post.id),
      }));
      setMessage("Post deleted.");
    } catch (e) {
      setError(e.message || "Unable to delete post.");
    } finally {
      setBusyPostId(null);
    }
  };

  const updateSectionImage = async (key, file) => {
    if (!validBlogImage(file)) {
      setError("Choose a PNG, JPEG or WebP image up to 5 MB.");
      return;
    }

    setAssetBusy(key);
    setError("");
    setMessage("");

    try {
      const encoded = await encodeImage(file);
      const response = await fetch(`/api/admin/blog/assets/${key}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_base64: encoded }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.detail || "Unable to update blog image.");
      }

      setAssets((current) => ({ ...current, [key]: body }));
      setMessage(key === "hero" ? "Top blog image updated." : "Bottom blog image updated.");
    } catch (e) {
      setError(e.message || "Unable to update blog image.");
    } finally {
      setAssetBusy("");
    }
  };

  return (
    <section className="cp-blog">
      <header
        className={`cp-blog-hero ${!heroImage ? "cp-blog-hero-empty" : ""}`}
        style={heroImage ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.28), rgba(2,6,23,.72)), url(${heroImage})` } : undefined}
      >
        {isAdmin && (
          <>
            <input
              ref={heroInputRef}
              className="cp-blog-section-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) updateSectionImage("hero", selected);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="cp-blog-section-camera"
              onClick={() => heroInputRef.current?.click()}
              disabled={assetBusy === "hero"}
              title="Change top blog image"
              aria-label="Change top blog image"
            >
              {assetBusy === "hero" ? "..." : "⌾"}
            </button>
          </>
        )}
        <div className="cp-blog-hero-inner">
          <p className="cp-blog-tag">CODEPRO LK / JOURNAL</p>
          <h1>BLOG</h1>
          <p>{heroTitle}</p>
        </div>
      </header>

      <div className="cp-blog-inner">
        <div className="cp-blog-section-title">
          <h2>Latest Posts</h2>
          <span>{data.posts.length ? "List" : "Empty"}</span>
        </div>
        {message && <p className="cp-blog-admin-message" role="status">{message}</p>}
        {loading ? <p role="status">Loading posts…</p> : error ? (
          <p role="alert">{error}</p>
        ) : !data.posts.length ? (
          <div className="cp-blog-empty">Our first post is on its way. Check back soon.</div>
        ) : (
          <>
            <div className="cp-blog-feed">
              {data.posts.map((post, index) => (
                <article
                  className={`cp-blog-post ${expandedPostId === post.id ? "cp-blog-post-expanded" : ""}`}
                  key={post.id}
                >
                  <div className="cp-blog-index">
                    <span>Post</span>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                  </div>
                  <div className="cp-blog-art">
                    <img src={post.image_url} alt={captionParts(post.caption).heading}
                      loading={index === 0 ? "eager" : "lazy"} />
                  </div>
                  <div className="cp-blog-copy">
                    {isAdmin && (
                      <div className="cp-blog-admin-tools" aria-label="Post admin tools">
                        <button type="button" onClick={() => beginEdit(post)} title="Edit caption">
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePost(post)}
                          disabled={busyPostId === post.id}
                          title="Delete post"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                    <div className="cp-blog-meta">
                      {index === 0 && <span>Latest post</span>}
                      <span>CodePRO LK Journal</span>
                    </div>
                    {editingPostId === post.id ? (
                      <div className="cp-blog-inline-editor">
                        <label htmlFor={`blog-edit-${post.id}`}>Edit caption</label>
                        <textarea
                          id={`blog-edit-${post.id}`}
                          value={editingCaption}
                          maxLength={12000}
                          rows={9}
                          onChange={(event) => setEditingCaption(event.target.value)}
                        />
                        <div>
                          <button
                            type="button"
                            onClick={() => saveCaption(post.id)}
                            disabled={busyPostId === post.id}
                          >
                            {busyPostId === post.id ? "Saving..." : "Save"}
                          </button>
                          <button type="button" onClick={cancelEdit} disabled={busyPostId === post.id}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2>{captionParts(post.caption).heading}</h2>
                        <p className={`cp-blog-caption ${expandedPostId === post.id ? "expanded" : ""}`}>
                          <CaptionText text={captionParts(post.caption).body} />
                        </p>
                        {captionParts(post.caption).body && (
                          <button
                            className="cp-blog-read-more"
                            type="button"
                            onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                          >
                            {expandedPostId === post.id ? "Show less" : "Read post"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      <footer
        className={`cp-blog-closing ${!closingImage ? "cp-blog-closing-empty" : ""}`}
        style={closingImage ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.72), rgba(2,6,23,.84)), url(${closingImage})` } : undefined}
      >
        {isAdmin && (
          <>
            <input
              ref={closingInputRef}
              className="cp-blog-section-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) updateSectionImage("closing", selected);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="cp-blog-section-camera"
              onClick={() => closingInputRef.current?.click()}
              disabled={assetBusy === "closing"}
              title="Change bottom blog image"
              aria-label="Change bottom blog image"
            >
              {assetBusy === "closing" ? "..." : "⌾"}
            </button>
          </>
        )}
        <p>Learn deeply. Build boldly. Share generously.</p>
      </footer>
    </section>
  );
}
