import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';
import SecurityGroupPanel from './SecurityGroupPanel';
import InstanceTags from './InstanceTags';

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.stopPropagation();
    const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        markCopied();
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px';
      document.body.appendChild(ta);
      ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
      if (document.execCommand('copy')) markCopied();
      ta.blur(); document.body.removeChild(ta);
      window.getSelection()?.removeAllRanges();
    } catch {}
  };

  return (
    <button onClick={copy} title="Copy" className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-accent">
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

function ActionButton({ label, onClick, loading, color = 'blue' }) {
  const colors = {
    blue:   'btn-info',
    green:  'btn-success',
    yellow: 'btn-warn',
    red:    'btn-danger',
  };
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className={`${colors[color]} px-3 py-1.5 text-xs`}
    >
      {loading ? '…' : label}
    </button>
  );
}

const STATE_BADGE = {
  running: 'bg-emerald-500 text-black',
  stopped: 'bg-red-500 text-black',
  pending: 'bg-amber-400 text-black',
  stopping: 'bg-amber-400 text-black',
  'shutting-down': 'bg-amber-400 text-black',
  terminated: 'bg-zinc-500 text-black',
};

function DetailField({ label, value, mono, copy }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className={`group flex items-center gap-1.5 text-sm text-zinc-100 ${mono ? 'font-mono' : ''}`}>
        <span className="truncate">{value}</span>
        {copy && <CopyButton value={value} />}
      </dd>
    </div>
  );
}

function ProtectionBadge({ on, label }) {
  return (
    <span className={`brutal-badge ${on ? 'bg-emerald-500 text-black border-black' : 'bg-ink text-zinc-400 border-edge'}`}>
      {label}: {on ? 'ON' : 'OFF'}
    </span>
  );
}

export default function InstanceActions({ instance, region, notify, onDone, onClose, terminateScope = null }) {
  const [busy, setBusy] = useState('');
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [selectedSgId, setSelectedSgId] = useState('');
  const [protection, setProtection] = useState(null);

  useEffect(() => {
    api.getInstanceProtection(instance.instanceId, region)
      .then(setProtection)
      .catch(() => {});
  }, [instance.instanceId, region]);

  const run = async (label, fn, done = false) => {
    setBusy(label);
    try {
      await fn();
      notify(`${label} successful`);
      if (done) onDone();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="brutal-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b-2 border-edge bg-surface">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white uppercase tracking-tight truncate">{instance.name || instance.instanceId}</h2>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">{instance.instanceId}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none shrink-0">✕</button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {instance.state && (
            <span className={`brutal-badge border-black ${STATE_BADGE[instance.state] || 'bg-zinc-500 text-black'}`}>{instance.state}</span>
          )}
          {protection && <ProtectionBadge on={protection.terminationProtection} label="Term Protect" />}
          {protection && <ProtectionBadge on={protection.stopProtection} label="Stop Protect" />}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
          <DetailField label="Type" value={instance.instanceType} />
          <DetailField label="Region" value={region} mono />
          <DetailField label="Owner" value={instance.owner} />
          <DetailField label="Public IP" value={instance.publicIp} mono copy />
          <DetailField label="Private IP" value={instance.privateIp} mono copy />
          <DetailField label="VPC" value={instance.vpcId} mono />
          <DetailField label="Public DNS" value={instance.publicDns} mono copy />
          <DetailField label="Private DNS" value={instance.privateDns} mono copy />
        </dl>
      </div>

      <div className="p-5 space-y-5">
        {/* Power */}
        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Power</h3>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Start" loading={busy === 'Start'} color="green"
              onClick={() => run('Start', () => api.startInstance(instance.instanceId, region), true)} />
            <ActionButton label="Stop" loading={busy === 'Stop'} color="yellow"
              onClick={() => run('Stop', () => api.stopInstance(instance.instanceId, region), true)} />
            <ActionButton label="Reboot" loading={busy === 'Reboot'} color="yellow"
              onClick={() => run('Reboot', () => api.rebootInstance(instance.instanceId, region), true)} />
          </div>
        </section>

        {/* Protection */}
        <section>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Stop / Terminate Protection</h3>
          <div className="flex gap-2">
            <ActionButton label="Enable Protection" loading={busy === 'Enable Protection'}
              onClick={() => run('Enable Protection', () => api.setProtection(instance.instanceId, true, region))} />
            <ActionButton label="Disable Protection" loading={busy === 'Disable Protection'} color="yellow"
              onClick={() => run('Disable Protection', () => api.setProtection(instance.instanceId, false, region))} />
          </div>
        </section>

        {/* Tags */}
        <InstanceTags instanceId={instance.instanceId} region={region} notify={notify} />

        {/* Security Groups */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Security Groups</h3>
            {instance.securityGroups.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Click a group to inspect &amp; manage</span>
            )}
          </div>
          {instance.securityGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {instance.securityGroups.map(sg => {
                const active = selectedSgId === sg.groupId;
                return (
                  <button
                    key={sg.groupId}
                    onClick={() => setSelectedSgId(active ? '' : sg.groupId)}
                    title={sg.groupName}
                    className={`flex items-center gap-2 px-2.5 py-1.5 border-2 text-xs font-mono font-bold transition-colors ${
                      active
                        ? 'bg-accent text-black border-black'
                        : 'bg-ink text-zinc-200 border-edge hover:border-accent'
                    }`}
                  >
                    <span>{sg.groupId}</span>
                    {sg.groupName && <span className={active ? 'text-black/70' : 'text-zinc-500'}>{sg.groupName}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No security groups attached</p>
          )}
          <SecurityGroupPanel
            instance={instance}
            region={region}
            notify={notify}
            selectedSgId={selectedSgId}
            setSelectedSgId={setSelectedSgId}
          />
        </section>

        {/* Danger Zone */}
        <section className="border-t-2 border-edge pt-4">
          <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Danger Zone</h3>
          <button
            onClick={() => setConfirmTerminate(true)}
            disabled={!!busy}
            className="btn-danger"
          >
            ⚠ Terminate Instance
          </button>
        </section>
      </div>

      {confirmTerminate && (
        <ConfirmDialog
          message={`Permanently terminate "${instance.name || instance.instanceId}"? This cannot be undone.`}
          previewTitle="Instance to terminate"
          previewItems={[
            {
              primary: instance.instanceId,
              secondary: `${instance.name || 'Unnamed'} | ${region}`,
            },
          ]}
          confirmLabel="Terminate"
          danger
          onConfirm={() => {
            setConfirmTerminate(false);
            run('Terminate', () => api.terminateInstance(instance.instanceId, region, terminateScope || {}), true);
          }}
          onCancel={() => setConfirmTerminate(false)}
        />
      )}
    </div>
  );
}
