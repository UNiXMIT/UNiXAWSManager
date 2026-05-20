import { useState } from 'react';
import { api } from '../api/client';

const STATE_COLORS = {
  running: 'bg-green-500',
  stopped: 'bg-red-500',
  pending: 'bg-yellow-400',
  stopping: 'bg-yellow-400',
  'shutting-down': 'bg-yellow-400',
};

export default function SemTab({ notify }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listSem();
      setResults(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const total = results.reduce((n, r) => n + r.instances.length, 0);

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <button
          onClick={load}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {loading ? 'Loading…' : 'Load SEM Instances'}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Queries <span className="text-gray-400">all available AWS regions</span> for instances with Name tag matching <code className="text-orange-300">SEM*</code>. Only regions with results are shown. This may take a few seconds.
        </p>
      </div>

      {results.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-16">
          Click <span className="text-orange-400">Load SEM Instances</span> to query all regions
        </div>
      )}

      {results.length > 0 && (
        <div className="text-xs text-gray-400 px-1">{total} total SEM instance(s) across {results.length} regions</div>
      )}

      {results.map(({ region, instances }) => (
        <div key={region} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-medium text-white text-sm">{region}</h3>
            <span className="text-xs text-gray-400">{instances.length} instance(s)</span>
          </div>
          {instances.length === 0 ? (
            <p className="px-4 py-4 text-gray-500 text-sm">No SEM instances found in this region</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Instance ID</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Launch Time</th>
                </tr>
              </thead>
              <tbody>
                {instances.map(inst => (
                  <tr key={inst.instanceId} className="border-b border-gray-700 last:border-0 hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-white">{inst.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{inst.instanceId}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATE_COLORS[inst.state] || 'bg-gray-500'}`} />
                        <span className="text-gray-300">{inst.state}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {inst.launchTime ? new Date(inst.launchTime).toLocaleString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
