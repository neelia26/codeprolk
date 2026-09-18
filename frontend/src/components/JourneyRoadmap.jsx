import React from 'react';
import { motion } from 'framer-motion';

const journeySteps = [
  {
    title: 'Mathematical Foundations',
    description:
      'Learn linear algebra, calculus, probability, and statistics to build the base for AI and ML thinking.',
  },
  {
    title: 'Programming Fundamentals',
    description:
      'Build strong Python, OOP, clean coding, and problem-solving skills before moving into AI tools.',
  },
  {
    title: 'Version Control',
    description:
      'Use Git and GitHub to manage projects, collaborate, and maintain professional development workflows.',
  },
  {
    title: 'Databases',
    description:
      'Understand SQL, relational design, data storage, and the basics of vector storage for AI systems.',
  },
  {
    title: 'Data Analysis',
    description:
      'Learn how to clean, transform, explore, and visualize data using modern analysis libraries.',
  },
  {
    title: 'Machine Learning',
    description:
      'Study supervised and unsupervised models, training workflows, testing, evaluation, and model improvement.',
  },
  {
    title: 'Deep Learning',
    description:
      'Move into neural networks, CNNs, transformers, and the foundations behind modern AI architectures.',
  },
  {
    title: 'MLOps',
    description:
      'Learn deployment, monitoring, versioning, automation, and production pipelines for real-world ML systems.',
  },
  {
    title: 'Generative AI',
    description:
      'Explore LLMs, RAG, AI agents, prompt workflows, and modern AI-powered applications.',
  },
];

function JourneyRoadmap() {
  return (
    <section id="roadmap" className="roadmap-cs-section">
      <div className="roadmap-soft-orb roadmap-soft-orb-one" aria-hidden="true" />
      <div className="roadmap-soft-orb roadmap-soft-orb-two" aria-hidden="true" />
      <div className="roadmap-soft-wash" aria-hidden="true" />

      <div className="roadmap-cs-inner">
        <motion.div
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="roadmap-cs-header"
        >
          <p className="section-tag">04 / Journey</p>

          <h2>How to Become an AI/ML Engineer?</h2>

          <p>
            A structured roadmap from fundamentals to production-ready AI,
            designed as a premium journey you can follow step by step.
          </p>
        </motion.div>

        <div className="roadmap-cs-timeline">
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
            className="roadmap-cs-line"
            aria-hidden="true"
          />

          <motion.div
            className="roadmap-main-running-ray"
            animate={{
              top: ['-10%', '108%'],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 3.8,
              repeat: Infinity,
              repeatDelay: 0.45,
              ease: 'linear',
            }}
            aria-hidden="true"
          />

          <div className="roadmap-step-list">
            {journeySteps.map((step, index) => {
              const isLeft = index % 2 === 0;

              return (
                <motion.article
                  key={step.title}
                  initial={{
                    opacity: 0,
                    y: 52,
                    x: isLeft ? -26 : 26,
                    filter: 'blur(8px)',
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                    x: 0,
                    filter: 'blur(0px)',
                  }}
                  viewport={{ once: true, amount: 0.24 }}
                  transition={{
                    duration: 0.8,
                    delay: index * 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="roadmap-step-row"
                >
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className={`roadmap-step-card-wrap ${
                      isLeft ? 'roadmap-step-card-left' : 'roadmap-step-card-right'
                    }`}
                  >
                    <div
                      className="roadmap-step-card"
                      style={{
                        '--ray-delay': `${index * 0.28}s`,
                      }}
                    >
                      <span className="roadmap-step-stage">
                        Stage {String(index + 1).padStart(2, '0')}
                      </span>

                      <h3>{step.title}</h3>

                      <p>{step.description}</p>
                    </div>
                  </motion.div>

                  <div className="roadmap-step-node-wrap">
                    <motion.div
                      whileHover={{ scale: 1.12 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="roadmap-step-node"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </motion.div>
                  </div>

                  <div
                    className={`roadmap-step-connector ${
                      isLeft
                        ? 'roadmap-step-connector-left'
                        : 'roadmap-step-connector-right'
                    }`}
                    aria-hidden="true"
                  />
                </motion.article>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{
            duration: 0.75,
            delay: 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="roadmap-cs-button-wrap"
        >
          <a
            href="https://github.com/dineshpiyasamara/ai-ml-engineer-roadmap"
            className="roadmap-cs-button"
          >
            Explore More
          </a>
        </motion.div>
      </div>
    </section>
  );
}

export default JourneyRoadmap;