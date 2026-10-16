export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface EmailContent {
  siteName: string;
  heading: string;
  paragraphs: string[];
  cta?: { url: string; label: string };
}

/** Minimal, accessible transactional email. All dynamic text is escaped. */
export function renderEmail({ siteName, heading, paragraphs, cta }: EmailContent) {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = cta
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(cta.url)}" style="background:#1d2b46;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">${escapeHtml(cta.label)}</a></p>`
    : "";

  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f7f6f2;font-family:Arial,Helvetica,sans-serif;color:#1d2b46;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;">
<tr><td>
<p style="margin:0 0 24px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#3d7f81;">${escapeHtml(siteName)}</p>
<h1 style="margin:0 0 16px;font-size:22px;">${escapeHtml(heading)}</h1>
${body}${button}
<p style="margin:32px 0 0;font-size:12px;color:#6b7280;">You are receiving this email because of activity on your account. You can change email preferences in your dashboard settings.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [heading, "", ...paragraphs, cta ? `\n${cta.label}: ${cta.url}` : ""].join("\n");
  return { html, text };
}
