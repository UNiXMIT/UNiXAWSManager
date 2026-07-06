import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';
import SecurityGroupPanel from './SecurityGroupPanel';

function ActionButton({ label, onClick, loading, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-700 hover:bg-blue-600',
    green:  'bg-[#45A56F] hover:bg-[#3d9463]',
    yellow: 'bg-[#F9B13A] hover:bg-[#e09a28] text-gray-900',
    red:    'bg-[#D90000] hover:bg-[#b80000]',
  };
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className={`px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      {loading ? '…' : label}
    </button>
  );
}

export default function InstanceActions({ instance, region, notify, onDone, onClose, terminateScope = null }) {
  const [busy, setBusy] = useState('');
  const [newName, setNewName] = useState(instance.name);
  const [newOwner, setNewOwner] = useState(instance.owner);
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [showSgs, setShowSgs] = useState(false);
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
    <div className="bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-700">
        <div>
          <h2 className="text-base font-semibold text-white">{instance.name || instance.instanceId}</h2>
          <p className="text-xs font-mono text-gray-400 mt-0.5">{instance.instanceId}</p>
          <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-gray-500">
            {instance.publicIp && <span>Public IP: <span className="text-gray-300 font-mono">{instance.publicIp}</span></span>}
            {instance.privateIp && <span>Private IP: <span className="text-gray-300 font-mono">{instance.privateIp}</span></span>}
            {instance.instanceType && <span>Type: <span className="text-gray-300">{instance.instanceType}</span></span>}
            {instance.vpcId && <span>VPC: <span className="text-gray-300 font-mono">{instance.vpcId}</span></span>}
            {instance.publicDns && <span>Public DNS: <span className="text-gray-300 font-mono">{instance.publicDns}</span></span>}
            {instance.privateDns && <span>Private DNS: <span className="text-gray-300 font-mono">{instance.privateDns}</span></span>}
            {protection && (
              <span className={`font-medium ${protection.terminationProtection ? 'text-[#45A56F]' : 'text-gray-600'}`}>
                Termination Protection: {protection.terminationProtection ? 'ON' : 'OFF'}
              </span>
            )}
            {protection && (
              <span className={`font-medium ${protection.stopProtection ? 'text-[#45A56F]' : 'text-gray-600'}`}>
                Stop Protection: {protection.stopProtection ? 'ON' : 'OFF'}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none ml-4">✕</button>
      </div>

      <div className="p-5 space-y-5">
        {/* Power */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Power</h3>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Start" loading={busy === 'Start'} color="green"
              onClick={() => run('Start', () => api.startInstance(instance.instanceId, region), true)} />
            <ActionButton label="Stop" loading={busy === 'Stop'} color="yellow"
              onClick={() => run('Stop', () => api.stopInstance(instance.instanceId, region), true)} />
            <ActionButton label="Reboot" loading={busy === 'Reboot'} color="yellow"
              onClick={() => run('Reboot', () => api.rebootInstance(instance.instanceId, region), true)} />
          </div>
        </section>

        {/* Rename */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rename</h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400 flex-1 max-w-xs"
            />
            <ActionButton label="Rename" loading={busy === 'Rename'}
              onClick={() => run('Rename', () => api.renameInstance(instance.instanceId, newName, region))} />
          </div>
        </section>

        {/* Change Owner */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Change Owner</h3>
          <div className="flex gap-2">
            <input
              value={newOwner}
              onChange={e => setNewOwner(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400 flex-1 max-w-xs"
            />
            <ActionButton label="Change Owner" loading={busy === 'Change Owner'}
              onClick={() => run('Change Owner', () => api.changeOwner(instance.instanceId, newOwner, region))} />
          </div>
        </section>

        {/* Protection */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Stop / Terminate Protection</h3>
          <div className="flex gap-2">
            <ActionButton label="Enable Protection" loading={busy === 'Enable Protection'}
              onClick={() => run('Enable Protection', () => api.setProtection(instance.instanceId, true, region))} />
            <ActionButton label="Disable Protection" loading={busy === 'Disable Protection'} color="yellow"
              onClick={() => run('Disable Protection', () => api.setProtection(instance.instanceId, false, region))} />
          </div>
        </section>

        {/* Security Groups */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Security Groups</h3>
            <button
              onClick={() => setShowSgs(v => !v)}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              {showSgs ? '▲ Hide' : '▼ Manage'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {instance.securityGroups.length > 0 ? instance.securityGroups.map(sg => (
              <span key={sg.groupId} className="bg-gray-700 border border-gray-600 px-2 py-1 rounded text-xs font-mono text-gray-300">
                {sg.groupId} <span className="text-gray-500">({sg.groupName})</span>
              </span>
            )) : <span className="text-xs text-gray-500">No security groups</span>}
          </div>
          {showSgs && (
            <SecurityGroupPanel instance={instance} region={region} notify={notify} />
          )}
        </section>

        {/* Danger Zone */}
        <section className="border-t border-gray-700 pt-4">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Danger Zone</h3>
          <button
            onClick={() => setConfirmTerminate(true)}
            disabled={!!busy}
            className="bg-red-900 hover:bg-red-800 border border-red-700 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
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
