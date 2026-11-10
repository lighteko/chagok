import type { ReactNode } from "react";

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
