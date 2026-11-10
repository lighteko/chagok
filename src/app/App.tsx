import { DashboardPage } from "@/domains/dashboard/components/DashboardPage";
import { TanStackQueryProvider } from "@/app/_providers/TanStackQueryProvider";

export function App() {
  return (
    <TanStackQueryProvider>
      <DashboardPage />
    </TanStackQueryProvider>
  );
}
