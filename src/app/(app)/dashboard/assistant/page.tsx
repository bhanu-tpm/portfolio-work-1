import type { Metadata } from "next";
import Link from "next/link";
import { Bot } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isAiFeatureEnabled } from "@/lib/ai/run";
import { ASSISTANT_DISCLAIMER } from "@/lib/ai/features";
import { getSettings } from "@/lib/settings";
import { canShareToRequest, type ChatMessage } from "@/lib/ai/student-helpers";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { AssistantChat } from "./assistant-chat";
import { ConsentPanel } from "./consent-panel";

export const metadata: Metadata = { title: "AI career guidance" };

export default async function AssistantPage() {
  const user = await requireUser("/dashboard/assistant");

  const header = (
    <PageHeader
      eyebrow="Optional"
      title="AI career guidance"
      description="Explore ideas about your studies and career with an AI assistant. It's a starting point for reflection — for personalised advice, book a consultation."
    />
  );

  if (!(await isAiFeatureEnabled("career_assistant"))) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <EmptyState
          icon={Bot}
          title="AI career guidance isn't available right now"
          description="You can still get personal guidance: book a consultation and I'll review your situation myself."
          action={
            <Button asChild>
              <Link href="/dashboard/requests/new">Book a human consultation</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!user.profile?.ai_consent) {
    const privacy = await getSettings("privacy");
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <ConsentPanel retentionDays={privacy.assistantRetentionDays} />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: conversation }, { data: requestRows }, settings] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("id, saved_to_request_id, summary")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; saved_to_request_id: string | null; summary: string | null }>(),
    supabase
      .from("consultation_requests")
      .select("id, reference_code, status, category:consultation_categories(title)")
      .eq("client_id", user.id)
      .order("submitted_at", { ascending: false }),
    getSettings("ai"),
  ]);

  let messages: ChatMessage[] = [];
  if (conversation) {
    const { data: rows } = await supabase
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(60);
    messages = ((rows ?? []) as ChatMessage[]).reverse().map((m) => ({ role: m.role, content: m.content }));
  }

  const requests = ((requestRows ?? []) as unknown as {
    id: string;
    reference_code: string;
    status: string;
    category: { title: string } | null;
  }[])
    .filter((r) => canShareToRequest(r.status))
    .map((r) => ({ id: r.id, label: `${r.reference_code} · ${r.category?.title ?? "Consultation"}` }));

  return (
    <div className="mx-auto max-w-3xl">
      {header}
      <AssistantChat
        key={conversation?.id ?? "new"}
        initialConversationId={conversation?.id ?? null}
        initialMessages={messages}
        initialSummary={conversation?.summary ?? null}
        requests={requests}
        dailyLimit={settings.assistantDailyMessageLimit}
        disclaimer={ASSISTANT_DISCLAIMER}
      />
    </div>
  );
}
