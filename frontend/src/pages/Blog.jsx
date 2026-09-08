import React, { useEffect, useState } from "react";

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

export default function Blog() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ posts: [], total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/blog/posts?page=${page}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Unable to load posts. Please refresh to try again.");
        return r.json();
      })
      .then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);
  return (
    <section className="cp-blog">
      <div className="cp-blog-inner">
        <header className="cp-blog-heading">
          <p className="cp-blog-tag">CODEPRO LK / BLOG</p>
          <h1>Ideas worth sharing.</h1>
          <p>Fresh perspectives on AI, technology, and learning.</p>
        </header>
        {loading ? <p role="status">Loading posts…</p> : error ? (
          <p role="alert">{error}</p>
        ) : !data.posts.length ? (
          <div className="cp-blog-empty">Our first post is on its way. Check back soon.</div>
        ) : (
          <>
            <div className="cp-blog-feed">
              {data.posts.map((post, index) => (
                <article className="cp-blog-post" key={post.id}>
                  <div className="cp-blog-art">
                    <img src={post.image_url} alt={captionParts(post.caption).heading}
                      loading={index === 0 ? "eager" : "lazy"} />
                  </div>
                  <div className="cp-blog-copy">
                    <div className="cp-blog-meta">
                      {page === 1 && index === 0 && <span>Latest post</span>}
                      <time dateTime={post.created_at}>
                        {new Date(post.created_at).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </time>
                    </div>
                    <h2>{captionParts(post.caption).heading}</h2>
                    <p className="cp-blog-caption"><CaptionText text={captionParts(post.caption).body} /></p>
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
    </section>
  );
}
