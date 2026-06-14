import * as React from "react";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  checked?: boolean;
  defaultChecked?: boolean;
  label?: React.ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
}

/** Toggle switch — red + subtle glow when on. Controlled or uncontrolled. */
export function Switch(props: SwitchProps): React.ReactElement;
