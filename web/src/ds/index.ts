"use client";

// Barrel tipado del GAS Design System (componentes .jsx + sus .d.ts).
// La directiva "use client" marca toda la frontera: cualquier Server Component
// puede importar estos componentes (se renderizan como Client Components).
// No reinventamos estilos: usamos estos primitivos tal cual vienen del DS.

export { Avatar } from "./components/core/Avatar";
export type { AvatarProps } from "./components/core/Avatar";

export { Badge } from "./components/core/Badge";
export type { BadgeProps } from "./components/core/Badge";

export { Button } from "./components/core/Button";
export type { ButtonProps } from "./components/core/Button";

export { IconButton } from "./components/core/IconButton";
export type { IconButtonProps } from "./components/core/IconButton";

export { Tag } from "./components/core/Tag";
export type { TagProps } from "./components/core/Tag";

export { Checkbox } from "./components/forms/Checkbox";
export type { CheckboxProps } from "./components/forms/Checkbox";

export { Input } from "./components/forms/Input";
export type { InputProps } from "./components/forms/Input";

export { Select } from "./components/forms/Select";
export type { SelectProps, SelectOption } from "./components/forms/Select";

export { Switch } from "./components/forms/Switch";
export type { SwitchProps } from "./components/forms/Switch";

export { Card } from "./components/surfaces/Card";
export type { CardProps } from "./components/surfaces/Card";

export { StatCard } from "./components/surfaces/StatCard";
export type { StatCardProps } from "./components/surfaces/StatCard";

export { ProgressBar } from "./components/feedback/ProgressBar";
export type { ProgressBarProps } from "./components/feedback/ProgressBar";

export { Toast } from "./components/feedback/Toast";
export type { ToastProps } from "./components/feedback/Toast";

export { Tabs } from "./components/navigation/Tabs";
export type { TabsProps, TabItem } from "./components/navigation/Tabs";
