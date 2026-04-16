import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { toPng } from 'html-to-image';
import PhoneFrame from './components/PhoneFrame';
import HomeTabTemplate, { HomeTabFields, defaultHomeTab, type HomeTabState } from './templates/HomeTabTemplate';
import MissionsTemplate, { MissionsFields, defaultMissions, type MissionsState } from './templates/MissionsTemplate';
import ExecutionBlockTemplate, { ExecutionBlockFields, defaultExecutionBlock, type ExecutionBlockState } from './templates/ExecutionBlockTemplate';
import SessionTemplate, { SessionFields, defaultSession, type SessionState } from './templates/SessionTemplate';
import DurationPickerTemplate, { DurationPickerFields, defaultDurationPicker, type DurationPickerState } from './templates/DurationPickerTemplate';
import SettingsTemplate, { SettingsFields, defaultSettings, type SettingsState } from './templates/SettingsTemplate';
import SquadsTemplate, { SquadsFields, defaultSquads, type SquadsState } from './templates/SquadsTemplate';
import WeeklyReportTemplate, { WeeklyReportFields, defaultWeeklyReport, type WeeklyReportState } from './templates/WeeklyReportTemplate';

const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');

type Template = 'home' | 'missions' | 'squads' | 'execution_block' | 'session' | 'duration_picker' | 'settings' | 'weekly_report';

const TABS: { id: Template; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'missions', label: 'Missions' },
  { id: 'squads', label: 'Squads' },
  { id: 'duration_picker', label: 'Lock In' },
  { id: 'execution_block', label: 'Execution' },
  { id: 'session', label: 'Session' },
  { id: 'weekly_report', label: 'Report' },
  { id: 'settings', label: 'Settings' },
];

const RESOLUTION_OPTIONS = [
  { label: '1x', value: 1, size: '375 x 812' },
  { label: '2x', value: 2, size: '750 x 1624' },
  { label: '3x', value: 3, size: '1125 x 2436' },
];

export default function App() {
  const [template, setTemplate] = useState<Template>('home');
  const [homeState, setHomeState] = useState<HomeTabState>(defaultHomeTab);
  const [missionsState, setMissionsState] = useState<MissionsState>(defaultMissions);
  const [ebState, setEbState] = useState<ExecutionBlockState>(defaultExecutionBlock);
  const [sessionState, setSessionState] = useState<SessionState>(defaultSession);
  const [dpState, setDpState] = useState<DurationPickerState>(defaultDurationPicker);
  const [settingsState, setSettingsState] = useState<SettingsState>(defaultSettings);
  const [weeklyReportState, setWeeklyReportState] = useState<WeeklyReportState>(defaultWeeklyReport);
  const [squadsState, setSquadsState] = useState<SquadsState>(defaultSquads);
  const [exporting, setExporting] = useState(false);
  const [pixelRatio, setPixelRatio] = useState(3);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const tabScrollerRef = useRef<HTMLDivElement>(null);

  const generatePng = useCallback(async () => {
    if (!frameRef.current) return null;
    const el = frameRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return toPng(el, {
      pixelRatio,
      backgroundColor: '#000000',
      canvasWidth: w * pixelRatio,
      canvasHeight: h * pixelRatio,
      width: w,
      height: h,
    });
  }, [pixelRatio]);

  const updateTabScroll = useCallback(() => {
    const el = tabScrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateTabScroll();
    const el = tabScrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateTabScroll);
    window.addEventListener('resize', updateTabScroll);
    return () => {
      el.removeEventListener('scroll', updateTabScroll);
      window.removeEventListener('resize', updateTabScroll);
    };
  }, [updateTabScroll]);

  const scrollTabs = useCallback((distance: number) => {
    const el = tabScrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: distance, behavior: 'smooth' });
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const dataUrl = await generatePng();
      if (!dataUrl) return;

      if (isEmbedded) {
        // Send to parent (Slideshow-Lab)
        window.parent.postMessage({
          type: 'lockedin-studio:screenshot',
          dataUrl,
          template,
          width: 375 * pixelRatio,
          height: 812 * pixelRatio,
        }, '*');
      } else {
        const link = document.createElement('a');
        link.download = `lockedin-${template}-${pixelRatio}x-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [template, pixelRatio, generatePng]);

  const bgColor = template === 'execution_block' ? ebState.backgroundColor
    : template === 'session' ? sessionState.backgroundColor
    : '#0E1116';

  return (
    <div className="editor-layout">
      <div className="editor-sidebar">
        <div className="editor-sidebar-header">
          <h1>LockedIn Studio</h1>
          <p>{isEmbedded ? 'Generate app screenshots for your ad' : 'Marketing template builder'}</p>
        </div>

        <div className="template-tabs-wrapper">
          <button
            className="tab-scroll-btn left"
            onClick={() => scrollTabs(-180)}
            disabled={!canScrollLeft}
            aria-label="Scroll tabs left"
          >
            ‹
          </button>
          <div className="template-tabs" ref={tabScrollerRef}>
            {TABS.map((t) => (
              <button key={t.id}
                className={`template-tab ${template === t.id ? 'active' : ''}`}
                onClick={() => setTemplate(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button
            className="tab-scroll-btn right"
            onClick={() => scrollTabs(180)}
            disabled={!canScrollRight}
            aria-label="Scroll tabs right"
          >
            ›
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {template === 'home' && <HomeTabFields state={homeState} onChange={setHomeState} />}
          {template === 'missions' && <MissionsFields state={missionsState} onChange={setMissionsState} />}
          {template === 'squads' && <SquadsFields state={squadsState} onChange={setSquadsState} />}
          {template === 'execution_block' && <ExecutionBlockFields state={ebState} onChange={setEbState} />}
          {template === 'session' && <SessionFields state={sessionState} onChange={setSessionState} />}
          {template === 'duration_picker' && <DurationPickerFields state={dpState} onChange={setDpState} />}
          {template === 'weekly_report' && <WeeklyReportFields state={weeklyReportState} onChange={setWeeklyReportState} />}
          {template === 'settings' && <SettingsFields state={settingsState} onChange={setSettingsState} />}
        </div>

        <div className="export-section">
          <div className="resolution-picker">
            {RESOLUTION_OPTIONS.map((opt) => (
              <button key={opt.value}
                className={`resolution-btn ${pixelRatio === opt.value ? 'active' : ''}`}
                onClick={() => setPixelRatio(opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="resolution-info">
            {RESOLUTION_OPTIONS.find((o) => o.value === pixelRatio)?.size} px
          </div>
          <button className="export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : isEmbedded ? 'Add to Slideshow' : 'Export as PNG'}
          </button>
        </div>
      </div>

      <div className="editor-canvas">
        <PhoneFrame ref={frameRef} backgroundColor={bgColor}>
          {template === 'home' && <HomeTabTemplate state={homeState} />}
          {template === 'missions' && <MissionsTemplate state={missionsState} />}
          {template === 'squads' && <SquadsTemplate state={squadsState} />}
          {template === 'execution_block' && <ExecutionBlockTemplate state={ebState} />}
          {template === 'session' && <SessionTemplate state={sessionState} />}
          {template === 'duration_picker' && <DurationPickerTemplate state={dpState} />}
          {template === 'weekly_report' && <WeeklyReportTemplate state={weeklyReportState} />}
          {template === 'settings' && <SettingsTemplate state={settingsState} />}
        </PhoneFrame>
      </div>
    </div>
  );
}
