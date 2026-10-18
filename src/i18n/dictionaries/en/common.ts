export const common = {
  nav: {
    home: "Home",
    services: "Services",
    portfolio: "Portfolio",
    blog: "Blog",
    aiGuidance: "AI guidance",
    contact: "Contact",
    privacy: "Privacy",
    disclaimer: "Disclaimer",
  },
  header: {
    signIn: "Sign in",
    dashboard: "Dashboard",
    admin: "Admin",
    book: "Book a consultation",
    menu: "Menu",
    openMenu: "Open menu",
    mainNav: "Main",
    mobileNav: "Mobile",
    skipToContent: "Skip to content",
    language: "Language",
    switchTo: "Switch to {language}",
  },
  /** Brand tagline, shown in the footer and the default page title. */
  tagline: "Your Path. Your Potential.",
  footer: {
    nav: "Footer",
    sayHello: "Say hello",
    rights: "© {site}. Guidance offered is advisory; decisions remain yours.",
  },
  meta: {
    title: "{site} — Your Path. Your Potential.",
    description: "Personal career and education consultations for students, graduates and early-career professionals.",
  },
  notFound: {
    title: "Page not found",
    body: "The page you're looking for doesn't exist or you don't have access to it.",
    home: "Go home",
    dashboard: "Your dashboard",
  },
  error: {
    title: "Something went wrong",
    body: "The page couldn't be loaded. Your data is safe — please try again.",
    reference: "Reference: {digest}",
    retry: "Try again",
  },
  englishOnly: "In English",
  readingTime: "{n} min read",
  minutes: "{n} minutes",
  minutesShort: "{n} min",
  or: " or ",
  formats: { video: "Video call", phone: "Phone call", in_person: "In person", chat: "Chat" } as Record<string, string>,
};

export type CommonDict = typeof common;
