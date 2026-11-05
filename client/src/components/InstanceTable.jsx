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

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'instanceId', label: 'Instance ID' },
  { key: 'state', label: 'State' },
  { key: 'publicIp', label: 'Public IP' },
  { key: 'privateIp', label: 'Private IP' },
  { key: 'owner', label: 'Owner' },
  { key: 'semStatus', label: 'SemStatus' },
];

function RowAction({ label, color, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={`${color} px-2 py-0.5 text-[10px]`}
    >
      {label}
    </button>
  );
}

export default function InstanceTable({
  instances,
  selected,
  onSelect,
  sort,
  onSort,
  checkedIds,
  onToggleChecked,
  onToggleAll,
  onAction,
  busyIds,
}) {
  const allChecked = instances.length > 0 && instances.every(i => checkedIds.has(i.instanceId));
  const someChecked = !allChecked && instances.some(i => checkedIds.has(i.instanceId));

  return (
    <div className="brutal-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b-2 border-edge bg-surface uppercase text-xs tracking-wider">
              <th className="pl-4 pr-2 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all visible instances"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={() => onToggleAll(!allChecked)}
                  className="accent-orange-500 w-4 h-4 cursor-pointer"
                />
              </th>
              {COLUMNS.map(col => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-4 py-3 font-bold"
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1 uppercase tracking-wider font-bold hover:text-white ${active ? 'text-accent' : ''}`}
                    >
                      {col.label}
                      <span className="text-[10px] w-3">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {instances.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-zinc-500 font-medium">
                  No instances match the current filter
                </td>
              </tr>
            )}
            {instances.map(inst => {
              const busy = busyIds.has(inst.instanceId);
              return (
              <tr
                key={inst.instanceId}
                onClick={() => onSelect(inst.instanceId === selected?.instanceId ? null : inst)}
                className={`border-b border-zinc-800 last:border-0 cursor-pointer transition-colors ${
                  selected?.instanceId === inst.instanceId
                    ? 'bg-accent/20 border-l-4 border-l-accent'
                    : 'hover:bg-surface'
                }`}
              >
                <td className="pl-4 pr-2 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${inst.name || inst.instanceId}`}
                    checked={checkedIds.has(inst.instanceId)}
                    onChange={() => onToggleChecked(inst.instanceId)}
                    className="accent-orange-500 w-4 h-4 cursor-pointer"
                  />
                </td>
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
                <td className="px-4 py-3">
                  <span className="flex gap-1.5">
                    <RowAction label="Start" color="btn-success" disabled={busy || inst.state !== 'stopped'} onClick={() => onAction(inst, 'start')} />
                    <RowAction label="Stop" color="btn-warn" disabled={busy || inst.state !== 'running'} onClick={() => onAction(inst, 'stop')} />
                    <RowAction label="Reboot" color="btn-warn" disabled={busy || inst.state !== 'running'} onClick={() => onAction(inst, 'reboot')} />
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
