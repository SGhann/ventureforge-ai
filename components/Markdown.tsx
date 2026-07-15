"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders agent output.
 *
 * The previous version of this app hand-rolled a markdown parser. It was ~50
 * lines, mishandled nested emphasis, and silently dropped anything it didn't
 * recognise — which for a product whose whole output is markdown tables of
 * financial figures is not a cosmetic problem.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Financial tables get wide. Scroll them inside their own box so the
          // page body never scrolls sideways.
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
