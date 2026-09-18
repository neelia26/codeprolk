import React from 'react';

const privacyItems = [
  {
    number: '01',
    title: 'Your Privacy Matters',
    body:
      'We respect your privacy and are committed to protecting the personal information you share with us. Any data collected through this website is used to improve your experience and provide the services you request.',
  },
  {
    number: '02',
    title: 'Secure Data Handling',
    body:
      'We do not sell your personal information to third parties. Any information collected is handled securely and in accordance with applicable privacy laws.',
  },
];

const trustItems = [
  'No data selling',
  'Secure handling',
  'Clear purpose',
  'Responsible use',
];

function Privacy() {
  return (
    <section className="privacy-page">
      <div className="privacy-bg-grid" aria-hidden="true" />
      <div className="privacy-bg-scan" aria-hidden="true" />
      <div className="privacy-bg-orb privacy-bg-orb-one" aria-hidden="true" />
      <div className="privacy-bg-orb privacy-bg-orb-two" aria-hidden="true" />

      <div className="privacy-inner">
        <header className="privacy-vault-hero">
          <div className="privacy-vault-copy">
            <p className="privacy-tag">CODEPRO LK / PRIVACY</p>

            <h1>Privacy Policy</h1>

            <p>
              Your trust is important to us. This page explains how CODEPRO LK
              treats personal information, protects user data, and handles
              information shared through our website.
            </p>
          </div>

          <div className="privacy-vault-visual" aria-hidden="true">
            <div className="privacy-orbit privacy-orbit-one" />
            <div className="privacy-orbit privacy-orbit-two" />

            <div className="privacy-lock-core">
              <span>✓</span>
            </div>

            <div className="privacy-mini-node privacy-mini-node-one" />
            <div className="privacy-mini-node privacy-mini-node-two" />
            <div className="privacy-mini-node privacy-mini-node-three" />
          </div>
        </header>

        <section className="privacy-trust-strip" aria-label="Privacy trust points">
          {trustItems.map((item, index) => (
            <div className="privacy-trust-pill" key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{item}</p>
            </div>
          ))}
        </section>

        <section className="privacy-console">
          <div className="privacy-console-topbar">
            <div className="privacy-console-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <p>privacy_policy.config</p>
          </div>

          <div className="privacy-console-body">
            <aside className="privacy-console-sidebar">
              <p className="privacy-sidebar-label">Policy Index</p>

              <nav className="privacy-index-links" aria-label="Privacy policy index">
                {privacyItems.map((item) => (
                  <a href={`#privacy-${item.number}`} key={item.number}>
                    <span>{item.number}</span>
                    {item.title}
                  </a>
                ))}
              </nav>

              <div className="privacy-data-note">
                <span>Data Care</span>

                <p>
                  Simple, secure, and respectful handling of information shared
                  through our website.
                </p>
              </div>
            </aside>

            <div className="privacy-policy-stack">
              {privacyItems.map((item) => (
                <article
                  className="privacy-policy-card"
                  id={`privacy-${item.number}`}
                  key={item.number}
                >
                  <div className="privacy-policy-number">{item.number}</div>

                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="privacy-commitment-panel">
          <div>
            <p className="privacy-tag">OUR COMMITMENT</p>

            <h2>We do not sell your personal information.</h2>

            <p>
              Any information collected is treated responsibly and used only for
              improving your experience or providing the services you request.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

export default Privacy;