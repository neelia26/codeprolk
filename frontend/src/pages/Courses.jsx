import React from 'react';

const courses = [
  {
    number: '01',
    type: 'Sinhala Medium / Beginner Friendly',
    title: 'Python for Everyone (Sinhala Medium) | Udemy',
    description:
      'Python is currently a very popular programming language that can be used in any field. This course is fully designed to be easy for anyone to understand and to get started. Additionally, essential concepts in programming, such as Object-Oriented Programming, Multi-threading, and Error Handling, are available here for free learning. After this, you’ll be able to study a relevant Python framework and enter any field of your choice.',
    link: 'https://www.udemy.com/course/python-for-everyone-sinhala-medium',
  },
  {
    number: '02',
    type: 'Generative AI / Practical Applications',
    title: 'Advanced Generative AI | Loku බිස්නස්',
    description:
      'This Generative AI Course can be described as a practically oriented program. It provides a comprehensive understanding of creating various applications using Large Language Models and Vision Models. The course is primarily organized to guide you in building complete GenAI applications using different libraries and frameworks. It also covers how the state of art AI models for text, image, audio, and video generation work and how you can utilize them to streamline your tasks.',
    link: 'https://school.lokubusiness.lk/p/advanced-generative-ai1',
  },
];

function Courses() {
  return (
    <section className="courses-page">
      <div className="courses-page-grid" aria-hidden="true" />
      <div className="courses-page-orb courses-page-orb-one" aria-hidden="true" />
      <div className="courses-page-orb courses-page-orb-two" aria-hidden="true" />
      <div className="courses-page-orb courses-page-orb-three" aria-hidden="true" />

      <div className="courses-page-inner">
        <header className="courses-page-header">
          <p className="courses-page-tag">CODEPRO LK / COURSES</p>

          <h1>Learn Future-Ready Skills</h1>

          <p>
            Explore practical courses designed to help you build strong
            programming knowledge, AI skills, and real-world technology
            confidence.
          </p>
        </header>

        <div className="courses-learning-path">
          <div className="courses-path-line" aria-hidden="true" />

          {courses.map((course) => (
            <article className="courses-page-card" key={course.title}>
              <div className="courses-page-big-number" aria-hidden="true">
                {course.number}
              </div>

              <div className="courses-page-card-top">
                <span className="courses-page-number">{course.number}</span>
                <span className="courses-page-type">{course.type}</span>
              </div>

              <div className="courses-page-card-content">
                <h2>{course.title}</h2>

                <p>{course.description}</p>

                <a
                  className="courses-page-btn"
                  href={course.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Enroll Now
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Courses;