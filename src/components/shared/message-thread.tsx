import { cn } from "cn";
import type { RequestMessage } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";

export function MessageThread({ messages, viewer }: { messages: RequestMessage[]; viewer: "client" | "admin" }) {
  if (!messages.length) return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  return (
    <ol className="grid gap-3">
      {messages.map((m) => {
        const mine = m.author_role === viewer;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                mine ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-[0.7rem]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {m.author_role === "admin" ? "Consultant" : "Client"} · {formatDateTime(m.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
