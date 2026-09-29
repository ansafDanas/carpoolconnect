import { cn } from "../../lib/utils";

/**
 * Consistent page masthead: eyebrow, title, supporting line, actions.
 * Titles use the Georgia display face to keep the brand voice.
 */
function PageHeader({ eyebrow, title, description, action, className, children }) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-primary sm:text-[2.125rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted sm:text-[15px]">
            {description}
          </p>
        ) : null}
        {children}
      </div>

      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

export { PageHeader };
export default PageHeader;
