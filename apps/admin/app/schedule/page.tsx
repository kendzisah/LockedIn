import { CoverageCalendar } from '../../components/CoverageCalendar';
import { SlotUploadPanel } from '../../components/SlotUploadPanel';

export default function SchedulePage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Content Schedule</h2>
        <p className="text-text-secondary text-sm mt-1">
          Click a slot to upload or replace content.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CoverageCalendar />
        </div>
        <div>
          <SlotUploadPanel />
        </div>
      </div>
    </div>
  );
}
