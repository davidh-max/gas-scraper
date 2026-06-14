import * as React from "react";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value?: number;
  tone?: "brand" | "flame" | "success" | "dark";
  size?: "sm" | "md" | "lg";
  label?: string;
  showValue?: boolean;
  /** Add a brand/flame glow to the fill. */
  glow?: boolean;
}

/** Quota / goal progress bar with brand-red fill and optional glow. */
export function ProgressBar(props: ProgressBarProps): React.ReactElement;
