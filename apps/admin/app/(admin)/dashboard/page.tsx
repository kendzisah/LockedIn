import { ProgramKPI } from '../../../components/ProgramKPI';
import { OnboardingTrackPanel } from '../../../components/OnboardingTrackPanel';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProgramKPI />
        <OnboardingTrackPanel />
      </div>
    </div>
  );
}
