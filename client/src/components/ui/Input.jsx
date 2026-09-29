import { forwardRef, useId } from "react";

import { cn } from "../../lib/utils";

const fieldBase =
  "w-full rounded-xl border bg-surface px-3.5 text-sm text-primary shadow-soft transition-[border-color,box-shadow] placeholder:text-text-muted/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted";

const fieldTone = (invalid) =>
  invalid
    ? "border-danger/60 focus-visible:border-danger focus-visible:ring-4 focus-visible:ring-danger/10"
    : "border-border hover:border-leaf/40 focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/10";

/** Label + control + helper/error text, wired for screen readers. */
function Field({ label, error, helperText, required, id, className, children }) {
  const messageId = id ? `${id}-message` : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label
          className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted"
          htmlFor={id}
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-clay" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children}

      {error || helperText ? (
        <p
          className={cn("text-xs leading-5", error ? "text-danger" : "text-text-muted")}
          id={messageId}
        >
          {error || helperText}
        </p>
      ) : null}
    </div>
  );
}

const Input = forwardRef(
  (
    { label, error, helperText, id, className, required, containerClassName, ...props },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const messageId = `${inputId}-message`;

    return (
      <Field
        className={containerClassName}
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        id={inputId}
      >
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={cn(fieldBase, fieldTone(Boolean(error)), "h-11", className)}
          {...props}
        />
      </Field>
    );
  }
);
Input.displayName = "Input";

const Textarea = forwardRef(
  (
    { label, error, helperText, id, className, required, containerClassName, ...props },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const messageId = `${inputId}-message`;

    return (
      <Field
        className={containerClassName}
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        id={inputId}
      >
        <textarea
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={cn(
            fieldBase,
            fieldTone(Boolean(error)),
            "min-h-24 resize-y py-3 leading-6",
            className
          )}
          {...props}
        />
      </Field>
    );
  }
);
Textarea.displayName = "Textarea";

export { Input, Textarea, Field };
export default Input;
