/* eslint-disable react-refresh/only-export-components -- this module also exports shared hooks and helpers alongside its components */
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "../../lib/utils";

/**
 * One button for the whole product. Variants map to intent, never to colour
 * alone, so the action hierarchy reads identically on every screen.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-leaf text-white shadow-soft hover:bg-leaf-hover active:translate-y-px",
        brand:
          "bg-primary text-white shadow-soft hover:bg-primary-hover active:translate-y-px",
        secondary:
          "border border-border bg-surface text-primary hover:border-leaf/40 hover:bg-leaf-soft",
        ghost: "text-text-muted hover:bg-surface-muted hover:text-primary",
        accent: "bg-marigold text-primary shadow-soft hover:bg-marigold-hover",
        danger: "bg-danger text-white shadow-soft hover:bg-danger/90",
        outlineBrand:
          "border border-primary/20 bg-surface text-primary hover:bg-primary-soft",
        link: "text-leaf underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px] [&_svg]:size-4",
        md: "h-11 px-5 [&_svg]:size-4",
        lg: "h-12 px-6 text-[15px] [&_svg]:size-[18px]",
        icon: "size-10 [&_svg]:size-[18px]",
        iconSm: "size-9 [&_svg]:size-4",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

const Button = forwardRef(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      loadingText,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : "button";

    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        type={asChild ? undefined : type}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {loading && loadingText ? loadingText : children}
          </>
        )}
      </Component>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
export default Button;
