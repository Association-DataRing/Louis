import type { ReactNode } from "react";

/**
 * État vide réutilisable — uniformise les ~3 traitements distincts qui
 * existaient (carte pointillée + titre + texte + action optionnelle).
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border p-10 text-center ${className ?? ""}`}
    >
      <p className="font-heading text-lg">{title}</p>
      {children && (
        <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {children}
        </div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
