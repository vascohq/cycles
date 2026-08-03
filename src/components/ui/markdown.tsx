'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

// Narratives are short prose, not documents: headings render as bold lines
// rather than page titles, and raw HTML is never parsed (react-markdown skips
// it by default), so pasted markup can't inject anything.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
  ul: ({ children }) => (
    <ul className="my-1 list-disc pl-4 space-y-0.5 first:mt-0 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 list-decimal pl-4 space-y-0.5 first:mt-0 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-1 overflow-x-auto rounded bg-muted p-2 font-mono text-[0.9em] first:mt-0 last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-border pl-2 text-muted-foreground first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => <p className="my-1 font-semibold first:mt-0 last:mb-0">{children}</p>,
  h2: ({ children }) => <p className="my-1 font-semibold first:mt-0 last:mb-0">{children}</p>,
  h3: ({ children }) => <p className="my-1 font-semibold first:mt-0 last:mb-0">{children}</p>,
  h4: ({ children }) => <p className="my-1 font-semibold first:mt-0 last:mb-0">{children}</p>,
  h5: ({ children }) => <p className="my-1 font-semibold first:mt-0 last:mb-0">{children}</p>,
  h6: ({ children }) => <p className="my-1 font-semibold first:mt-0 last:mb-0">{children}</p>,
  hr: () => <hr className="my-2 border-border" />,
  table: ({ children }) => (
    <div className="my-1 overflow-x-auto first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-1.5 py-0.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-1.5 py-0.5">{children}</td>,
}

export type MarkdownProps = {
  children: string
  className?: string
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
