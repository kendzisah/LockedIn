import { forwardRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  backgroundColor?: string;
}

const PhoneFrame = forwardRef<HTMLDivElement, Props>(
  ({ children, backgroundColor = '#090C10' }, ref) => {
    return (
      <div className="phone-frame">
        <div className="phone-frame-inner" ref={ref} style={{ backgroundColor }}>
          <div className="phone-notch" />
          <StatusBar />
          {children}
          <div className="home-indicator" />
        </div>
      </div>
    );
  },
);

function StatusBar() {
  return (
    <div className="status-bar">
      <span className="status-bar-time">9:41</span>
      <div className="status-bar-icons">
        {/* Signal */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
          <rect x="0" y="8" width="3" height="4" rx="0.5" fill="white" />
          <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="white" />
          <rect x="9" y="2" width="3" height="10" rx="0.5" fill="white" />
          <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="white" />
        </svg>
        {/* WiFi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path
            d="M8 3.6C10.1 3.6 12 4.4 13.4 5.7L14.8 4.3C13 2.6 10.6 1.6 8 1.6C5.4 1.6 3 2.6 1.2 4.3L2.6 5.7C4 4.4 5.9 3.6 8 3.6Z"
            fill="white"
          />
          <path
            d="M8 7.2C9.2 7.2 10.3 7.6 11.1 8.4L12.5 7C11.3 5.9 9.7 5.2 8 5.2C6.3 5.2 4.7 5.9 3.5 7L4.9 8.4C5.7 7.6 6.8 7.2 8 7.2Z"
            fill="white"
          />
          <circle cx="8" cy="10.5" r="1.5" fill="white" />
        </svg>
        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect
            x="0.5"
            y="0.5"
            width="21"
            height="11"
            rx="2"
            stroke="white"
            strokeOpacity="0.35"
          />
          <rect x="2" y="2" width="18" height="8" rx="1" fill="white" />
          <path
            d="M23 4V8C23.8 7.7 24.5 6.9 24.5 6C24.5 5.1 23.8 4.3 23 4Z"
            fill="white"
            fillOpacity="0.4"
          />
        </svg>
      </div>
    </div>
  );
}

PhoneFrame.displayName = 'PhoneFrame';
export default PhoneFrame;
