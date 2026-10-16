import type { ContactDict } from "../en/contact";

// Gender-neutral phrasing: no first-person verbs (करता/करती, सकता/सकती).
// Wording follows hindi_website_localization_review.xlsx (Recommended Hindi).
export const contact: ContactDict = {
  meta: {
    title: "संपर्क करें",
    description: "परामर्श का समय तय करने से पहले अपना सवाल भेजें।",
  },
  title: "संपर्क करें",
  intro:
    "परामर्श का समय तय करने से पहले कोई सवाल है? हमें संदेश भेजें। परामर्श बुक करने के लिए बुकिंग फ़ॉर्म का इस्तेमाल करें, ताकि ज़रूरी जानकारी पहले ही मिल जाए।",
  form: {
    sentTitle: "संदेश भेज दिया गया",
    name: "नाम",
    email: "ईमेल",
    subject: "विषय",
    message: "संदेश",
    privacyBefore: "आपका संदेश सुरक्षित रखा जाता है और इसका उपयोग केवल आपको जवाब देने के लिए किया जाता है। अधिक जानकारी के लिए ",
    privacyLink: "गोपनीयता नीति",
    privacyAfter: " पढ़ें।",
    sending: "भेजा जा रहा है…",
    send: "संदेश भेजें",
  },
  messages: {
    success: "धन्यवाद — आपका संदेश भेज दिया गया है। जवाब ईमेल से भेजा जाएगा।",
    unavailable: "संपर्क फ़ॉर्म अभी उपलब्ध नहीं है। कृपया सीधे ईमेल करें।",
    rateLimited: "बहुत ज़्यादा संदेश भेजे गए हैं। कृपया एक घंटे बाद फिर कोशिश करें।",
  },
};
