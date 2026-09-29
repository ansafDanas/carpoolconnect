import { forwardRef } from "react";

import { cn } from "../../lib/utils";

/** Premium surface. Soft border, layered shadow, generous radius. */
const Card = forwardRef(
  ({ className, interactive = false, as: Element = "div", ...props }, ref) => (
    <Element
      ref={ref}
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-surface shadow-card",
        interactive &&
          "transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-leaf/30 hover:shadow-elevated",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

const CardTitle = ({ className, as: Element = "h3", ...props }) => (
  <Element
    className={cn("font-display text-lg font-bold leading-tight text-primary", className)}
    {...props}
  />
);
CardTitle.displayName = "CardTitle";

const CardDescription = ({ className, ...props }) => (
  <p className={cn("text-sm leading-6 text-text-muted", className)} {...props} />
);
CardDescription.displayName = "CardDescription";

const CardContent = ({ className, ...props }) => (
  <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = ({ className, ...props }) => (
  <div
    className={cn("flex flex-wrap items-center gap-3 p-5 pt-0 sm:p-6 sm:pt-0", className)}
    {...props}
  />
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;
