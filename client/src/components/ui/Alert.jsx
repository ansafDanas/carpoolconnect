/* eslint-disable react-refresh/only-export-components -- this module also exports shared hooks and helpers alongside its components */
import { cva } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "../../lib/utils";

/**
 * Inline feedback for form, network and business-rule errors. Messages are
 * always plain language: no stack traces, no database errors, ever.
 */
const alertVariants = cva(
  "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6",
  {
    variants: {
      tone: {
        info: "border-sky/25 bg-sky-soft text-sky",
        success: "border-leaf/25 bg-success-soft text-leaf-hover",
        warning: "border-warning/30 bg-warning-soft text-warning",
        error: "border-danger/30 bg-danger-soft text-danger",
      },
    },
    defaultVariants: { tone: "info" },
  }
);

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const Alert = ({ className, tone = "info", title, children, role, ...props }) => {
  const Icon = icons[tone] || Info;

  return (
    <div
      className={cn(alertVariants({ tone }), className)}
      role={role || (tone === "error" ? "alert" : "status")}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "break-words")}>{children}</div> : null}
      </div>
    </div>
  );
};

export { Alert, alertVariants };
export default Alert;
