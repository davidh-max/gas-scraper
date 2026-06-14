import * as React from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
}

/** Checkbox with red fill + check glyph; controlled or uncontrolled. */
export function Checkbox(props: CheckboxProps): React.ReactElement;
