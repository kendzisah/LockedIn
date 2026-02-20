'use client';

import type { ContentPhase, SessionDuration } from '@lockedin/shared-types';

interface PublishConfirmModalProps {
  date: string;
  phase: ContentPhase;
  duration: SessionDuration;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishConfirmModal({
  date,
  phase,
  duration,
  title,
  onConfirm,
  onCancel,
}: PublishConfirmModalProps) {
  const phaseLabel = phase === 'lock_in' ? 'Lock In' : 'Unlock';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-lg font-semibold">Confirm Publish</h3>

        <div className="space-y-2 text-sm">
          <p className="text-text-secondary">Users will receive this content:</p>
          <div className="bg-background rounded-md p-3 space-y-1">
            <p><span className="text-text-secondary">Date:</span> {date}</p>
            <p><span className="text-text-secondary">Phase:</span> {phaseLabel}</p>
            <p><span className="text-text-secondary">Duration:</span> {duration} min</p>
            <p><span className="text-text-secondary">Title:</span> {title}</p>
          </div>
          <p className="text-text-secondary text-xs">
            If a session already exists for this slot, it will be archived and replaced.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-3 bg-surface border border-border rounded-md text-sm
                       hover:bg-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded-md text-sm
                       font-medium transition-colors"
          >
            Publish Now
          </button>
        </div>
      </div>
    </div>
  );
}
