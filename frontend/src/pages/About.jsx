import React from 'react';

const offers = [
  'AI/ML Solutions — custom models and automation pipelines.',
  'Software Development — performant, scalable applications.',
  'Algorithmic Design — optimized solutions for complex problems.',
  'Data Analytics & Insights — actionable intelligence for decision making.',
];

function About() {
  return (
    <section className="about-page">
      <div className="about-page-grid" aria-hidden="true" />
      <div className="about-page-orb about-page-orb-one" aria-hidden="true" />
      <div className="about-page-orb about-page-orb-two" aria-hidden="true" />

      <div className="about-page-inner">
        <header className="about-hero">
          <div className="about-hero-copy">
            <p className="about-page-tag">CODEPRO LK / ABOUT US</p>

            <h1>Building Skills, Systems, and Future-Ready Technology</h1>

            <p>
              CodePRO LK is a technology-driven platform dedicated to empowering individuals
              and businesses through innovative services and cutting-edge education. In today’s
              AI-driven world, every industry is leveraging the power of artificial intelligence
              to revolutionize operations and enhance capabilities. We at CodePRO LK are
              committed to keeping you ahead of the curve.
            </p>
          </div>

          <div className="about-hero-panel">
            <span className="about-focus-label">Our Focus</span>

            <h2>Technology with practical impact.</h2>

            <p>
              We combine education, AI-powered services, software engineering,
              algorithmic thinking, and data insights to help people and businesses
              move confidently into the digital future.
            </p>
          </div>
        </header>

        <div className="about-story-layout">
          <aside className="about-story-label">
            <span>01</span>
            <p>Mission</p>
          </aside>

          <article className="about-story-card about-mission-card">
            <h2>Our Mission</h2>

            <p>
              Helping talented individuals to reach the international market with a
              strong technological background. We offer a comprehensive suite of
              AI-powered services tailored to specific needs, from automating routine
              tasks to making data-driven decisions, alongside educational resources
              that enable practitioners to acquire the skills necessary to thrive.
            </p>
          </article>
        </div>

        <div className="about-story-layout about-offer-layout">
          <aside className="about-story-label">
            <span>02</span>
            <p>What We Offer</p>
          </aside>

          <article className="about-story-card">
            <div className="about-section-heading">
              <h2>What We Offer</h2>

              <p>
                Our work is focused on helping learners, creators, and businesses
                use technology in a practical and meaningful way.
              </p>
            </div>

            <div className="about-offer-grid">
              {offers.map((offer, index) => (
                <div className="about-offer-card" key={offer}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{offer}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="about-contact-panel">
          <div>
            <p className="about-page-tag">CONTACT</p>

            <h2>Let’s build something meaningful together.</h2>

            <p>
              For inquiries, collaborations or hiring, reach us at{' '}
              <strong>info@codeprolk.com</strong>.
            </p>
          </div>

          <a className="about-contact-button" href="mailto:info@codeprolk.com">
            Email Us
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export default About;