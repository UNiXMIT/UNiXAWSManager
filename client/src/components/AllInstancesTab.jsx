import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { exportCsv } from '../api/exportCsv';
import StatCards from './StatCards';

const REGIONS = [
  'all',
  'eu-west-2', 'eu-west-1', 'eu-central-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

const STATE_COLORS = {
  running: 'bg-green-500',
  stopped: 'bg-red-500',
  pending: 'bg-yellow-400',
  stopping: 'bg-yellow-400',
  'shutting-down': 'bg-yellow-400',
  terminated: 'bg-gray-500',
};

const COLUMNS = [
  { key: 'name',         label: 'Name' },
  { key: 'instanceId',   label: 'Instance ID' },
  { key: 'state',        label: 'State' },
  { key: 'publicIp',     label: 'Public IP' },
  { key: 'privateIp',    label: 'Private IP' },
  { key: 'instanceType', label: 'Type' },
  { key: 'owner',        label: 'Owner' },
  { key: 'launchTime',   label: 'Launch Time' },
];

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1 text-accent">{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function AllInstancesTab({ notify }) {
  const { region, setRegion } = useConfig();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('launchTime');
  const [sortDir, setSortDir] = useState('desc');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listInstances(undefined, region);
      setInstances(data);
      if (data.length === 0) notify('No instances found', 'error');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    return [...instances].sort((a, b) => {
      let cmp;
      if (sortKey === 'launchTime') {
        cmp = (new Date(a.launchTime || 0).getTime()) - (new Date(b.launchTime || 0).getTime());
      } else {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [instances, sortKey, sortDir]);

  const handleExport = () => {
    exportCsv(
      sorted.map(i => ({
        Name: i.name,
        'Instance ID': i.instanceId,
        State: i.state,
        'Public IP': i.publicIp,
        'Private IP': i.privateIp,
        'Public DNS': i.publicDns,
        Type: i.instanceType,
        Owner: i.owner,
        'Launch Time': i.launchTime ? new Date(i.launchTime).toLocaleString('en-GB') : '',
        Subnet: i.subnetId,
      })),
      `ec2-instances-${region}-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const running = instances.filter(i => i.state === 'running').length;
  const stopped = instances.filter(i => i.state === 'stopped').length;
  const stats = [
    { label: 'Total', value: instances.length },
    { label: 'Running', value: running, tone: 'running' },
    { label: 'Stopped', value: stopped, tone: 'stopped' },
    { label: 'Other', value: instances.length - running - stopped, tone: 'warn' },
  ];

  return (
    <div className="space-y-4">
      <div className="brutal-panel flex flex-wrap gap-3 items-end">
        <div>
          <label className="brutal-label">Region</label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="brutal-input"
          >
            {REGIONS.map(r => <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>)}
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-accent"
        >
          {loading ? 'Loading…' : 'Load Instances'}
        </button>
        {instances.length > 0 && (
          <button
            onClick={handleExport}
            className="btn-neutral ml-auto"
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {instances.length === 0 && !loading && (
        <div className="text-center text-zinc-500 py-16 font-medium">
          Select a region and click <span className="text-accent font-bold">Load Instances</span>
        </div>
      )}

      {instances.length > 0 && (
        <StatCards stats={stats} />
      )}

      {instances.length > 0 && (
        <div className="brutal-card overflow-hidden">
          <div className="px-4 py-2 border-b-2 border-edge text-xs text-zinc-400 uppercase font-bold tracking-wider bg-surface">
            {instances.length} instance(s) in {region === 'all' ? 'all regions' : region}
          </div>
          <div className="overflow-auto max-h-[calc(100vh-20rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-zinc-400 border-b-2 border-edge uppercase text-xs tracking-wider bg-surface">
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 font-bold cursor-pointer select-none hover:text-white whitespace-nowrap"
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(inst => (
                  <tr key={inst.instanceId} className="border-b border-zinc-800 last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 font-bold text-white">{inst.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{inst.instanceId}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 border border-black flex-shrink-0 ${STATE_COLORS[inst.state] || 'bg-gray-500'}`} />
                        <span className="text-zinc-300 font-medium">{inst.state}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{inst.publicIp || '—'}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{inst.privateIp || '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{inst.instanceType}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      <span className="block max-w-[10ch] truncate" title={inst.owner || ''}>{inst.owner || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {inst.launchTime ? new Date(inst.launchTime).toLocaleString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

