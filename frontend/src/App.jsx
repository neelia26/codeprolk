import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
} from "react-router-dom";

import About from "./pages/About";
import Terms from "./pages/Terms";
import Disclaimer from "./pages/Disclaimer";
import Privacy from "./pages/Privacy";
import Courses from "./pages/Courses";
import Services from "./pages/Services";
import JourneyRoadmap from "./components/JourneyRoadmap";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import QuizPage from "./pages/Quiz";
import AdminPage from "./pages/Admin";
import Blog from "./pages/Blog";
import AdminBlog from "./pages/AdminBlog";
import Leaderboard from "./pages/Leaderboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./pages/Profile";
import { getToken, getTokenPayload, logout } from "./utils/auth";

import logo from "./assests/logo.png";
import landingImage from "./assests/landing-blue.jpg";
import siriSvg from "./assests/Siri.svg";
import blueSiriIcon from "./assests/blue-siri.webp";

import facebookIcon from "./assests/black-icons/facebook.png";
import linkedinIcon from "./assests/black-icons/linkedin.png";
import whatsappIcon from "./assests/black-icons/whatsapp.png";
import youtubeIcon from "./assests/black-icons/youtube.png";
import tiktokIcon from "./assests/black-icons/tiktok.png";

import softwareDevelopmentImage from "./assests/services/software-development.jpg";
import dataAnalyticsImage from "./assests/services/data-analytics.jpg";

const services = [
  {
    title: "AI/ML Solutions",
    description:
      "We design and deploy advanced AI and ML solutions that enable automation, prediction, and optimization across industries.",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Software Development",
    description:
      "We build robust, user-friendly software products focused on performance, scalability, and intuitive experience.",
    image: softwareDevelopmentImage,
  },
  {
    title: "Algorithmic Design",
    description:
      "We create customized algorithms that address complex problems efficiently with optimal performance.",
    image:
      "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Data Analytics & Insights",
    description:
      "We help organizations uncover trends through data analysis and visualization to support strategic decisions.",
    image: dataAnalyticsImage,
  },
];

function HomePage() {
  const servicesRef = useRef(null);
  const statsRef = useRef(null);

  const [statsStarted, setStatsStarted] = useState(false);

  const [animatedStats, setAnimatedStats] = useState({
    Subscribers: 0,
    Uploads: 0,
    Views: 0,
  });

  const finalStats = [
    { label: "Subscribers", target: 55, suffix: "K+" },
    { label: "Uploads", target: 400, suffix: "+" },
    { label: "Views", target: 5, suffix: "M+" },
  ];

  useEffect(() => {
    const servicesSection = servicesRef.current;

    if (!servicesSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          servicesSection.classList.add("services-swipe-visible");
        }
      },
      {
        threshold: 0.25,
      },
    );

    observer.observe(servicesSection);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const statsSection = statsRef.current;

    if (!statsSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsStarted(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.35,
      },
    );

    observer.observe(statsSection);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!statsStarted) return;

    let animationFrame;
    const duration = 1800;
    const startTime = performance.now();

    const animateNumbers = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedStats({
        Subscribers: Math.round(55 * easedProgress),
        Uploads: Math.round(400 * easedProgress),
        Views: Math.round(5 * easedProgress),
      });

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animateNumbers);
      }
    };

    animationFrame = requestAnimationFrame(animateNumbers);

    return () => cancelAnimationFrame(animationFrame);
  }, [statsStarted]);

  return (
    <>
      <section className="hero">
        <div className="hero-image-bg">
          <img src={landingImage} alt="CODEPRO LK landing visual" />
        </div>

        <div className="hero-copy">
          <p className="eyebrow">CODEPRO LK</p>

          <h1>Next Gen Tech.</h1>

          <p>
            Helping talented individuals reach the international market with
            modern technology, AI-powered services, and future-ready digital
            skills.
          </p>

          <div className="hero-explore">
            <span>Explore</span>
            <a href="#services">Services</a>
            <a href="#roadmap">Roadmap</a>
          </div>
        </div>

        <a
          className="scroll-cue"
          href="#vision"
          aria-label="Scroll to next section"
        >
          ↓
        </a>
      </section>

      <section id="vision" className="section section-dark">
        <div className="section-content">
          <div>
            <p className="section-tag">01 / Vision</p>

            <div className="vision-title-marquee">
              <div className="vision-title-track">
                <h2>Transform Your Vision with Next-Gen Tech</h2>
                <h2 aria-hidden="true">
                  Transform Your Vision with Next-Gen Tech
                </h2>
                <h2 aria-hidden="true">
                  Transform Your Vision with Next-Gen Tech
                </h2>
                <h2 aria-hidden="true">
                  Transform Your Vision with Next-Gen Tech
                </h2>
              </div>
            </div>

            <p>
              CodePRO LK is a technology-driven platform dedicated to empowering
              individuals and businesses through innovative services and
              cutting-edge education.
            </p>

            <p>
              Our platform offers AI-powered services tailored to your needs,
              from automating routine tasks to making data-driven decisions,
              with educational resources that keep you ahead of the curve.
            </p>
          </div>
        </div>
      </section>

      <section className="section section-logo-blue">
        <div className="section-content split">
          <div>
            <p className="section-tag">02 / Automation</p>

            <h2>Boost Your Business with AI-Powered Chatbots!</h2>

            <p>
              Our AI-powered WhatsApp and Telegram chatbots help businesses
              automate interactions, handle customer inquiries instantly, and
              enhance engagement.
            </p>

            <ul>
              <li>24/7 Customer Support</li>
              <li>Instant Replies & Smart Conversations</li>
              <li>Easy Integration & Customization</li>
            </ul>

            <a
              className="button button-light"
              href="https://wa.me/94770874042?text=Hello%20CODEPRO%20LK%2C%20I%20would%20like%20to%20know%20more%20about%20your%20AI-powered%20chatbot%20services."
              target="_blank"
              rel="noreferrer"
            >
              MORE INFO
            </a>
          </div>

          <div className="section-visual">
            <img
              className="siri-svg-visual"
              src={siriSvg}
              alt="Siri-style AI assistant animation"
            />
          </div>
        </div>
      </section>

      <section
        id="services"
        ref={servicesRef}
        className="section services-section services-swipe-section"
      >
        <div className="services-sparkles" aria-hidden="true">
          <span className="sparkle sparkle-1"></span>
          <span className="sparkle sparkle-2"></span>
          <span className="sparkle sparkle-3"></span>
          <span className="sparkle sparkle-4"></span>
          <span className="sparkle sparkle-5"></span>
          <span className="sparkle sparkle-6"></span>
          <span className="sparkle sparkle-7"></span>
          <span className="sparkle sparkle-8"></span>
          <span className="sparkle sparkle-9"></span>
          <span className="sparkle sparkle-10"></span>
        </div>

        <div className="section-header">
          <p className="section-tag">03 / Services</p>

          <h2>Our Services</h2>

          <p>
            We create practical technology solutions for AI, software,
            algorithms, and data-driven business growth.
          </p>
        </div>

        <div className="services-vertical-slider">
          <div className="services-vertical-track">
            {[...services, ...services].map((service, index) => (
              <article
                className="service-card service-slide-card"
                key={`${service.title}-${index}`}
              >
                <img
                  className="service-image"
                  src={service.image}
                  alt={service.title}
                />

                <div className="service-card-content">
                  <h3>{service.title}</h3>

                  <p>{service.description}</p>

                  <a href="https://codeprolk.com/services/">LEARN MORE</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <JourneyRoadmap />

      <section className="section section-final" ref={statsRef}>
        <div className="section-content final-content">
          <div className="social-links-section final-heading-block">
            <h2>About</h2>

            <div className="about-logo-ray" aria-hidden="true">
              <img src={logo} alt="" />
            </div>
          </div>

          <div className="stats-cards">
            {finalStats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <span>
                  {animatedStats[stat.label]}
                  {stat.suffix}
                </span>

                <p>{stat.label}</p>
              </div>
            ))}
          </div>

          <p className="final-connect-text">
            Connect with CODEPRO LK on the platforms below for updates, support,
            and AI insights.
          </p>
        </div>
      </section>
    </>
  );
}

function SiteHeader({ menuOpen, setMenuOpen }) {
  const navigate = useNavigate();
  const token = getToken();
  const isAdmin = getTokenPayload(token)?.role === "admin";
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const loadProfile = async () => {
    if (!token) {
      setProfile(null);
      return;
    }

    try {
      const response = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setProfile(await response.json());
    } catch {
      // Keep navigation usable even if the profile request temporarily fails.
    }
  };

  useEffect(() => {
    loadProfile();
    const refresh = () => loadProfile();
    window.addEventListener("codepro-profile-updated", refresh);
    return () => window.removeEventListener("codepro-profile-updated", refresh);
  }, [token]);

  useEffect(() => {
    const close = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    setMenuOpen(false);
    navigate("/login");
  };

  const initials = (profile?.username || "U").trim().slice(0, 2).toUpperCase();

  return (
    <header className="site-header">
      <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
        <img src={logo} alt="CODEPRO LK logo" className="brand-logo" />
        <span>CODEPRO LK</span>
      </Link>

      <button
        type="button"
        className={`nav-toggle ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen((current) => !current)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
      </button>

      <nav className={`site-nav ${menuOpen ? "open" : ""}`}>
        <NavLink to="/" end onClick={() => setMenuOpen(false)}>HOME</NavLink>
        <NavLink to="/services" onClick={() => setMenuOpen(false)}>SERVICES</NavLink>
        <NavLink to="/blog" onClick={() => setMenuOpen(false)}>BLOG</NavLink>
        <NavLink to="/courses" onClick={() => setMenuOpen(false)}>COURSES</NavLink>
        <NavLink to="/about" onClick={() => setMenuOpen(false)}>ABOUT</NavLink>
        <NavLink to="/contact" onClick={() => setMenuOpen(false)}>CONTACT</NavLink>
        <NavLink className="leaderboard-link" to="/leaderboard" onClick={() => setMenuOpen(false)}>
          LEADERBOARD
        </NavLink>

        {token && (
          <NavLink to="/quiz" onClick={() => setMenuOpen(false)}>QUIZ</NavLink>
        )}

        {isAdmin && (
          <NavLink to="/admin" onClick={() => setMenuOpen(false)}>ADMIN</NavLink>
        )}

        {token ? (
          <div className="profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className="profile-avatar-button"
              onClick={() => setProfileOpen((current) => !current)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
            >
              {initials}
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-user">
                  <span className="profile-dropdown-avatar">{initials}</span>
                  <div>
                    <strong>{profile?.username || "My account"}</strong>
                    <small>{profile?.email || ""}</small>
                  </div>
                </div>

                <NavLink
                  to="/profile"
                  onClick={() => {
                    setProfileOpen(false);
                    setMenuOpen(false);
                  }}
                >
                  My Profile
                </NavLink>

                <button type="button" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <NavLink to="/login" onClick={() => setMenuOpen(false)}>LOGIN</NavLink>
        )}
      </nav>
    </header>
  );
}

function App() {
  const getBotButtonSize = () => {
    if (typeof window === "undefined") return 68;
    return window.innerWidth <= 720 ? 58 : 68;
  };

  const getBotPadding = () => {
    if (typeof window === "undefined") return 56;
    return window.innerWidth <= 720 ? 38 : 64;
  };

  const getInitialBotPosition = () => {
    if (typeof window === "undefined") {
      return { x: 24, y: 24 };
    }

    const buttonSize = getBotButtonSize();
    const padding = getBotPadding();

    return {
      x: Math.max(padding, window.innerWidth - buttonSize - padding),
      y: Math.max(padding, window.innerHeight - buttonSize - padding),
    };
  };

  const [botOpen, setBotOpen] = useState(false);
  const [botLoadError, setBotLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [botFrameLoaded, setBotFrameLoaded] = useState(false);
  const [botPosition, setBotPosition] = useState(getInitialBotPosition);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const botMovedRef = useRef(false);

  const botUrl =
    "https://copilotstudio.microsoft.com/environments/Default-534253fc-dfb6-462f-b5ca-cbe81939f5ee/bots/crad5_WelcometoCODEPROLK/webchat?__version__=2&enableFileAttachment=true";

  useEffect(() => {
    const keepBotInsideViewport = () => {
      if (typeof window === "undefined") return;

      const buttonSize = getBotButtonSize();
      const padding = getBotPadding();

      setBotPosition((current) => ({
        x: Math.min(
          Math.max(padding, current.x),
          window.innerWidth - buttonSize - padding,
        ),
        y: Math.min(
          Math.max(padding, current.y),
          window.innerHeight - buttonSize - padding,
        ),
      }));
    };

    keepBotInsideViewport();

    window.addEventListener("resize", keepBotInsideViewport);
    window.addEventListener("orientationchange", keepBotInsideViewport);

    return () => {
      window.removeEventListener("resize", keepBotInsideViewport);
      window.removeEventListener("orientationchange", keepBotInsideViewport);
    };
  }, []);

  const handleBotPointerDown = (event) => {
    botMovedRef.current = false;

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    dragOffsetRef.current = {
      x: event.clientX - botPosition.x,
      y: event.clientY - botPosition.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBotPointerMove = (event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    const movedDistance =
      Math.abs(event.clientX - dragStartRef.current.x) +
      Math.abs(event.clientY - dragStartRef.current.y);

    if (movedDistance > 6) {
      botMovedRef.current = true;
    }

    const buttonSize = getBotButtonSize();
    const padding = getBotPadding();

    const nextX = event.clientX - dragOffsetRef.current.x;
    const nextY = event.clientY - dragOffsetRef.current.y;

    setBotPosition({
      x: Math.min(
        Math.max(padding, nextX),
        window.innerWidth - buttonSize - padding,
      ),
      y: Math.min(
        Math.max(padding, nextY),
        window.innerHeight - buttonSize - padding,
      ),
    });
  };

  const handleBotPointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleBotPointerCancel = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleBotClick = () => {
    if (botMovedRef.current) {
      botMovedRef.current = false;
      return;
    }

    setBotOpen(true);
  };

  const handleBotClose = () => {
    setBotOpen(false);
  };

  return (
    <Router>
      <div className="page-shell">
        <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        <main className="site-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/services" element={<Services />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz"
              element={
                <ProtectedRoute>
                  <QuizPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <>
                  <AdminBlog />
                  <AdminPage />
                  </>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>

        <footer className="site-footer">
          <p className="footer-copy">Copyright © 2026 - CODEPRO LK</p>

          <nav
            className="footer-legal-links"
            aria-label="CODEPRO LK legal links"
          >
            <Link to="/terms">Terms</Link>
            <Link to="/disclaimer">Disclaimer</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>

          <nav
            className="footer-social-links"
            aria-label="CODEPRO LK social media links"
          >
            <a
              href="https://www.youtube.com/@codeprolk"
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube"
            >
              <img src={youtubeIcon} alt="YouTube" />
            </a>

            <a
              href="https://wa.me/94770874042"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
            >
              <img src={whatsappIcon} alt="WhatsApp" />
            </a>

            <a
              href="https://web.facebook.com/codeprolkofficial"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <img src={facebookIcon} alt="Facebook" />
            </a>

            <a
              href="https://www.tiktok.com/@codeprolk"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
            >
              <img src={tiktokIcon} alt="TikTok" />
            </a>

            <a
              href="https://www.linkedin.com/company/codepro-lk/posts/?feedView=all"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
            >
              <img src={linkedinIcon} alt="LinkedIn" />
            </a>
          </nav>
        </footer>

        {!botOpen && (
          <button
            type="button"
            className="bot-toggle-button"
            style={{
              left: `${botPosition.x}px`,
              top: `${botPosition.y}px`,
            }}
            onClick={handleBotClick}
            onPointerDown={handleBotPointerDown}
            onPointerMove={handleBotPointerMove}
            onPointerUp={handleBotPointerUp}
            onPointerCancel={handleBotPointerCancel}
            aria-label="Open chat"
          >
            <img src={blueSiriIcon} alt="" className="bot-icon-image" />
          </button>
        )}

        <div
          className={`bot-widget ${botOpen ? "bot-widget-open" : "bot-widget-hidden"}`}
        >
          <button
            type="button"
            className="bot-close-button"
            onClick={handleBotClose}
            aria-label="Close chat"
          >
            ✕
          </button>

          {!botFrameLoaded && !botLoadError && (
            <div className="bot-loading-state">
              <div className="bot-loading-orb" aria-hidden="true" />
              <p>Loading CODEPRO LK AI Bot...</p>
            </div>
          )}

          {botLoadError ? (
            <div className="bot-error-state">
              <p>Unable to load chat widget inside the page.</p>

              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-primary"
              >
                Open chat in new tab
              </a>
            </div>
          ) : (
            <iframe
              title="CodePRO LK AI Bot"
              src={botUrl}
              frameBorder="0"
              loading="eager"
              allow="microphone; camera; clipboard-read; clipboard-write; autoplay; encrypted-media"
              onLoad={() => setBotFrameLoaded(true)}
              onError={() => setBotLoadError(true)}
            />
          )}
        </div>
      </div>
    </Router>
  );
}

export default App;
