import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth } from "@/lib/time";
import { cn } from "@/lib/utils";

/** "‹ Oktober 2026 ›" with the next month disabled once we reach today. */
export function MonthSwitcher({
  month,
  onChange,
  className,
}: {
  month: Date;
  onChange: (month: Date) => void;
  className?: string;
}) {
  const now = new Date();
  const isCurrent =
    month.getFullYear() === now.getFullYear() &&
    month.getMonth() === now.getMonth();

  return (
    <div
      className={cn(
        "flex items-center rounded-full border border-line bg-card p-0.5",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label="Vorheriger Monat"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-[18px]" />
      </Button>
      <span className="min-w-32 text-center text-[15px] font-medium tabular">
        {monthLabel(month)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label="Nächster Monat"
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-[18px]" />
      </Button>
    </div>
  );
}
