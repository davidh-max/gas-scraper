import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Error message — replaces hint and turns the field red. */
  error?: string;
  /** Leading Lucide icon name. */
  icon?: string;
  size?: "sm" | "md" | "lg";
  containerStyle?: React.CSSProperties;
}

/** Labeled text input with optional leading icon, hint and error state. */
export function Input(props: InputProps): React.ReactElement;
