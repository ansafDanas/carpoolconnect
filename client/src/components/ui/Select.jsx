import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../../lib/utils";

import { Field } from "./Input";

/**
 * Native select, styled. Kept native on purpose: it is the most reliable
 * control on mobile, keyboard-friendly, and needs no extra JS to open.
 */
const Select = forwardRef(
  (
    {
      label,
      error,
      helperText,
      id,
      className,
      required,
      containerClassName,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const messageId = `${selectId}-message`;

    return (
      <Field
        className={containerClassName}
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        id={selectId}
      >
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? messageId : undefined}
            className={cn(
              "h-11 w-full appearance-none rounded-xl border bg-surface pl-3.5 pr-9 text-sm text-primary shadow-soft transition-[border-color,box-shadow] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted",
              error
                ? "border-danger/60 focus-visible:border-danger focus-visible:ring-4 focus-visible:ring-danger/10"
                : "border-border hover:border-leaf/40 focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/10",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
        </div>
      </Field>
    );
  }
);
Select.displayName = "Select";

export { Select };
export default Select;
