import React from 'react';

const termsSections = [
  {
    number: '01',
    title: 'Interpretation and Definitions',
    body:
      'The words with initial capital letters have meanings defined under the following conditions. The definitions apply whether they appear in singular or plural.',
  },
  {
    number: '02',
    title: 'Acknowledgment',
    body:
      'These Terms and Conditions govern your use of this Service and form the agreement between you and the Company. By accessing or using the Service you agree to be bound by these Terms. If you disagree, you may not use the Service.',
  },
  {
    number: '03',
    title: 'Links to Other Websites',
    body:
      'Our Service may contain links to third-party websites. We are not responsible for their content, privacy policies, or practices. We recommend reviewing the terms and policies of any third-party sites you visit.',
  },
  {
    number: '04',
    title: 'Termination',
    body:
      'We may suspend or terminate your access immediately for any reason, including breach of these Terms. Upon termination, your right to use the Service ends.',
  },
  {
    number: '05',
    title: 'Limitation of Liability',
    body:
      'To the maximum extent permitted by law, the Company and its suppliers will not be liable for special, incidental, indirect, or consequential damages arising from the use of the Service.',
  },
  {
    number: '06',
    title: '"As Is" and "As Available"',
    body:
      'The Service is provided "AS IS" without warranties of any kind. The Company makes no representation that the Service will meet your requirements or be uninterrupted, error-free, or secure.',
  },
  {
    number: '07',
    title: 'Governing Law',
    body:
      'The laws of Sri Lanka govern these Terms, excluding conflict of law rules.',
  },
  {
    number: '08',
    title: 'Changes to These Terms',
    body:
      "We may modify these Terms at our discretion. If changes are material, we will provide at least 30 days' notice where reasonable. Continued use after changes indicates acceptance.",
  },
  {
    number: '09',
    title: 'Contact Us',
    body:
      'For questions regarding these Terms, contact us via the social media accounts visible in the footer below.',
  },
];

function Terms() {
  return (
    <section className="terms-page">
      <div className="terms-page-grid" aria-hidden="true" />
      <div className="terms-page-glow terms-page-glow-one" aria-hidden="true" />
      <div className="terms-page-glow terms-page-glow-two" aria-hidden="true" />

      <div className="terms-page-inner">
        <header className="terms-hero">
          <div className="terms-hero-copy">
            <p className="terms-page-tag">CODEPRO LK / LEGAL</p>

            <h1>Terms and Conditions</h1>

            <p>
              Please read these Terms and Conditions carefully before using our
              service. These terms explain the rules, responsibilities, and
              conditions that apply when accessing CODEPRO LK.
            </p>
          </div>

          <div className="terms-date-card">
            <span>Last Updated</span>
            <strong>August 18, 2025</strong>
            <p>
              These terms may be updated from time to time. Continued use of the
              service means you accept the latest version.
            </p>
          </div>
        </header>

        <div className="terms-layout">
          <aside className="terms-index" aria-label="Terms page index">
            <p>Document Index</p>

            <div className="terms-index-list">
              {termsSections.map((section) => (
                <a href={`#terms-${section.number}`} key={section.number}>
                  <span>{section.number}</span>
                  {section.title}
                </a>
              ))}
            </div>
          </aside>

          <div className="terms-document">
            {termsSections.map((section) => (
              <article
                className="terms-document-card"
                id={`terms-${section.number}`}
                key={section.number}
              >
                <div className="terms-document-number">{section.number}</div>

                <div>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Terms;