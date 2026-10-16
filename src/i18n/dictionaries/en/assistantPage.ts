export const assistantPage = {
  meta: {
    title: "AI career guidance assistant",
    description: "Explore career paths, skills and next steps with an optional AI assistant.",
  },
  badge: "Optional · Free for registered users",
  title: "AI career guidance assistant",
  intro:
    "A conversational assistant that helps you think through your career and study options before (or instead of) booking a consultation.",
  points: [
    { title: "Explore paths", body: "Talk through your interests, skills and constraints to discover options worth exploring." },
    { title: "Reflect", body: "Get questions for self-reflection and skills that may be useful for the paths you're considering." },
    { title: "Plan next steps", body: "Leave with a suggested learning plan and concrete next steps." },
    { title: "Private by design", body: "Your conversation is private to your account and you can clear it at any time." },
  ],
  noteTitle: "Please keep in mind",
  noteBody:
    "The assistant's suggestions are exploratory, not a definitive assessment. It cannot guarantee jobs, salaries or admissions, and it does not replace a conversation with a person. Always verify course details, fees and requirements with official sources.",
  start: "Start a conversation",
  book: "Book a human consultation",
};

export type AssistantPageDict = typeof assistantPage;
