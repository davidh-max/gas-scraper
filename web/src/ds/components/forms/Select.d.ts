import * as React from "react";

export interface SelectOption { value: string; label: string; }

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Options as strings or {value,label} objects. */
  options?: (string | SelectOption)[];
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  containerStyle?: React.CSSProperties;
}

/** Native select styled to match Input, with chevron and error state. */
export function Select(props: SelectProps): React.ReactElement;
