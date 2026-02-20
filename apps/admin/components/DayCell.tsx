'use client';

import type { ContentPhase, SessionDuration } from '@lockedin/shared-types';

interface SessionSlot {
  phase: ContentPhase;
  duration: SessionDuration;
  status: 'published' | 'draft' | 'missing';
}

interface DayCellProps {
  date: string;
  dayNumber: number;
  isToday: boolean;
  slots: SessionSlot[];
  onSlotClick?: (date: string, phase: ContentPhase, duration: SessionDuration) => void;
}

const DURATIONS: SessionDuration[] = [5, 10, 15, 20];

function statusColor(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-status-green';
    case 'draft':
      return 'bg-status-gray';
    default:
      return 'bg-status-red';
  }
}

export function DayCell({ date, dayNumber, isToday, slots, onSlotClick }: DayCellProps) {
  const lockInSlots = slots.filter((s) => s.phase === 'lock_in');
  const unlockSlots = slots.filter((s) => s.phase === 'unlock');

  function renderChip(phase: ContentPhase, phaseSlots: SessionSlot[], label: string) {
    return (
      <div className="space-y-0.5">
        <span className="text-[9px] text-text-secondary uppercase">{label}</span>
        <div className="flex gap-0.5">
          {DURATIONS.map((dur) => {
            const slot = phaseSlots.find((s) => s.duration === dur);
            const status = slot?.status ?? 'missing';
            return (
              <button
                key={`${phase}-${dur}`}
                title={`${label} ${dur}m — ${status}`}
                onClick={() => onSlotClick?.(date, phase, dur)}
                className={`w-2.5 h-2.5 rounded-sm ${statusColor(status)} hover:ring-1 hover:ring-accent transition-all cursor-pointer`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-md p-2 min-h-[80px] ${
        isToday ? 'border-accent bg-accent/5' : 'border-border'
      }`}
    >
      <div className={`text-xs font-medium mb-1 ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
        {dayNumber}
      </div>
      <div className="space-y-1">
        {renderChip('lock_in', lockInSlots, 'LI')}
        {renderChip('unlock', unlockSlots, 'UL')}
      </div>
    </div>
  );
}
