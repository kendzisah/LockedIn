'use client';

import { useState } from 'react';
import { ProgramGrid } from '../../components/ProgramGrid';
import { DayEditorPanel } from '../../components/DayEditorPanel';

export default function ProgramPage() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Program Content</h2>
        <p className="text-text-secondary text-sm mt-1">
          Select a day to view or replace its Lock In / Unlock audio.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3">
          <ProgramGrid selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </div>
        <div>
          <DayEditorPanel dayNumber={selectedDay} />
        </div>
      </div>
    </div>
  );
}
