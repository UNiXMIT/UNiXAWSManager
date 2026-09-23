import { useState, useCallback, useRef } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import InstancesTab from './components/InstancesTab';
import AllInstancesTab from './components/AllInstancesTab';
import AmisTab from './components/AmisTab';
import SemTab from './components/SemTab';
import SemaphoreTab from './components/SemaphoreTab';
import SemTasksTab from './components/SemTasksTab';
import S3Tab from './components/S3Tab';
import SettingsTab from './components/SettingsTab';
import HelpTab from './components/HelpTab';
import Toast from './components/Toast';
import ThemeToggle from './components/ThemeToggle';

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, className: 'w-5 h-5 shrink-0' };

const TABS = [
  {
    label: 'EC2 Instances',
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="4" width="16" height="16" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
      </svg>
    ),
  },
  {
    label: 'Semaphore',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'SEM Tasks',
    icon: (
      <svg {...iconProps}>
        <rect x="5" y="4" width="14" height="17" />
        <path d="M9 4V3h6v1" />
        <path d="M8.5 11l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'All Instances',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: 'All AMIs',
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l9 5-9 5-9-5 9-5z" />
        <path d="M3 12l9 5 9-5" />
      </svg>
    ),
  },
  {
    label: 'SEM Instances',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="7" />
        <rect x="3" y="13" width="18" height="7" />
        <path d="M7 7.5h.01M7 16.5h.01" />
      </svg>
    ),
  },
  {
    label: 'S3',
    icon: (
      <svg {...iconProps}>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
        <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    label: 'Help',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.12 1.91c-.93.78-1.62 1.24-1.62 2.59" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function Inner() {
  const [activeTab, setActiveTab] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Stable identity so effects that depend on `notify` don't re-run every render.
  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <div className="min-h-screen text-zinc-100 flex">
      {/* Sidebar nav (md and up) — full height, always dark (theme-term keeps text light in light mode) */}
      <aside className="theme-term hidden md:flex md:flex-col w-56 shrink-0 bg-[#0a0a0a] border-r-2 border-[#f4f4f5] sticky top-0 h-screen overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex items-center justify-center w-10 h-10 bg-accent border-2 border-black text-black shadow-brutal-sm shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="0" />
              <path d="M8 21h8M12 17v4" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <h1 className="text-xl font-bold text-white uppercase tracking-tight leading-none">AWSManager</h1>
        </div>
        {/* Nav */}
        <nav className="flex flex-col gap-2 p-3">
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-bold uppercase tracking-tight border-2 text-left transition-all ${
                activeTab === i
                  ? 'bg-accent text-black border-black shadow-brutal-sm'
                  : 'bg-[#17171b] text-white border-[#f4f4f5] hover:text-white hover:-translate-y-px hover:shadow-brutal-sm'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Reduced top bar — shows the active page title */}
        <header className="sticky top-0 z-30 bg-panel border-b-2 border-edge px-6 py-3 flex items-center gap-3">
          <span className="md:hidden flex items-center justify-center w-8 h-8 bg-accent border-2 border-black text-black shadow-brutal-sm shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="0" />
              <path d="M8 21h8M12 17v4" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">{TABS[activeTab].label}</h2>
          <ThemeToggle />
        </header>

        {/* Horizontal nav fallback (below md) — always dark */}
        <div className="theme-term md:hidden bg-[#0a0a0a] border-b-2 border-[#f4f4f5]">
          <nav className="flex overflow-x-auto scrollbar-none px-3 gap-2 py-3">
            {TABS.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-bold uppercase tracking-tight border-2 whitespace-nowrap flex-shrink-0 transition-all ${
                  activeTab === i
                    ? 'bg-accent text-black border-black shadow-brutal-sm'
                    : 'bg-[#17171b] text-white border-[#f4f4f5] hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <main className="p-6 max-w-7xl mx-auto w-full">
          {activeTab === 0 && <InstancesTab notify={notify} />}
          {activeTab === 1 && <SemaphoreTab notify={notify} />}
          {activeTab === 2 && <SemTasksTab notify={notify} />}
          {activeTab === 3 && <AllInstancesTab notify={notify} />}
          {activeTab === 4 && <AmisTab notify={notify} />}
          {activeTab === 5 && <SemTab notify={notify} />}
          {activeTab === 6 && <S3Tab notify={notify} />}
          {activeTab === 7 && <SettingsTab />}
          {activeTab === 8 && <HelpTab />}
        </main>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <Inner />
    </ConfigProvider>
  );
}
