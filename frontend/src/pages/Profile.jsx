import React, { useEffect, useState } from "react";
import { getToken } from "../utils/auth";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const headers = {
    Authorization: `Bearer ${getToken()}`,
  };

  const loadProfile = async () => {
    const response = await fetch("/api/profile", { headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setProfileMessage(data?.detail || "Unable to load your profile.");
      return;
    }

    setProfile(data);
    setUsername(data.username || "");
    setWhatsapp(data.whatsapp_number || "");
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    setProfileMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          whatsapp_number: whatsapp.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setProfileMessage(data?.detail || "Unable to save your profile.");
        return;
      }

      setProfile(data);
      setUsername(data.username);
      setWhatsapp(data.whatsapp_number || "");
      setProfileMessage("Profile updated successfully.");
      window.dispatchEvent(new Event("codepro-profile-updated"));
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setPasswordMessage(data?.detail || "Unable to change your password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed successfully.");
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <section className="profile-page">
        <div className="profile-shell">
          <p>{profileMessage || "Loading your profile…"}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <div className="profile-shell">
        <header className="profile-heading">
          <p className="profile-eyebrow">CODEPRO LK / ACCOUNT</p>
          <h1>My Profile</h1>
          <p>Keep your account details up to date.</p>
        </header>

        <div className="profile-grid">
          <article className="profile-card">
            <div className="profile-card-heading">
              <div className="profile-large-avatar" aria-hidden="true">
                {(profile.username || "U").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2>Profile details</h2>
                <p>{profile.email}</p>
              </div>
            </div>

            <form className="profile-form" onSubmit={saveProfile}>
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                value={username}
                minLength={3}
                maxLength={50}
                onChange={(event) => setUsername(event.target.value)}
                required
              />

              <label htmlFor="profile-email">Email address</label>
              <input
                id="profile-email"
                value={profile.email}
                disabled
                readOnly
              />
              <small>Email changes are currently disabled for account safety.</small>

              <label htmlFor="profile-whatsapp">WhatsApp number</label>
              <input
                id="profile-whatsapp"
                value={whatsapp}
                minLength={7}
                maxLength={20}
                onChange={(event) => setWhatsapp(event.target.value)}
                required
              />

              <button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </button>
              {profileMessage && <p className="profile-message">{profileMessage}</p>}
            </form>
          </article>

          <article className={`profile-card profile-security-card ${passwordOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="profile-security-toggle"
              onClick={() => {
                setPasswordOpen((current) => !current);
                setPasswordMessage("");
              }}
              aria-expanded={passwordOpen}
            >
              <span className="profile-security-icon" aria-hidden="true">✦</span>
              <span className="profile-security-copy">
                <small>ACCOUNT SECURITY</small>
                <strong>Change password</strong>
                <span>Update your password whenever you need to.</span>
              </span>
              <span className="profile-security-arrow" aria-hidden="true">
                {passwordOpen ? "−" : "+"}
              </span>
            </button>

            {passwordOpen && (
              <div className="profile-security-panel">
                <form className="profile-form" onSubmit={changePassword}>
                  <label htmlFor="current-password">Current password</label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />

                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />

                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />

                  <button type="submit" disabled={busy}>
                    {busy ? "Updating…" : "Update password"}
                  </button>
                  {passwordMessage && (
                    <p className="profile-message">{passwordMessage}</p>
                  )}
                </form>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
