import { Suspense } from 'react';
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
          <Suspense fallback={
            <div className="bg-surface border border-border rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-border rounded w-32 mb-4" />
              <div className="space-y-3">
                <div className="h-8 bg-border rounded" />
                <div className="h-8 bg-border rounded" />
                <div className="h-8 bg-border rounded" />
              </div>
            </div>
          }>
            <SlotUploadPanel />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
