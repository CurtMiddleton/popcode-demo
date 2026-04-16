import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Micro label shown above the title (9px uppercase spaced) */
  eyebrow?: string;
  /** Main page title — rendered in large Cormorant Garamond Light roman */
  title: string;
  /** Optional supporting text below the title */
  description?: string;
  /** Optional slot for an action button aligned right */
  action?: React.ReactNode;
  /** Override title size */
  titleClassName?: string;
  className?: string;
}

/**
 * Editorial page header: micro-label eyebrow → large serif title (roman)
 * → 1.5px ink rule beneath. Optional right-aligned action.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  titleClassName,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex items-end justify-between gap-6 pb-5 editorial-rule">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="micro-label mb-2">{eyebrow}</p>
          )}
          <h1
            className={cn(
              "font-display text-[48px] leading-[0.95] text-tf-ink",
              titleClassName
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-sm text-tf-muted max-w-xl">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
    </header>
  );
}
