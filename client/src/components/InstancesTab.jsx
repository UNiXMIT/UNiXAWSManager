import { useState } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import InstanceTable from './InstanceTable';
import InstanceActions from './InstanceActions';
import ConfirmDialog from './ConfirmDialog';
import StatCards from './StatCards';

const REGIONS = [
  'all',
  'eu-west-2', 'eu-west-1', 'eu-central-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

export default function InstancesTab({ notify }) {
  const { owner, setOwner, region, setRegion, hasAwsCreds } = useConfig();
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmTermAll, setConfirmTermAll] = useState(false);

  const normalizedOwner = owner.trim();

  const load = async () => {
    if (!hasAwsCreds) {
      notify('No AWS credentials configured.', 'error');
      return;
    }
    if (!normalizedOwner) {
      setInstances([]);
      setSelected(null);
      notify('Owner is required', 'error');
      return;
    }

    setLoading(true);
    setSelected(null);
    try {
      const data = await api.listInstances(normalizedOwner, region);
      setInstances(data);
      if (data.length === 0) notify('No instances found', 'error');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateAll = async () => {
    if (!normalizedOwner) {
      notify('Owner is required', 'error');
      setConfirmTermAll(false);
      return;
    }

    try {
      const result = await api.terminateAll(normalizedOwner, region);
      const skippedMsg = result.skipped?.length
        ? ` (${result.skipped.length} protected instance(s) skipped)`
        : '';
      notify(result.message || `Terminated ${result.terminated.length} instance(s)${skippedMsg}`);
      setInstances([]);
      setSelected(null);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setConfirmTermAll(false);
    }
  };

  const handleDone = () => {
    setSelected(null);
    load();
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
      {/* Filter bar — extra bottom padding (md+) leaves room for the absolute caption */}
      <div className="brutal-panel flex flex-wrap gap-3 items-end md:pb-8">
        <div className="relative">
          <label className="brutal-label">Owner</label>
          <input
            value={owner}
            onChange={e => setOwner(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="BWAYNE"
            className="brutal-input w-36"
          />
          <p className="static md:absolute left-0 md:top-full mt-1 text-xs text-zinc-500">(case sensitive)</p>
        </div>
        <div>
          <label className="brutal-label">Region</label>
          <select
            value={region}
            onChange={e => { setRegion(e.target.value); setInstances([]); setSelected(null); }}
            className="brutal-input"
          >
            {REGIONS.map(r => <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>)}
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading || !normalizedOwner}
          className="btn-accent"
        >
          {loading ? 'Loading…' : 'Load Instances'}
        </button>
        {instances.length > 0 && region !== 'all' && (
          <button
            onClick={() => setConfirmTermAll(true)}
            className="btn-danger ml-auto"
          >
            ⚠ Terminate All ({normalizedOwner})
          </button>
        )}
      </div>

      {instances.length === 0 && !loading && (
        <div className="text-center text-zinc-500 py-16 font-medium">
          Enter an owner and click <span className="text-accent font-bold">Load Instances</span>
        </div>
      )}

      {instances.length > 0 && (
        <StatCards stats={stats} />
      )}

      {instances.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className="w-full min-w-0 flex-1">
            <InstanceTable instances={instances} selected={selected} onSelect={setSelected} />
          </div>

          {selected && (
            <div className="w-full xl:w-[480px] xl:shrink-0 xl:sticky xl:top-[90px] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto scrollbar-none">
              <InstanceActions
                instance={selected}
                region={region === 'all' ? (selected.region || region) : region}
                notify={notify}
                terminateScope={{ owner: selected.owner || normalizedOwner }}
                onDone={handleDone}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </div>
      )}

      {confirmTermAll && (
        <ConfirmDialog
          message={`Terminate ALL instances owned by "${normalizedOwner}" in ${region}? This cannot be undone.`}
          previewTitle={`Instances to terminate (${instances.length})`}
          previewItems={instances.map(inst => ({
            primary: inst.instanceId,
            secondary: `${inst.name || 'Unnamed'} | ${inst.state || 'unknown'} | ${region}`,
          }))}
          confirmLabel="Terminate All"
          danger
          onConfirm={handleTerminateAll}
          onCancel={() => setConfirmTermAll(false)}
        />
      )}
    </div>
  );
}
