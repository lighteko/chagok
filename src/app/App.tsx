import { WorkspacePage } from "@/domains/dashboard/components/WorkspacePage";
import { TooltipProvider } from "@/atomics/atoms/tooltip";

export function App() {
  return (
    <TooltipProvider>
      <WorkspacePage />
    </TooltipProvider>
  );
}
