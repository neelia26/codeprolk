import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getToken } from "../utils/auth";

export default function AdminBlog() {
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef(null);
  const locked = useRef(false);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(event) {
    setError("");
    setMessage("");

    const chosen = event.target.files?.[0];

    if (!chosen) {
      setFile(null);
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(chosen.type) ||
      chosen.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG or WebP image up to 5 MB.");
      event.target.value = "";
      setFile(null);
      return;
    }

    setFile(chosen);
  }

  async function publish(event) {
    event.preventDefault();

    if (locked.current || !file) return;

    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Unable to read this image."));
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/admin/blog/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caption: caption.trim(),
          image_base64: encoded,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Publishing failed. Check the Blog page before retrying.",
        );
      }

      setCaption("");
      setFile(null);

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      setMessage("Published! Your post is now first on the Blog page.");
    } catch (e) {
      setError(
        e.message ||
          "Could not confirm publication. Check the Blog page before retrying.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="cp-blog-publisher">
      <header>
        <p className="cp-blog-tag">CODEPRO LK / PUBLISH</p>
        <h2>Share a new post</h2>
        <p>Add your image and caption. The first line becomes the post heading.</p>
        <Link to="/blog">View Blog →</Link>
      </header>

      <form onSubmit={publish}>
        <fieldset disabled={busy}>
          <label htmlFor="blog-image">Post image</label>
          <input
            id="blog-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            ref={fileInput}
            onChange={choose}
            required
            aria-describedby="blog-image-help"
          />
          <small id="blog-image-help">PNG, JPEG or WebP · Up to 5 MB</small>

          <label htmlFor="blog-caption">Caption</label>
          <textarea
            id="blog-caption"
            value={caption}
            rows={9}
            maxLength={12000}
            required
            onChange={(e) => setCaption(e.target.value)}
          />
          <small>
            The first non-empty line is your heading. Put the rest of your caption underneath it.
          </small>

          {preview && (
            <figure className="cp-blog-preview">
              <img src={preview} alt="Selected post preview" />
              <figcaption>Image preview</figcaption>
            </figure>
          )}

          <button type="submit" disabled={busy || !file}>
            {busy ? "Publishing…" : "Publish post"}
          </button>
        </fieldset>
      </form>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
