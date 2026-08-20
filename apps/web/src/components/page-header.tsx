import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary actions for the page, right-aligned on desktop. */
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}
