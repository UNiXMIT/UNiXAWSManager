import { useState, useMemo } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { exportCsv } from '../api/exportCsv';

const REGIONS = [
  'all',
  'eu-west-2', 'eu-west-1', 'eu-central-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

const COLUMNS = [
  { key: 'name',         label: 'Name' },
  { key: 'imageId',      label: 'Image ID' },
  { key: 'owner',        label: 'Owner' },
  { key: 'region',       label: 'Region' },
  { key: 'state',        label: 'State' },
  { key: 'creationDate', label: 'Created' },
];

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1 text-accent">{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function AmisTab({ notify }) {
  const { region: activeRegion } = useConfig();
  const [region, setRegion] = useState(activeRegion);
  const [amis, setAmis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('creationDate');
  const [sortDir, setSortDir] = useState('desc');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listAmis(region);
      setAmis(data);
      if (data.length === 0) notify('No AMIs found', 'error');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    exportCsv(
      amis.map(a => ({
        Name: a.name,
        'Image ID': a.imageId,
        Owner: a.owner,
        Region: a.region,
        State: a.state,
        Created: a.creationDate ? new Date(a.creationDate).toLocaleDateString('en-GB') : '',
      })),
      `amis-${region}-${new Date().toISOString().slice(0, 10)}.csv`
    );
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
    return [...amis].sort((a, b) => {
      let cmp;
      if (sortKey === 'creationDate') {
        cmp = (new Date(a.creationDate || 0).getTime()) - (new Date(b.creationDate || 0).getTime());
      } else {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [amis, sortKey, sortDir]);

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
          {loading ? 'Loading…' : 'Load AMIs'}
        </button>
        {amis.length > 0 && (
          <button
            onClick={handleExport}
            className="btn-neutral ml-auto"
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {amis.length === 0 && !loading && (
        <div className="text-center text-zinc-500 py-16 font-medium">
          Select a region and click <span className="text-accent font-bold">Load AMIs</span>
        </div>
      )}

      {amis.length > 0 && (
        <div className="brutal-card overflow-hidden">
          <div className="px-4 py-2 border-b-2 border-edge text-xs text-zinc-400 uppercase font-bold tracking-wider bg-surface">
            {amis.length} AMI(s) — owned by this account in {region === 'all' ? 'all regions' : region}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-400 border-b-2 border-edge uppercase text-xs tracking-wider">
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
                {sorted.map(ami => (
                  <tr key={ami.imageId} className="border-b border-zinc-800 last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 font-bold text-white">{ami.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{ami.imageId}</td>
                    <td className="px-4 py-3 text-zinc-300">{ami.owner || '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{ami.region || '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{ami.state}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {ami.creationDate ? new Date(ami.creationDate).toLocaleDateString('en-GB') : '—'}
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
