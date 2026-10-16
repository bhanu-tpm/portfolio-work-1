"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Loader2, MessageSquarePlus, Send, User } from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiLabel } from "@/components/shared/page";
import { Markdown } from "@/components/shared/markdown";
import { ConfirmActionButton } from "@/components/student/confirm-action-button";
import { ASSISTANT_MESSAGE_MAX } from "@/lib/validation/student-ai";
import type { ChatMessage } from "@/lib/ai/student-helpers";
import { clearAssistantHistory, sendAssistantMessage } from "./actions";
import { ShareSummaryDialog } from "./share-summary-dialog";

interface DisplayMessage extends ChatMessage {
  id: string;
  /** Not stored and not sent to the AI model (moderation). */
  ephemeral?: boolean;
}

interface TurnExtras {
  suggestedCategories: { id: string; title: string }[];
  suggestHumanConsultation: boolean;
}

let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

export function AssistantChat({
  initialConversationId,
  initialMessages,
  initialSummary,
  requests,
  dailyLimit,
  disclaimer,
}: {
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
  initialSummary: string | null;
  requests: { id: string; label: string }[];
  dailyLimit: number;
  /** ASSISTANT_DISCLAIMER, passed from the server (features.ts is server-only). */
  disclaimer: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<DisplayMessage[]>(() =>
    initialMessages.map((m) => ({ ...m, id: nextId() })),
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<TurnExtras | null>(null);
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send() {
    const text = draft.trim();
    if (!text || pending) return;
    if (text.length > ASSISTANT_MESSAGE_MAX) {
      setError(`Messages can be at most ${ASSISTANT_MESSAGE_MAX} characters.`);
      return;
    }
    setError(null);
    const userMessage: DisplayMessage = { id: nextId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");

    startTransition(async () => {
      const result = await sendAssistantMessage({ conversationId, message: text });
      if (!result.ok) {
        // Roll back the optimistic message and keep the text so it can be retried.
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        setDraft(text);
        setError(result.message);
        inputRef.current?.focus();
        return;
      }
      if (result.conversationId) setConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev.map((m) => (m.id === userMessage.id && result.moderated ? { ...m, ephemeral: true } : m)),
        { id: nextId(), role: "assistant", content: result.reply, ephemeral: result.moderated },
      ]);
      setExtras({
        suggestedCategories: result.suggestedCategories,
        suggestHumanConsultation: result.suggestHumanConsultation,
      });
      if (result.summary) setSummary(result.summary);
    });
  }

  function startNew() {
    setConversationId(null);
    setMessages([]);
    setExtras(null);
    setSummary(null);
    setError(null);
    inputRef.current?.focus();
  }

  const remaining = ASSISTANT_MESSAGE_MAX - draft.length;

  return (
    <div className="grid gap-4">
      <Alert>
        <Bot aria-hidden />
        <AlertDescription>
          {disclaimer} For personalised advice,{" "}
          <Link href="/dashboard/requests/new" className="underline underline-offset-4">
            book a human consultation
          </Link>
          .
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Up to {dailyLimit} messages per day.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={startNew} disabled={pending || messages.length === 0}>
            <MessageSquarePlus data-icon="inline-start" aria-hidden /> New conversation
          </Button>
          <ConfirmActionButton
            size="sm"
            variant="ghost"
            triggerLabel="Clear history"
            title="Delete your AI assistant history?"
            description="All of your AI career guidance conversations will be permanently deleted. Summaries you already shared with a consultation request are kept on that request."
            confirmLabel="Delete history"
            action={clearAssistantHistory}
            onDone={() => {
              startNew();
              router.refresh();
            }}
          />
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation with the AI career assistant"
          className="flex max-h-[60vh] min-h-64 flex-col gap-4 overflow-y-auto p-4"
        >
          {messages.length === 0 && !pending ? (
            <div className="m-auto max-w-sm py-8 text-center text-sm text-muted-foreground">
              <Bot className="mx-auto mb-2 size-8 text-muted-foreground/70" aria-hidden />
              <p className="font-medium text-foreground">Start a conversation</p>
              <p className="mt-1">
                Tell me where you are in your studies or career, what you enjoy, and what decision you&apos;re facing.
              </p>
            </div>
          ) : null}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {pending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden /> The assistant is replying…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="grid gap-2 border-t p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Label htmlFor="assistant-message" className="sr-only">
            Your message
          </Label>
          <Textarea
            id="assistant-message"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            maxLength={ASSISTANT_MESSAGE_MAX}
            placeholder="Ask about study options, skills, career paths…"
            aria-describedby="assistant-message-hint"
            aria-invalid={error ? true : undefined}
            disabled={pending}
          />
          <div className="flex items-center justify-between gap-2">
            <p id="assistant-message-hint" className="text-xs text-muted-foreground">
              Enter to send, Shift+Enter for a new line · {remaining} characters left
            </p>
            <Button type="submit" disabled={pending || !draft.trim()}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Send
            </Button>
          </div>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </div>

      {extras && (extras.suggestedCategories.length > 0 || extras.suggestHumanConsultation) ? (
        <div className="rounded-xl bg-accent/40 p-4 ring-1 ring-foreground/10">
          <p className="text-sm font-medium">A consultation could help with this</p>
          {extras.suggestedCategories.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {extras.suggestedCategories.map((c) => (
                <li key={c.id}>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/requests/new?category=${encodeURIComponent(c.id)}`}>{c.title}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {extras.suggestHumanConsultation ? (
            <Button asChild size="sm" className="mt-3">
              <Link href="/dashboard/requests/new">Book a human consultation</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {summary && conversationId ? (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Conversation summary</p>
            <AiLabel />
          </div>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{summary}</p>
          <div className="mt-3">
            <ShareSummaryDialog conversationId={conversationId} summary={summary} requests={requests} />
          </div>
        </div>
      ) : messages.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Send a message to generate a summary you can choose to share with a consultation request.
        </p>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
        )}
        aria-hidden
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] min-w-0 rounded-xl px-3 py-2 text-sm break-words",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <span className="sr-only">{isUser ? "You said:" : "Assistant said:"}</span>
        {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : <Markdown>{message.content}</Markdown>}
        {message.ephemeral ? (
          <p className={cn("mt-1 text-[0.7rem]", isUser ? "text-primary-foreground/80" : "text-muted-foreground")}>
            Not saved to your history.
          </p>
        ) : null}
      </div>
    </div>
  );
}
