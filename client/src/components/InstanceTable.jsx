import { useState } from 'react';

const STATE_COLORS = {
  running: 'bg-green-500',
  stopped: 'bg-red-500',
  pending: 'bg-yellow-400',
  stopping: 'bg-yellow-400',
  'shutting-down': 'bg-yellow-400',
  terminated: 'bg-gray-500',
};

function CopyableIp({ ip }) {
  const [copied, setCopied] = useState(false);
  if (!ip) return <span className="text-gray-500">—</span>;

  const copy = async (e) => {
    e.stopPropagation();

    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(ip);
        markCopied();
        return;
      }

      const ta = document.createElement('textarea');
      ta.value = ip;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const didCopy = document.execCommand('copy');
      ta.blur();
      document.body.removeChild(ta);
      window.getSelection()?.removeAllRanges();

      if (didCopy) {
        markCopied();
      }
    } catch {}
  };

  return (
    <span className="flex items-center gap-1.5 group">
      <span className="font-mono text-zinc-200">{ip}</span>
      <button
        onClick={copy}
        title="Copy IP"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-accent"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </span>
  );
}

export default function InstanceTable({ instances, selected, onSelect }) {
  return (
    <div className="brutal-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b-2 border-edge bg-surface uppercase text-xs tracking-wider">
              <th className="px-4 py-3 font-bold">Name</th>
              <th className="px-4 py-3 font-bold">Instance ID</th>
              <th className="px-4 py-3 font-bold">State</th>
              <th className="px-4 py-3 font-bold">Public IP</th>
              <th className="px-4 py-3 font-bold">Private IP</th>
              <th className="px-4 py-3 font-bold">Owner</th>
              <th className="px-4 py-3 font-bold">SemStatus</th>
            </tr>
          </thead>
          <tbody>
            {instances.map(inst => (
              <tr
                key={inst.instanceId}
                onClick={() => onSelect(inst.instanceId === selected?.instanceId ? null : inst)}
                className={`border-b border-zinc-800 last:border-0 cursor-pointer transition-colors ${
                  selected?.instanceId === inst.instanceId
                    ? 'bg-accent/20 border-l-4 border-l-accent'
                    : 'hover:bg-surface'
                }`}
              >
                <td className="px-4 py-3 font-bold text-white">{inst.name || '—'}</td>
                <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{inst.instanceId}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 border border-black flex-shrink-0 ${STATE_COLORS[inst.state] || 'bg-gray-500'}`} />
                    <span className="text-zinc-300 font-medium">{inst.state}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-xs"><CopyableIp ip={inst.publicIp} /></td>
                <td className="px-4 py-3 text-xs"><CopyableIp ip={inst.privateIp} /></td>
                <td className="px-4 py-3 text-zinc-300">{inst.owner || '—'}</td>
                <td className="px-4 py-3 text-zinc-300">{inst.semStatus || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
