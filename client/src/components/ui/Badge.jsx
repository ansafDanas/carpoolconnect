/* eslint-disable react-refresh/only-export-components -- this module also exports shared hooks and helpers alongside its components */
import { cva } from "class-variance-authority";
import { BadgeCheck, Info } from "lucide-react";

import { cn } from "../../lib/utils";

/**
 * Status pill. Every ride, booking and request state uses these tones so a
 * status reads the same way everywhere in the product.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ring-1 ring-inset whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-text-muted ring-border",
        success: "bg-success-soft text-leaf-hover ring-leaf/20",
        warning: "bg-warning-soft text-warning ring-warning/25",
        danger: "bg-danger-soft text-danger ring-danger/25",
        info: "bg-info-soft text-sky ring-sky/20",
        accent: "bg-marigold-soft text-marigold-hover ring-marigold/30",
        brand: "bg-primary-soft text-primary ring-primary/15",
        solid: "bg-primary text-white ring-primary",
        outline: "bg-surface text-text-muted ring-border",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

const Badge = ({ className, tone, icon, children, ...props }) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props}>
    {icon === "verified" ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : null}
    {icon === "info" ? <Info className="size-3.5" aria-hidden="true" /> : null}
    {children}
  </span>
);

/**
 * Only ever render a "Verified" pill when the backend genuinely says the
 * account is verified. Never used as decoration.
 */
const VerifiedBadge = ({ className }) => (
  <Badge tone="success" icon="verified" className={className}>
    Verified
  </Badge>
);

export { Badge, VerifiedBadge, badgeVariants };
export default Badge;
