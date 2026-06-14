import * as React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon name. */
  icon: string;
  variant?: "default" | "brand" | "ghost";
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "square";
  /** Accessible label (required — icon-only). */
  ariaLabel?: string;
  disabled?: boolean;
}

/** Icon-only button for toolbars, dialer controls and card actions. */
export function IconButton(props: IconButtonProps): React.ReactElement;
