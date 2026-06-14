import * as React from "react";

export interface TabItem {
  id: string;
  label: string;
  /** Optional Lucide icon name. */
  icon?: string;
  /** Optional count pill. */
  count?: number;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
}

/** Underline tab bar with brand-red active indicator, icons and count pills. */
export function Tabs(props: TabsProps): React.ReactElement;
