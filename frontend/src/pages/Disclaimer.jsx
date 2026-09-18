import React from 'react';

const disclaimerPoints = [
  {
    number: '01',
    title: 'General Information',
    body:
      'The information provided on CodePRO LK is for general informational purposes only. We strive for accuracy, but we do not guarantee that all content is complete, current, or error-free.',
  },
  {
    number: '02',
    title: 'Use at Your Own Risk',
    body:
      'Any reliance you place on the information on this website is strictly at your own risk. CodePRO LK is not responsible for any losses or damages arising from your use of the website or its services.',
  },
];

function Disclaimer() {
  return (
    <section className="disclaimer-page">
      <div className="disclaimer-bg" aria-hidden="true" />

      <div className="disclaimer-inner">
        <header className="disclaimer-header">
          <p className="disclaimer-tag">CODEPRO LK / LEGAL NOTICE</p>

          <h1>Disclaimer</h1>

          <p className="disclaimer-intro">
            Please read this notice carefully before relying on any information,
            content, service details, or guidance provided through CODEPRO LK.
          </p>
        </header>

        <div className="disclaimer-card-list">
          {disclaimerPoints.map((point) => (
            <article className="disclaimer-card" key={point.number}>
              <div className="disclaimer-card-number">{point.number}</div>

              <div className="disclaimer-card-content">
                <h2>{point.title}</h2>
                <p>{point.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="disclaimer-bottom-note">
          <span aria-hidden="true">!</span>

          <p>
            By using this website, you acknowledge that you understand this
            disclaimer and accept the conditions described above.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Disclaimer;