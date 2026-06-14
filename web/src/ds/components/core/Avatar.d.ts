import * as React from "react";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name — used for initials fallback and alt text. */
  name?: string;
  /** Image URL; falls back to initials on a graphite chip. */
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Live presence dot. */
  status?: "online" | "busy" | "away";
  /** Brand ring — e.g. the active caller / current rep. */
  ring?: boolean;
}

/** User avatar with initials fallback, presence dot and optional brand ring. */
export function Avatar(props: AvatarProps): React.ReactElement;
