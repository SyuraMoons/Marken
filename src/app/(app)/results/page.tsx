import { ResultsView } from "@/components/results-view";
import { FreshOnNavigate } from "@/components/fresh-on-navigate";

// Results (F-17, FR-RS-01, FD-19). No metrics backend yet, so the screen shows the empty state (FD-34).
export default function ResultsPage() {
  return (
    <FreshOnNavigate>
      <ResultsView />
    </FreshOnNavigate>
  );
}
