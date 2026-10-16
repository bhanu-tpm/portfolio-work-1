import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "cn";

/**
 * Safe Markdown rendering: raw HTML is not rendered (react-markdown default),
 * only http(s)/mailto links are allowed and external links open safely.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (/^(https?:|mailto:|\/|#)/i.test(url) ? url : "")}
        components={{
          a: ({ href, children: linkChildren }) => {
            const external = href ? /^https?:/i.test(href) : false;
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
              >
                {linkChildren}
              </a>
            );
          },
          img: ({ src, alt }) =>
            typeof src === "string" && /^https:/i.test(src) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ""} loading="lazy" />
            ) : null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
