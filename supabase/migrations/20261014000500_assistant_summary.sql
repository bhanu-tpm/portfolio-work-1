-- Latest AI-generated conversation summary, so it survives page reloads.
-- Only ever shared with a consultation request after explicit user confirmation.
alter table public.ai_conversations
  add column summary text check (char_length(summary) <= 1200);
