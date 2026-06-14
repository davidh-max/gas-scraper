import * as React from "react";

/**
 * KPI tile — big tech-font number with label, delta and icon.
 * @startingPoint section="Surfaces" subtitle="KPI stat tiles — light & graphite" viewport="700x180"
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  unit?: string;
  /** Delta string e.g. "+12%". Sign infers trend if `trend` omitted. */
  delta?: string;
  trend?: "up" | "down";
  /** Lucide icon name. */
  icon?: string;
  tone?: "light" | "dark";
}

export function StatCard(props: StatCardProps): React.ReactElement;
