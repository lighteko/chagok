import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/atomics/atoms/button";
import { ButtonGroup } from "@/atomics/atoms/button-group";
import { Input } from "@/atomics/atoms/input";
import { MAX_MONTH, MIN_MONTH, isValidMonth, shiftMonth } from "@/shared/utils/month";

export function MonthSelector({ value, onValueChange }: { value: string; onValueChange: (month: string) => void }) {
  return (
    <ButtonGroup aria-label="정산월 선택">
      <Button
        variant="outline"
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
        variant="outline"
        size="icon"
        aria-label="다음 달"
        disabled={value >= MAX_MONTH}
        onClick={() => onValueChange(shiftMonth(value, 1))}
      >
        <ChevronRight />
      </Button>
    </ButtonGroup>
  );
}
