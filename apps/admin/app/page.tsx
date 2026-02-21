import { CoverageKPI } from '../components/CoverageKPI';
import { OnboardingTrackPanel } from '../components/OnboardingTrackPanel';
import { CoverageCalendar } from '../components/CoverageCalendar';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CoverageKPI />
        <OnboardingTrackPanel />
      </div>
      <CoverageCalendar />
    </div>
  );
}
