import * as React from "react";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  selected?: boolean;
  /** When provided, renders a remove (×) button. */
  onRemove?: (e: React.MouseEvent) => void;
  /** Optional Lucide icon name. */
  icon?: string;
  children?: React.ReactNode;
}

/** Selectable / removable chip for filters and categories. */
export function Tag(props: TagProps): React.ReactElement;
