import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  ScrollText,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

// Icons are referenced by name so server layouts can pass nav config to client components.
export const NAV_ICONS = {
  overview: LayoutDashboard,
  requests: ClipboardList,
  appointments: CalendarDays,
  availability: CalendarClock,
  outcomes: FileCheck2,
  assistant: Sparkles,
  resume: FileText,
  settings: Settings,
  clients: Users,
  blog: BookOpen,
  portfolio: UserRound,
  categories: ListChecks,
  usage: BarChart3,
  audit: ScrollText,
  messages: Inbox,
  notifications: Bell,
  chat: MessageCircle,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
