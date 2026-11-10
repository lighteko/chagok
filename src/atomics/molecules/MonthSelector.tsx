import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/atomics/atoms/button";
import { Input } from "@/atomics/atoms/input";
import { MAX_MONTH, MIN_MONTH, isValidMonth, shiftMonth } from "@/shared/utils/month";

export function MonthSelector({ value, onValueChange }: { value: string; onValueChange: (month: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="이전 달"
        disabled={value <= MIN_MONTH}
        onClick={() => onValueChange(shiftMonth(value, -1))}
      >
        <ChevronLeft />
      </Button>
      <Input
        type="month"
        aria-label="정산월"
        value={value}
        min={MIN_MONTH}
        max={MAX_MONTH}
        className="w-44"
        onChange={event => {
          if (isValidMonth(event.target.value)) onValueChange(event.target.value);
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="다음 달"
        disabled={value >= MAX_MONTH}
        onClick={() => onValueChange(shiftMonth(value, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
