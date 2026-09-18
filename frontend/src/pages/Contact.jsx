import React from 'react';

import facebookIcon from '../assests/black-icons/facebook.png';
import linkedinIcon from '../assests/black-icons/linkedin.png';
import whatsappIcon from '../assests/black-icons/whatsapp.png';
import youtubeIcon from '../assests/black-icons/youtube.png';
import tiktokIcon from '../assests/black-icons/tiktok.png';

const emailLink = 'mailto:info@codeprolk.com';

const whatsappLink =
  'https://wa.me/94770874042?text=Hello%20CODEPRO%20LK%2C%20I%20would%20like%20to%20contact%20you.';

const socialLinks = [
  {
    name: 'YouTube',
    icon: youtubeIcon,
    url: 'https://www.youtube.com/@codeprolk',
  },
  {
    name: 'WhatsApp',
    icon: whatsappIcon,
    url: whatsappLink,
  },
  {
    name: 'Facebook',
    icon: facebookIcon,
    url: 'https://web.facebook.com/codeprolkofficial',
  },
  {
    name: 'TikTok',
    icon: tiktokIcon,
    url: 'https://www.tiktok.com/@codeprolk',
  },
  {
    name: 'LinkedIn',
    icon: linkedinIcon,
    url: 'https://www.linkedin.com/company/codepro-lk/posts/?feedView=all',
  },
];

function Contact() {
  return (
    <section className="contact-page contact-page-social-hub">
      <div className="contact-hub-grid" aria-hidden="true" />
      <div className="contact-hub-glow contact-hub-glow-one" aria-hidden="true" />
      <div className="contact-hub-glow contact-hub-glow-two" aria-hidden="true" />

      <div className="contact-hub-inner">
        <header className="contact-hub-hero">
          <p className="contact-hub-tag">CODEPRO LK / CONTACT US</p>

          <h1>Connect With Us</h1>

          <p>
            Reach CODEPRO LK through our official channels for AI/ML services,
            software development, courses, collaborations, and business inquiries.
          </p>

          <div className="contact-hub-actions">
            <a
              className="contact-hub-main-button"
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp Us
              <span aria-hidden="true">→</span>
            </a>

            <a className="contact-hub-outline-button" href={emailLink}>
              Email Us
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </header>

        <div className="contact-hub-social-stage">
          <p className="contact-hub-social-label">Choose your preferred platform</p>

          <div className="contact-hub-social-grid">
            {socialLinks.map((social, index) => (
              <a
                className="contact-hub-social-button"
                href={social.url}
                target="_blank"
                rel="noreferrer"
                key={social.name}
                style={{ '--social-delay': `${index * 0.12}s` }}
              >
                <span className="contact-hub-social-icon">
                  <img src={social.icon} alt={social.name} />
                </span>

                <span className="contact-hub-social-name">{social.name}</span>

                <span className="contact-hub-social-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>

        <footer className="contact-hub-final-text">
          <p>Tell us what you want to build!</p>
        </footer>
      </div>
    </section>
  );
}

export default Contact;