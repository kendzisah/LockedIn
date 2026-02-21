'use client';

import type { ContentPhase } from '@lockedin/shared-types';

export interface SessionSlot {
  phase: ContentPhase;
  status: 'published' | 'draft' | 'missing';
}

interface DayCellProps {
  date: string;
  dayNumber: number;
  isToday: boolean;
  slots: SessionSlot[];
  onSlotClick?: (date: string, phase: ContentPhase) => void;
}

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

function statusLabel(status: string): string {
  switch (status) {
    case 'published':
      return 'Published';
    case 'draft':
      return 'Draft';
    default:
      return 'Missing';
  }
}

export function DayCell({ date, dayNumber, isToday, slots, onSlotClick }: DayCellProps) {
  const lockIn = slots.find((s) => s.phase === 'lock_in');
  const unlock = slots.find((s) => s.phase === 'unlock');

  function renderSlot(phase: ContentPhase, slot: SessionSlot | undefined, label: string) {
    const st = slot?.status ?? 'missing';
    return (
      <button
        title={`${label} — ${statusLabel(st)}`}
        onClick={() => onSlotClick?.(date, phase)}
        className="flex items-center gap-1.5 group cursor-pointer"
      >
        <span className={`w-2.5 h-2.5 rounded-sm ${statusColor(st)} group-hover:ring-1 group-hover:ring-accent transition-all`} />
        <span className="text-[10px] text-text-secondary group-hover:text-text-primary transition-colors">{label}</span>
      </button>
    );
  }

  return (
    <div
      className={`border rounded-md p-2 min-h-[72px] ${
        isToday ? 'border-accent bg-accent/5' : 'border-border'
      }`}
    >
      <div className={`text-xs font-medium mb-1.5 ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
        {dayNumber}
      </div>
      <div className="space-y-1">
        {renderSlot('lock_in', lockIn, 'LI')}
        {renderSlot('unlock', unlock, 'UL')}
      </div>
    </div>
  );
}
