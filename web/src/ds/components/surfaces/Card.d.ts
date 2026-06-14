import * as React from "react";

/**
 * Surface container — white default, graphite `dark`, or solid `brand` red.
 * @startingPoint section="Surfaces" subtitle="Card surfaces — light, graphite, brand" viewport="700x260"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "light" | "dark" | "brand";
  padding?: "none" | "sm" | "md" | "lg";
  /** Adds hover lift + shadow for clickable cards. */
  interactive?: boolean;
  children?: React.ReactNode;
}

export function Card(props: CardProps): React.ReactElement;
