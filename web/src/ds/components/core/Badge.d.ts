import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "brand" | "flame" | "success" | "warning" | "info" | "dark";
  /** Show a leading status dot. */
  dot?: boolean;
  /** Optional Lucide icon name. */
  icon?: string;
  children?: React.ReactNode;
}

/** Small uppercase status/label pill in the tech font. */
export function Badge(props: BadgeProps): React.ReactElement;
