import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { exportCsv } from '../api/exportCsv';

const REGIONS = [
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
  { key: 'vpcId',        label: 'VPC' },
];

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1 text-orange-400">{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function AllInstancesTab({ notify }) {
  const { defaultRegion } = useConfig();
  const [region, setRegion] = useState(defaultRegion);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

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
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
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
        VPC: i.vpcId,
        Subnet: i.subnetId,
      })),
      `ec2-instances-${region}-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4 flex flex-wrap gap-3 items-end border border-gray-700">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Region</label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {loading ? 'Loading…' : 'Load Instances'}
        </button>
        {instances.length > 0 && (
          <button
            onClick={handleExport}
            className="ml-auto bg-gray-700 hover:bg-gray-600 border border-gray-600 px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {instances.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-16">
          Select a region and click <span className="text-orange-400">Load Instances</span>
        </div>
      )}

      {instances.length > 0 && (
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <div className="px-4 py-2 border-b border-gray-700 text-xs text-gray-400">
            {instances.length} instance(s) in {region}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-200 whitespace-nowrap"
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(inst => (
                  <tr key={inst.instanceId} className="border-b border-gray-700 last:border-0 hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-white">{inst.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{inst.instanceId}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATE_COLORS[inst.state] || 'bg-gray-500'}`} />
                        <span className="text-gray-300">{inst.state}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{inst.publicIp || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{inst.privateIp || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{inst.instanceType}</td>
                    <td className="px-4 py-3 text-gray-300">{inst.owner || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {inst.launchTime ? new Date(inst.launchTime).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400 text-xs">{inst.vpcId || '—'}</td>
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

