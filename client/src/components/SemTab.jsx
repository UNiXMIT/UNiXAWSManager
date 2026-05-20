import { useState } from 'react';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';

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
  const [busy, setBusy] = useState(false);
  const [confirmTerminate, setConfirmTerminate] = useState(null);
  const [confirmTerminateAll, setConfirmTerminateAll] = useState(false);

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

  const refresh = async () => {
    const data = await api.listSem();
    setResults(data);
  };

  const handleTerminateInstance = async () => {
    if (!confirmTerminate) return;
    setBusy(true);
    try {
      await api.terminateInstance(confirmTerminate.instance.instanceId, confirmTerminate.region, { semOnly: true });
      await refresh();
      notify(`Termination requested for ${confirmTerminate.instance.name || confirmTerminate.instance.instanceId}`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setConfirmTerminate(null);
    }
  };

  const handleTerminateAll = async () => {
    setBusy(true);
    try {
      const operations = results.map(({ region, instances }) =>
        api.terminateBatch(
          instances.map(instance => instance.instanceId),
          region,
          { semOnly: true }
        )
      );

      await Promise.all(operations);
      await refresh();
      notify(`Termination requested for ${total} SEM instance(s)`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setConfirmTerminateAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={load}
            disabled={loading || busy}
            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            {loading ? 'Loading…' : 'Load SEM Instances'}
          </button>
          {total > 0 && (
            <button
              onClick={() => setConfirmTerminateAll(true)}
              disabled={loading || busy}
              className="bg-red-800 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition-colors border border-red-600"
            >
              ⚠ Terminate All SEM Instances
            </button>
          )}
        </div>
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
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Launch Time</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map(inst => (
                  <tr key={inst.instanceId} className="border-b border-gray-700 last:border-0 hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-white">{inst.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{inst.instanceId}</td>
                    <td className="px-4 py-3 text-gray-300">{inst.owner || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATE_COLORS[inst.state] || 'bg-gray-500'}`} />
                        <span className="text-gray-300">{inst.state}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {inst.launchTime ? new Date(inst.launchTime).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmTerminate({ region, instance: inst })}
                        disabled={loading || busy}
                        className="bg-red-900 hover:bg-red-800 disabled:opacity-50 border border-red-700 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                      >
                        Terminate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {confirmTerminate && (
        <ConfirmDialog
          message={`Permanently terminate "${confirmTerminate.instance.name || confirmTerminate.instance.instanceId}" in ${confirmTerminate.region}? This cannot be undone.`}
          previewTitle="Instance to terminate"
          previewItems={[
            {
              primary: confirmTerminate.instance.instanceId,
              secondary: `${confirmTerminate.instance.name || 'Unnamed'} | ${confirmTerminate.region}`,
            },
          ]}
          confirmLabel="Terminate"
          danger
          onConfirm={handleTerminateInstance}
          onCancel={() => setConfirmTerminate(null)}
        />
      )}

      {confirmTerminateAll && (
        <ConfirmDialog
          message={`Terminate all ${total} loaded SEM instance(s) across ${results.length} region(s)? This cannot be undone.`}
          previewTitle={`SEM instances to terminate (${total})`}
          previewItems={results.flatMap(({ region, instances }) =>
            instances.map(inst => ({
              primary: inst.instanceId,
              secondary: `${inst.name || 'Unnamed'} | ${region}`,
            }))
          )}
          confirmLabel="Terminate All"
          danger
          onConfirm={handleTerminateAll}
          onCancel={() => setConfirmTerminateAll(false)}
        />
      )}
    </div>
  );
}
