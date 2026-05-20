import { useState } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import InstanceTable from './InstanceTable';
import InstanceActions from './InstanceActions';
import ConfirmDialog from './ConfirmDialog';

const REGIONS = [
  'eu-west-2', 'eu-west-1', 'eu-central-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

export default function InstancesTab({ notify }) {
  const { defaultOwner, defaultRegion } = useConfig();
  const [owner, setOwner] = useState(defaultOwner);
  const [region, setRegion] = useState(defaultRegion);
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmTermAll, setConfirmTermAll] = useState(false);

  const normalizedOwner = owner.trim();

  const load = async () => {
    if (!normalizedOwner) {
      setInstances([]);
      setSelected(null);
      notify('Owner tag is required', 'error');
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
      notify('Owner tag is required', 'error');
      setConfirmTermAll(false);
      return;
    }

    try {
      const result = await api.terminateAll(normalizedOwner, region);
      notify(result.message || `Terminated ${result.terminated.length} instance(s)`);
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

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-gray-800 rounded-lg p-4 flex flex-wrap gap-3 items-end border border-gray-700">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Owner Tag</label>
          <input
            value={owner}
            onChange={e => setOwner(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="MTURNER"
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400 w-36"
          />
        </div>
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
          disabled={loading || !normalizedOwner}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {loading ? 'Loading…' : 'Load Instances'}
        </button>
        {instances.length > 0 && (
          <button
            onClick={() => setConfirmTermAll(true)}
            className="ml-auto bg-red-800 hover:bg-red-700 px-4 py-2 rounded text-sm font-medium transition-colors border border-red-600"
          >
            ⚠ Terminate All ({normalizedOwner})
          </button>
        )}
      </div>

      {instances.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-16">
          Enter an owner tag and click <span className="text-orange-400">Load Instances</span>
        </div>
      )}

      {instances.length > 0 && (
        <InstanceTable instances={instances} selected={selected} onSelect={setSelected} />
      )}

      {selected && (
        <InstanceActions
          instance={selected}
          region={region}
          notify={notify}
          terminateScope={{ owner: selected.owner || normalizedOwner }}
          onDone={handleDone}
          onClose={() => setSelected(null)}
        />
      )}

      {confirmTermAll && (
        <ConfirmDialog
          message={`Terminate ALL instances owned by "${normalizedOwner}" in ${region}? The protected instance will be skipped. This cannot be undone.`}
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
