import { useState } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { exportCsv } from '../api/exportCsv';

const REGIONS = [
  'eu-west-2', 'eu-west-1', 'eu-central-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

export default function AmisTab({ notify }) {
  const { defaultRegion } = useConfig();
  const [region, setRegion] = useState(defaultRegion);
  const [amis, setAmis] = useState([]);
  const [loading, setLoading] = useState(false);

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
        'Owner Tag': a.owner,
        State: a.state,
        Created: a.creationDate ? new Date(a.creationDate).toLocaleDateString('en-GB') : '',
      })),
      `amis-${region}-${new Date().toISOString().slice(0, 10)}.csv`
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
          {loading ? 'Loading…' : 'Load AMIs'}
        </button>
        {amis.length > 0 && (
          <button
            onClick={handleExport}
            className="ml-auto bg-gray-700 hover:bg-gray-600 border border-gray-600 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {amis.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-16">
          Select a region and click <span className="text-orange-400">Load AMIs</span>
        </div>
      )}

      {amis.length > 0 && (
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <div className="px-4 py-2 border-b border-gray-700 text-xs text-gray-400">
            {amis.length} AMI(s) — owned by this account in {region}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Image ID</th>
                  <th className="px-4 py-3 font-medium">Owner Tag</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {amis.map(ami => (
                  <tr key={ami.imageId} className="border-b border-gray-700 last:border-0 hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-white">{ami.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{ami.imageId}</td>
                    <td className="px-4 py-3 text-gray-300">{ami.owner || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{ami.state}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
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
