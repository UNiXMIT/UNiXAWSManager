import { useState } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import InstancesTab from './components/InstancesTab';
import AllInstancesTab from './components/AllInstancesTab';
import AmisTab from './components/AmisTab';
import SemTab from './components/SemTab';
import Toast from './components/Toast';

const TABS = ['EC2 Instances', 'All Instances', 'AMIs', 'SEM Instances'];

function Inner() {
  const [activeTab, setActiveTab] = useState(0);
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-3">
        <svg className="w-7 h-7 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <h1 className="text-lg font-bold text-white tracking-tight">AWSManager</h1>
      </header>

      <div className="bg-gray-800 border-b border-gray-700">
        <nav className="flex px-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-orange-400 text-orange-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <main className="p-6 max-w-7xl mx-auto">
        {activeTab === 0 && <InstancesTab notify={notify} />}
        {activeTab === 1 && <AllInstancesTab notify={notify} />}
        {activeTab === 2 && <AmisTab notify={notify} />}
        {activeTab === 3 && <SemTab notify={notify} />}
      </main>

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
