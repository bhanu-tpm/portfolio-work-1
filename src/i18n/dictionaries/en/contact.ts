export const contact = {
  meta: {
    title: "Contact",
    description: "Send a question before booking a consultation.",
  },
  title: "Contact",
  intro:
    "Have a question before booking? Send a message. For consultation requests, please use the booking form so I have the details I need.",
  form: {
    sentTitle: "Message sent",
    name: "Name",
    email: "Email",
    subject: "Subject",
    message: "Message",
    privacyBefore: "Your message is stored securely and used only to reply to you. See the ",
    privacyLink: "privacy notice",
    privacyAfter: ".",
    sending: "Sending…",
    send: "Send message",
  },
  messages: {
    success: "Thank you — your message has been sent. I'll reply by email.",
    unavailable: "The contact form is not available yet. Please email directly.",
    rateLimited: "Too many messages. Please try again in an hour.",
  },
};

export type ContactDict = typeof contact;
