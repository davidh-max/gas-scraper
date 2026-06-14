import * as React from "react";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
  /** Lucide icon name (defaults per tone). */
  icon?: string;
  onClose?: () => void;
}

/** Transient notification card. Renders static — wrap in your own queue/portal. */
export function Toast(props: ToastProps): React.ReactElement;
