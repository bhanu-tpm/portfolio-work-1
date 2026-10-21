export const home = {
  hero: {
    /** Text before and after the rotating word; words carry any possessive the language needs. */
    headlineBefore: "You don't have to figure out your",
    headlineAfter: "alone.",
    headlineWords: ["future", "career", "degree", "next step"],
    headlineSr: "You don't have to figure out your future alone.",
    checks: ["One-to-one sessions", "A written action plan", "Online, when it suits you"],
    book: "Book a consultation",
    portfolio: "About us",
  },
  collage: {
    badge: "Clarity, step by step",
    preparing: "Preparing your plan…",
    ready: "Your plan is ready",
    from: "from {site}",
    conversation: [
      { question: "Which course is right for me?", answer: "Let's map out your options together." },
      { question: "Is it too late to switch careers?", answer: "Not at all — let's plan the move step by step." },
      { question: "Does my resume stand out?", answer: "We'll make your strengths impossible to miss." },
      { question: "Should I do an MBA now?", answer: "Let's weigh it against your goals first." },
    ],
  },
  questions: {
    title: "Bring me questions like…",
    intro: "Swipe through a few of the questions people often bring — and how we would tackle them together.",
    region: "Questions I help with",
    explore: "Explore this",
    previous: "Previous question",
    next: "Next question",
    goTo: "Go to question {n}",
    pause: "Pause carousel",
    play: "Play carousel",
    slide: "{n} of {total}",
    items: [
      { question: "Which degree should I choose?", answer: "We weigh your options against your interests, strengths and goals." },
      { question: "Is it too late to switch careers?", answer: "Rarely. We map your transferable skills and plan the move step by step." },
      { question: "Does my resume stand out?", answer: "We sharpen how you present your experience — honestly and clearly." },
      { question: "How do I land my first job?", answer: "A focused search plan: target roles, applications and preparation." },
      { question: "Which skills should I learn next?", answer: "A learning roadmap built around the role you're aiming for." },
      { question: "Should I study abroad?", answer: "We look at costs, outcomes and fit — then decide with clear eyes." },
      { question: "MBA now, or work first?", answer: "We test the timing against your goals, finances and experience." },
      { question: "Returning after a career break?", answer: "We rebuild confidence and a plan to re-enter at the right level." },
    ],
  },
  audience: {
    eyebrow: "Who I help",
    title: "Wherever you are on the journey",
    badge: "0{n} · Who I help",
    items: [
      {
        title: "Students",
        body: "Choosing subjects, degrees or specialisations — and wondering where each path leads.",
        questions: ["Which degree suits me?", "Is this specialisation right?", "How do I plan the next few years?"],
        cta: "Guidance for students",
      },
      {
        title: "Recent graduates",
        body: "Turning a degree into a first job, or deciding whether further study is worth it.",
        questions: ["How do I land my first job?", "Should I study further?", "How do I stand out?"],
        cta: "Guidance for graduates",
      },
      {
        title: "Early-career professionals",
        body: "Feeling stuck, thinking about a change, or planning the skills for your next step.",
        questions: ["Is it time for a change?", "What should I learn next?", "How do I move up or across?"],
        cta: "Guidance for professionals",
      },
    ],
  },
  services: {
    eyebrow: "Consultations",
    title: "How I can help",
    seeAll: "See all services",
    empty: "Services will appear here once they are configured.",
    tablist: "Consultation services",
    included: "What's included",
    writtenPlan: "Written action plan",
    asked: "You'll be asked",
    request: "Request this consultation",
    learnMore: "Learn more",
  },
  steps: {
    eyebrow: "How it works",
    title: "Three friendly steps",
    items: [
      { title: "Tell me your story", body: "Share where you are, what you're unsure about and what you hope to achieve." },
      { title: "Let's talk it through", body: "A relaxed one-to-one conversation, online, at a time that suits you." },
      { title: "Leave with a plan", body: "A written, personalised action plan with clear next steps you can follow." },
    ],
  },
  /** Heading, tagline and intro come from the About page text (t.portfolio). */
  about: {
    approachLine: "Understand. Explore. Plan. Progress.",
    more: "More about us",
  },
  assistant: {
    badge: "Free · optional",
    title: "Not sure where to start?",
    body: "Chat with the AI guidance assistant to explore your interests and options first. It's a friendly starting point — and you can always book a real conversation afterwards.",
    cta: "Try the assistant",
  },
  blog: {
    eyebrow: "From the blog",
    title: "Ideas and advice",
    all: "All articles",
  },
  final: {
    title: "Let's find your next step, together.",
    body: "Tell me where you are and where you'd like to be. I'll help you work out the path in between.",
    book: "Book a consultation",
    ask: "Ask a question first",
  },
};

export type HomeDict = typeof home;
