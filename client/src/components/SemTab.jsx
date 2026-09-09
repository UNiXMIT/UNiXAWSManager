import { useState } from 'react';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';
import StatCards from './StatCards';

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
  const allInstances = results.flatMap(r => r.instances);
  const running = allInstances.filter(i => i.state === 'running').length;
  const stopped = allInstances.filter(i => i.state === 'stopped').length;
  const stats = [
    { label: 'Total', value: total },
    { label: 'Regions', value: results.length, tone: 'accent' },
    { label: 'Running', value: running, tone: 'running' },
    { label: 'Stopped', value: stopped, tone: 'stopped' },
  ];

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
      <div className="brutal-card bg-surface border-l-4 border-l-amber-400 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">SEM Instances</h2>
          <span className="brutal-badge bg-amber-400 text-black border-black">Advanced</span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Advanced AWS management — operates on <span className="font-bold text-zinc-200">SEM*</span> instances across <span className="font-bold text-zinc-200">every region</span>. Actions here (including bulk terminate) apply account-wide, so proceed with care.
        </p>
      </div>

      <div className="brutal-panel">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={load}
            disabled={loading || busy}
            className="btn-accent"
          >
            {loading ? 'Loading…' : 'Load SEM Instances'}
          </button>
          {total > 0 && (
            <button
              onClick={() => setConfirmTerminateAll(true)}
              disabled={loading || busy}
              className="btn-danger"
            >
              ⚠ Terminate All SEM Instances
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Queries <span className="text-zinc-300">all available AWS regions</span> for instances with Name tag matching <code className="text-accent font-bold">SEM*</code>. Only regions with results are shown. This may take a few seconds.
        </p>
      </div>

      {results.length === 0 && !loading && (
        <div className="text-center text-zinc-500 py-16 font-medium">
          Click <span className="text-accent font-bold">Load SEM Instances</span> to query all regions
        </div>
      )}

      {results.length > 0 && (
        <StatCards stats={stats} />
      )}

      {results.map(({ region, instances }) => (
        <div key={region} className="brutal-card overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-edge flex items-center justify-between bg-surface">
            <h3 className="font-bold text-white text-sm uppercase tracking-tight">{region}</h3>
            <span className="text-xs text-zinc-400 font-bold">{instances.length} instance(s)</span>
          </div>
          {instances.length === 0 ? (
            <p className="px-4 py-4 text-zinc-500 text-sm">No SEM instances found in this region</p>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-zinc-400 border-b-2 border-edge uppercase text-xs tracking-wider bg-surface">
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">Instance ID</th>
                  <th className="px-4 py-3 font-bold">Owner</th>
                  <th className="px-4 py-3 font-bold">State</th>
                  <th className="px-4 py-3 font-bold">Launch Time</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map(inst => (
                  <tr key={inst.instanceId} className="border-b border-zinc-800 last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 font-bold text-white">{inst.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{inst.instanceId}</td>
                    <td className="px-4 py-3 text-zinc-300">{inst.owner || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 border border-black flex-shrink-0 ${STATE_COLORS[inst.state] || 'bg-gray-500'}`} />
                        <span className="text-zinc-300 font-medium">{inst.state}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {inst.launchTime ? new Date(inst.launchTime).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmTerminate({ region, instance: inst })}
                        disabled={loading || busy}
                        className="btn-danger px-3 py-1.5 text-xs"
                      >
                        Terminate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
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
