import * as React from "react";

/**
 * Pill-shaped GAS button. Primary (red) and accent (flame) drive CTAs.
 * @startingPoint section="Core" subtitle="Pill buttons — primary, accent, dark, ghost" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. `dark` is the signature GAS pill; `primary` = energy red; `accent` = flame. */
  variant?: "primary" | "accent" | "dark" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  /** Lucide icon name shown left of the label (e.g. "flame", "phone-call"). */
  icon?: string;
  /** Lucide icon name shown right of the label (e.g. "arrow-right"). */
  iconRight?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): React.ReactElement;
