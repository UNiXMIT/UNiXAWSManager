import { useState, useMemo, useEffect, useRef } from 'react';
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

const ACTIONS = {
  start: { label: 'Start', call: api.startInstance, from: ['stopped'], color: 'btn-success' },
  stop: { label: 'Stop', call: api.stopInstance, from: ['running'], color: 'btn-warn' },
  reboot: { label: 'Reboot', call: api.rebootInstance, from: ['running'], color: 'btn-warn' },
  terminate: { label: 'Terminate', color: 'btn-danger' },
};

const REFRESH_KEY = 'awsmanager.instancesRefreshSec';
const DEFAULT_REFRESH_SEC = 0;
const REFRESH_OPTIONS = [0, 10, 15, 30, 60, 120, 300];

function readRefreshSec() {
  try {
    const stored = localStorage.getItem(REFRESH_KEY);
    if (stored !== null && REFRESH_OPTIONS.includes(Number(stored))) return Number(stored);
  } catch {}
  return DEFAULT_REFRESH_SEC;
}

function compareValues(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export default function InstancesTab({ notify }) {
  const { owner, setOwner, region, setRegion, hasAwsCreds } = useConfig();
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmTermAll, setConfirmTermAll] = useState(false);
  const [stateFilter, setStateFilter] = useState('all');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [pendingBulk, setPendingBulk] = useState(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [refreshSec, setRefreshSec] = useState(readRefreshSec);

  const normalizedOwner = owner.trim();

  const instanceRegion = (inst) => (region === 'all' ? (inst.region || region) : region);

  const load = async ({ keepSelection = false, silent = false } = {}) => {
    if (!hasAwsCreds) {
      if (!silent) notify('No AWS credentials configured.', 'error');
      return;
    }
    if (!normalizedOwner) {
      if (silent) return;
      setInstances([]);
      setSelected(null);
      setCheckedIds(new Set());
      notify('Owner is required', 'error');
      return;
    }

    if (!silent) setLoading(true);
    if (!keepSelection) setSelected(null);
    try {
      const data = await api.listInstances(normalizedOwner, region);
      setInstances(data);
      const ids = new Set(data.map(i => i.instanceId));
      setCheckedIds(prev => new Set([...prev].filter(id => ids.has(id))));
      if (keepSelection) {
        setSelected(prev => (prev ? data.find(i => i.instanceId === prev.instanceId) || null : null));
      }
      if (data.length === 0 && !silent) notify('No instances found', 'error');
    } catch (err) {
      if (!silent) notify(err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Latest-state callback so the interval never uses a stale closure.
  const autoReloadRef = useRef(null);
  autoReloadRef.current = () => {
    if (document.hidden || loading || bulkRunning || busyIds.size > 0 || pendingBulk || confirmTermAll) return;
    load({ keepSelection: true, silent: true });
  };

  const hasInstances = instances.length > 0;
  useEffect(() => {
    if (!refreshSec || !hasInstances) return undefined;
    const timer = setInterval(() => autoReloadRef.current(), refreshSec * 1000);
    return () => clearInterval(timer);
  }, [refreshSec, hasInstances]);

  const handleRefreshChange = (value) => {
    const sec = Number(value);
    setRefreshSec(sec);
    try { localStorage.setItem(REFRESH_KEY, String(sec)); } catch {}
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
      setCheckedIds(new Set());
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

  const handleSecurityGroupsChange = (instanceId, securityGroups) => {
    setInstances(prev => prev.map(i => (i.instanceId === instanceId ? { ...i, securityGroups } : i)));
    setSelected(prev => (prev?.instanceId === instanceId ? { ...prev, securityGroups } : prev));
  };

  const handleRowAction = async (inst, action) => {
    const { label, call } = ACTIONS[action];
    const id = inst.instanceId;
    setBusyIds(prev => new Set(prev).add(id));
    try {
      await call(id, instanceRegion(inst));
      notify(`${label} successful: ${inst.name || id}`);
      await load({ keepSelection: true });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSort = (key) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  };

  const toggleChecked = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const running = instances.filter(i => i.state === 'running').length;
  const stopped = instances.filter(i => i.state === 'stopped').length;

  const applyFilter = (value) => {
    setStateFilter(value);
    if (!loading) load({ keepSelection: true });
  };
  const toggleFilter = (value) => applyFilter(stateFilter === value ? 'all' : value);

  const stats = [
    { label: 'Total', value: instances.length, onClick: () => applyFilter('all'), active: stateFilter === 'all' },
    { label: 'Running', value: running, tone: 'running', onClick: () => toggleFilter('running'), active: stateFilter === 'running' },
    { label: 'Stopped', value: stopped, tone: 'stopped', onClick: () => toggleFilter('stopped'), active: stateFilter === 'stopped' },
    { label: 'Other', value: instances.length - running - stopped, tone: 'warn', onClick: () => toggleFilter('other'), active: stateFilter === 'other' },
  ];

  const visibleInstances = useMemo(() => {
    const filtered = instances.filter(i => {
      if (stateFilter === 'all') return true;
      if (stateFilter === 'other') return i.state !== 'running' && i.state !== 'stopped';
      return i.state === stateFilter;
    });
    if (!sort.key) return filtered;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return factor * compareValues(av, bv);
    });
  }, [instances, stateFilter, sort]);

  const checkedVisible = visibleInstances.filter(i => checkedIds.has(i.instanceId));

  const toggleAll = (checkAll) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      visibleInstances.forEach(i => (checkAll ? next.add(i.instanceId) : next.delete(i.instanceId)));
      return next;
    });
  };

  const eligibleFor = (action) => {
    const from = ACTIONS[action].from;
    return from ? checkedVisible.filter(i => from.includes(i.state)) : checkedVisible;
  };

  const runBulk = async (action) => {
    const targets = eligibleFor(action);
    setPendingBulk(null);
    if (!targets.length) return;

    setBulkRunning(true);
    const results = await Promise.allSettled(targets.map(inst => {
      const reg = instanceRegion(inst);
      return action === 'terminate'
        ? api.terminateInstance(inst.instanceId, reg, { owner: inst.owner || normalizedOwner })
        : ACTIONS[action].call(inst.instanceId, reg);
    }));

    const failures = results
      .map((r, idx) => ({ r, inst: targets[idx] }))
      .filter(x => x.r.status === 'rejected');
    const okCount = targets.length - failures.length;

    if (failures.length === 0) {
      notify(`${ACTIONS[action].label} successful for ${okCount} instance(s)`);
    } else {
      const first = failures[0];
      notify(
        `${ACTIONS[action].label}: ${okCount} succeeded, ${failures.length} failed (${first.inst.instanceId}: ${first.r.reason?.message || 'error'})`,
        'error',
      );
    }

    // Keep only failed instances checked so they can be retried.
    setCheckedIds(new Set(failures.map(f => f.inst.instanceId)));
    setBulkRunning(false);
    await load({ keepSelection: true });
  };

  return (
    <div className="space-y-4">
      {/* 2-col grid on small screens, single wrapping row from md up; items-start keeps labels aligned */}
      <div className="brutal-panel grid grid-cols-2 gap-x-3 gap-y-4 md:flex md:flex-wrap md:items-start">
        <div className="min-w-0">
          <label className="brutal-label">Owner</label>
          <input
            value={owner}
            onChange={e => setOwner(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="BWAYNE"
            className="brutal-input w-full md:w-36"
          />
          <p className="mt-1 text-xs text-zinc-500">(case sensitive)</p>
        </div>
        <div className="min-w-0">
          <label className="brutal-label">Region</label>
          <select
            value={region}
            onChange={e => { setRegion(e.target.value); setInstances([]); setSelected(null); setCheckedIds(new Set()); }}
            className="brutal-input w-full md:w-auto"
          >
            {REGIONS.map(r => <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="brutal-label">Auto Reload</label>
          <select
            value={refreshSec}
            onChange={e => handleRefreshChange(e.target.value)}
            className="brutal-input w-full md:w-auto"
          >
            {REFRESH_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s === 0 ? 'Off' : s >= 60 ? `${s / 60} min` : `${s} sec`}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <span className="brutal-label invisible" aria-hidden="true">&nbsp;</span>
          <button
            onClick={() => load()}
            disabled={loading || !normalizedOwner}
            className="btn-accent w-full md:w-auto"
          >
            {loading ? 'Loading…' : 'Load Instances'}
          </button>
        </div>
        {instances.length > 0 && region !== 'all' && (
          <div className="col-span-2 min-w-0 md:col-span-1 md:ml-auto">
            <span className="brutal-label invisible hidden md:block" aria-hidden="true">&nbsp;</span>
            <button
              onClick={() => setConfirmTermAll(true)}
              className="btn-danger w-full md:w-auto"
            >
              ⚠ Terminate All ({normalizedOwner})
            </button>
          </div>
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
          <div className="w-full min-w-0 flex-1 space-y-3">
            {checkedVisible.length > 0 && (
              <div className="brutal-panel flex flex-wrap items-center gap-3 py-3">
                <span className="text-sm font-bold text-white">{checkedVisible.length} selected</span>
                {['start', 'stop', 'reboot', 'terminate'].map(action => {
                  const count = eligibleFor(action).length;
                  return (
                    <button
                      key={action}
                      onClick={() => setPendingBulk(action)}
                      disabled={bulkRunning || count === 0}
                      className={`${ACTIONS[action].color} px-3 py-1.5 text-xs`}
                    >
                      {ACTIONS[action].label} ({count})
                    </button>
                  );
                })}
                <button
                  onClick={() => setCheckedIds(new Set())}
                  disabled={bulkRunning}
                  className="btn-neutral px-3 py-1.5 text-xs ml-auto"
                >
                  Clear
                </button>
              </div>
            )}
            <InstanceTable
              instances={visibleInstances}
              selected={selected}
              onSelect={setSelected}
              sort={sort}
              onSort={handleSort}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
              onToggleAll={toggleAll}
              onAction={handleRowAction}
              busyIds={busyIds}
            />
          </div>

          {selected && (
            <div className="w-full xl:w-[480px] xl:shrink-0 xl:sticky xl:top-[90px] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto scrollbar-none">
              <InstanceActions
                instance={selected}
                region={region === 'all' ? (selected.region || region) : region}
                notify={notify}
                terminateScope={{ owner: selected.owner || normalizedOwner }}
                onDone={handleDone}
                onSecurityGroupsChange={handleSecurityGroupsChange}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </div>
      )}

      {pendingBulk && (
        <ConfirmDialog
          message={`${ACTIONS[pendingBulk].label} ${eligibleFor(pendingBulk).length} selected instance(s)?${pendingBulk === 'terminate' ? ' This cannot be undone.' : ''}`}
          previewTitle={`Instances to ${pendingBulk} (${eligibleFor(pendingBulk).length})`}
          previewItems={eligibleFor(pendingBulk).map(inst => ({
            primary: inst.instanceId,
            secondary: `${inst.name || 'Unnamed'} | ${inst.state || 'unknown'} | ${instanceRegion(inst)}`,
          }))}
          confirmLabel={ACTIONS[pendingBulk].label}
          danger={pendingBulk === 'terminate'}
          onConfirm={() => runBulk(pendingBulk)}
          onCancel={() => setPendingBulk(null)}
        />
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
