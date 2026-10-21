/** The About page (formerly "Portfolio"; the dictionary keeps its original name). */
export const portfolio = {
  meta: {
    title: "About Margith",
    description:
      "Founded by an IIM Kozhikode alumnus, Margith helps students, graduates and professionals make informed decisions about their education and careers.",
  },
  title: "About Margith",
  tagline: "Helping You Find Your Direction",
  intro: [
    "Founded by an IIM Kozhikode alumnus, Margith is a career and education consulting platform dedicated to helping students, graduates, and professionals make informed decisions about their future.",
    "We believe that choosing the right path starts with understanding yourself, exploring your options, and having a clear plan to move forward.",
  ],
  story: {
    heading: "Our Story",
    paragraphs: [
      "Career and education decisions can be overwhelming. Choosing the right field, evaluating higher education opportunities, identifying relevant skills, and planning professional growth all require careful thought.",
      "Margith was created to make these decisions clearer through structured guidance, thoughtful exploration, and practical recommendations tailored to individual needs.",
    ],
  },
  mission: {
    heading: "Our Mission",
    body: "To make career and education decisions clearer, more informed, and more actionable.",
  },
  vision: {
    heading: "Our Vision",
    body: "To help individuals discover opportunities aligned with their strengths, interests, and ambitions, enabling them to build fulfilling professional futures.",
  },
  whatWeDo: {
    heading: "What We Do",
    /** Rendered in order with the icons in the About page. */
    items: [
      { title: "Career Planning", body: "Explore suitable career paths and develop a clear direction." },
      { title: "Education Guidance", body: "Evaluate courses, specializations, and higher education options." },
      { title: "Skills Development", body: "Identify relevant skills and opportunities for professional growth." },
      { title: "Professional Readiness", body: "Improve resumes, professional profiles, and job-search strategies." },
    ],
  },
  approach: {
    heading: "Our Approach",
    steps: ["Understand", "Explore", "Plan", "Progress"],
    body: "We begin by understanding your goals and circumstances, explore realistic options together, and identify practical steps to help you move forward with confidence.",
  },
  commitment: {
    heading: "Our Commitment",
    body: "Founded on the principles of clarity, integrity, and thoughtful guidance, Margith aims to empower individuals to make better-informed decisions about their education and careers.",
  },
  cta: {
    heading: "Your Next Step Starts Here",
    body: "Whether you are exploring career options, considering higher education, or planning your next professional move, Margith is here to help you navigate your choices.",
    book: "Book a Consultation",
  },
};

export type PortfolioDict = typeof portfolio;
