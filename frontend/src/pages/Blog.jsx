import React, { useEffect, useState } from "react";
import { getToken, getTokenPayload } from "../utils/auth";

function captionParts(caption) {
  const lines = caption.trim().split(/\r?\n/);
  return { heading: lines[0], body: lines.slice(1).join("\n").trim() };
}

function postDateParts(value) {
  const date = new Date(value);
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
    full: date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

function CaptionText({ text }) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : <React.Fragment key={index}>{part}</React.Fragment>
  );
}

export default function Blog() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ posts: [], total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingCaption, setEditingCaption] = useState("");
  const [busyPostId, setBusyPostId] = useState(null);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const token = getToken();
  const isAdmin = getTokenPayload(token)?.role === "admin";
  const heroPost = data.posts[0];
  const heroTitle = heroPost ? captionParts(heroPost.caption).heading : "CodePRO LK Blog";
  const heroImage = heroPost?.image_url;

  const loadPosts = (signal) => {
    setLoading(true);
    setError("");
    return fetch(`/api/blog/posts?page=${page}`, { signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Unable to load posts. Please refresh to try again.");
        return r.json();
      })
      .then((value) => { if (!signal?.aborted) setData(value); })
      .catch((e) => { if (!signal?.aborted) setError(e.message); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  };

  useEffect(() => {
    const controller = new AbortController();
    loadPosts(controller.signal);
    return () => controller.abort();
  }, [page]);

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

  return (
    <section className="cp-blog">
      <header
        className="cp-blog-hero"
        style={heroImage ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.28), rgba(2,6,23,.72)), url(${heroImage})` } : undefined}
      >
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
                <article className="cp-blog-post" key={post.id}>
                  <div className="cp-blog-date">
                    <span>{postDateParts(post.created_at).month}</span>
                    <strong>{postDateParts(post.created_at).day}</strong>
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
                      {page === 1 && index === 0 && <span>Latest post</span>}
                      <time dateTime={post.created_at}>{postDateParts(post.created_at).full}</time>
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
            {data.total_pages > 1 && (
              <nav className="cp-blog-pagination" aria-label="Blog pages">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer posts</button>
                <span>Page {data.page} of {data.total_pages}</span>
                <button disabled={page >= data.total_pages} onClick={() => setPage(page + 1)}>Older posts</button>
              </nav>
            )}
          </>
        )}
      </div>
      <footer
        className="cp-blog-closing"
        style={heroImage ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.72), rgba(2,6,23,.84)), url(${heroImage})` } : undefined}
      >
        <p>Learn deeply. Build boldly. Share generously.</p>
      </footer>
    </section>
  );
}
