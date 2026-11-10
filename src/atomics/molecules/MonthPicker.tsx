import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/atomics/atoms/Button";
import { isValidMonth, MIN_MONTH, MAX_MONTH, shiftMonth } from "@/shared/utils/month";

export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5">
      <Button
        variant="ghost"
        className="h-8 w-8 px-0"
        aria-label="이전 달"
        disabled={value <= MIN_MONTH}
        onClick={() => onChange(shiftMonth(value, -1))}
      >
        <ChevronLeft
          size={15}
          aria-hidden="true"
        />
      </Button>
      <input
        aria-label="정산월"
        type="month"
        min={MIN_MONTH}
        max={MAX_MONTH}
        value={value}
        onChange={event => {
          if (isValidMonth(event.target.value)) onChange(event.target.value);
        }}
        className="w-[142px] border-0 bg-transparent px-2 py-1 text-[13px] font-medium"
      />
      <Button
        variant="ghost"
        className="h-8 w-8 px-0"
        aria-label="다음 달"
        disabled={value >= MAX_MONTH}
        onClick={() => onChange(shiftMonth(value, 1))}
      >
        <ChevronRight
          size={15}
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
