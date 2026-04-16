import type { CSSProperties } from 'react';

interface Props {
  value: string;
  style?: CSSProperties;
  className?: string;
}

/** Renders text exactly as it appears in the phone — not editable on-screen, only via sidebar. */
export default function EditableText({ value, style, className }: Props) {
  return (
    <span className={className} style={style}>
      {value}
    </span>
  );
}
