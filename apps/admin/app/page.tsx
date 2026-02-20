import { CoverageKPI } from '../components/CoverageKPI';
import { CoverageCalendar } from '../components/CoverageCalendar';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <CoverageKPI />
      <CoverageCalendar />
    </div>
  );
}
