import { cn } from "../../lib/utils";

/**
 * Empty state. Always offers the next useful action, or an honest
 * "coming soon" when the action does not exist yet.
 */
function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/70 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <span
          className="grid size-12 place-items-center rounded-2xl bg-leaf-soft text-leaf"
          aria-hidden="true"
        >
          <Icon className="size-6" />
        </span>
      ) : null}

      <h3 className="font-display text-lg font-bold text-primary">{title}</h3>

      {description ? (
        <p className="max-w-md text-sm leading-6 text-text-muted">{description}</p>
      ) : null}

      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
export default EmptyState;
