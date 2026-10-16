import type { Locale } from "../config";
import { assistantPage as enAssistantPage } from "./en/assistantPage";
import { auth as enAuth } from "./en/auth";
import { blog as enBlog } from "./en/blog";
import { common as enCommon } from "./en/common";
import { contact as enContact } from "./en/contact";
import { home as enHome } from "./en/home";
import { portfolio as enPortfolio } from "./en/portfolio";
import { privacy as enPrivacy } from "./en/privacy";
import { services as enServices } from "./en/services";
import { validation as enValidation } from "./en/validation";
import { assistantPage as hiAssistantPage } from "./hi/assistantPage";
import { auth as hiAuth } from "./hi/auth";
import { blog as hiBlog } from "./hi/blog";
import { common as hiCommon } from "./hi/common";
import { contact as hiContact } from "./hi/contact";
import { home as hiHome } from "./hi/home";
import { portfolio as hiPortfolio } from "./hi/portfolio";
import { privacy as hiPrivacy } from "./hi/privacy";
import { services as hiServices } from "./hi/services";
import { validation as hiValidation } from "./hi/validation";

/**
 * One file per area (common, home, …) and language. To add an area, create
 * en/<area>.ts (exporting the English object and its type) and hi/<area>.ts
 * (typed with that type so missing keys fail type-checking), then register both here.
 */
const en = {
  common: enCommon,
  home: enHome,
  services: enServices,
  portfolio: enPortfolio,
  blog: enBlog,
  contact: enContact,
  privacy: enPrivacy,
  assistantPage: enAssistantPage,
  auth: enAuth,
  validation: enValidation,
};
export type Dictionary = typeof en;

const hi: Dictionary = {
  common: hiCommon,
  home: hiHome,
  services: hiServices,
  portfolio: hiPortfolio,
  blog: hiBlog,
  contact: hiContact,
  privacy: hiPrivacy,
  assistantPage: hiAssistantPage,
  auth: hiAuth,
  validation: hiValidation,
};

export const dictionaries: Record<Locale, Dictionary> = { en, hi };
