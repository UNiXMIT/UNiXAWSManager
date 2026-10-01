import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';
import CopyButton from './CopyButton';

export default function SecurityGroupPanel({ instance, region, notify, selectedSgId, setSelectedSgId, securityGroups, onGroupsChange }) {
  const [sgDetails, setSgDetails] = useState(null);
  const [loadingSg, setLoadingSg] = useState(false);

  // Add IP form
  const [addIp, setAddIp] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addingIp, setAddingIp] = useState(false);

  // Attach SG form
  const [showAttach, setShowAttach] = useState(false);
  const [attachSgId, setAttachSgId] = useState('');

  const [confirmDetach, setConfirmDetach] = useState(false);

  const attachedIds = securityGroups.map(sg => sg.groupId);
  const isAttached = attachedIds.includes(selectedSgId);
  const isOnlyGroup = isAttached && attachedIds.length === 1;

  useEffect(() => {
    if (selectedSgId) {
      loadSgDetails();
    } else {
      setSgDetails(null);
    }
  }, [selectedSgId]);

  const loadSgDetails = async () => {
    setLoadingSg(true);
    setSgDetails(null);
    try {
      const data = await api.getSgDetails(selectedSgId, region);
      setSgDetails(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoadingSg(false);
    }
  };

  const handleUseMyIp = async () => {
    try {
      const { ip } = await api.getMyIp();
      setAddIp(ip);
    } catch {
      notify('Could not fetch your public IP', 'error');
    }
  };

  const handleAddIp = async () => {
    if (!addIp) return;
    setAddingIp(true);
    try {
      await api.addIpToSg(selectedSgId, addIp, addDesc, region);
      notify(`Added ${addIp} to ${selectedSgId}`);
      setAddIp('');
      setAddDesc('');
      loadSgDetails();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setAddingIp(false);
    }
  };

  const handleRevoke = async (cidr) => {
    try {
      await api.revokeIpFromSg(selectedSgId, cidr, region);
      notify(`Revoked ${cidr}`);
      loadSgDetails();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDetachSg = async () => {
    const remaining = attachedIds.filter(id => id !== selectedSgId);
    try {
      await api.attachSgToInstance(instance.instanceId, remaining, region);
      notify(`Detached ${selectedSgId} from ${instance.instanceId}`);
      onGroupsChange(securityGroups.filter(sg => sg.groupId !== selectedSgId));
      setSelectedSgId('');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setConfirmDetach(false);
    }
  };

  const handleAttach = async () => {
    if (!attachSgId) return;
    if (attachedIds.includes(attachSgId)) {
      notify('That security group is already attached', 'error');
      return;
    }
    try {
      await api.attachSgToInstance(instance.instanceId, [...attachedIds, attachSgId], region);
      notify(`Attached ${attachSgId} to ${instance.instanceId}`);
      const groupName = await api.getSgDetails(attachSgId, region).then(d => d.groupName).catch(() => '');
      onGroupsChange([...securityGroups, { groupId: attachSgId, groupName }]);
      setAttachSgId('');
      setShowAttach(false);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="bg-surface border-2 border-edge p-4 mt-3 space-y-4">

      {/* SG Details */}
      {loadingSg && <p className="text-xs text-zinc-400">Loading…</p>}
      {selectedSgId && sgDetails && !loadingSg && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-white">{sgDetails.groupName}</span>
              {sgDetails.description && <span className="text-zinc-400 ml-2">{sgDetails.description}</span>}
              <div className="group flex items-center gap-1.5 text-zinc-500 font-mono">
                <span>SG: {sgDetails.groupId}</span>
                <CopyButton value={sgDetails.groupId} title="Copy security group ID" />
              </div>
              <div className="group flex items-center gap-1.5 text-zinc-500 font-mono">
                <span>VPC: {sgDetails.vpcId}</span>
                <CopyButton value={sgDetails.vpcId} title="Copy VPC ID" />
              </div>
            </div>
            {isAttached && (
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <button
                  onClick={() => setConfirmDetach(true)}
                  disabled={isOnlyGroup}
                  title={isOnlyGroup
                    ? 'An instance must keep at least one security group'
                    : 'Remove this security group from the instance (the group itself is kept)'}
                  className="btn-warn px-2 py-1 text-xs"
                >
                  Detach
                </button>
                {isOnlyGroup && (
                  <span className="text-[10px] text-zinc-500 text-right">Only group attached</span>
                )}
              </div>
            )}
          </div>

          {/* Ingress Rules */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Ingress Rules</h4>
            {sgDetails.rules.length === 0 ? (
              <p className="text-xs text-zinc-500">No ingress rules</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-400 text-left uppercase">
                      <th className="pb-1 pr-4">CIDR</th>
                      <th className="pb-1 pr-4">Description</th>
                      <th className="pb-1 pr-4">Protocol</th>
                      <th className="pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sgDetails.rules.map((rule, i) => (
                      <tr key={i} className="border-t border-zinc-800">
                        <td className="py-1.5 pr-4 font-mono text-zinc-200">{rule.cidr}</td>
                        <td className="py-1.5 pr-4 text-zinc-400">{rule.description || '—'}</td>
                        <td className="py-1.5 pr-4 text-zinc-500">
                          {rule.protocol === '-1' ? 'All traffic' : `${rule.protocol} ${rule.fromPort}–${rule.toPort}`}
                        </td>
                        <td className="py-1.5">
                          <button
                            onClick={() => handleRevoke(rule.cidr)}
                            className="text-red-400 hover:text-red-300 font-bold uppercase transition-colors"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add IP */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Add IP</h4>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1">
                <input
                  value={addIp}
                  onChange={e => setAddIp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddIp()}
                  placeholder="1.2.3.4"
                  className="brutal-input text-xs font-mono w-32 py-1.5"
                />
                <button
                  onClick={handleUseMyIp}
                  className="btn-neutral px-2 py-1.5 text-xs whitespace-nowrap"
                >
                  My IP
                </button>
              </div>
              <input
                value={addDesc}
                onChange={e => setAddDesc(e.target.value)}
                placeholder="Username / description"
                className="brutal-input text-xs w-48 py-1.5"
              />
              <button
                onClick={handleAddIp}
                disabled={!addIp || addingIp}
                className="btn-info px-3 py-1.5 text-xs"
              >
                {addingIp ? '…' : 'Add IP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedSgId && !loadingSg && instance.securityGroups.length > 0 && (
        <p className="text-xs text-zinc-500">Select a security group above to view and edit its ingress rules.</p>
      )}

      {/* Attach SG to Instance */}
      <div className="border-t-2 border-edge pt-3">
        <button
          onClick={() => setShowAttach(v => !v)}
          className="text-xs font-bold uppercase text-accent hover:text-accent-hover transition-colors"
        >
          {showAttach ? '▲' : '▼'} Attach SG to this Instance
        </button>
        {showAttach && (
          <div className="mt-2 flex gap-2">
            <input
              value={attachSgId}
              onChange={e => setAttachSgId(e.target.value)}
              placeholder="sg-..."
              className="brutal-input text-xs font-mono w-48 py-1.5"
            />
            <button
              onClick={handleAttach}
              disabled={!attachSgId}
              className="btn-info px-3 py-1.5 text-xs"
            >
              Attach
            </button>
          </div>
        )}
      </div>

      {confirmDetach && (
        <ConfirmDialog
          message={`Detach ${selectedSgId} from ${instance.instanceId}? The security group itself is not deleted, but its rules will no longer apply to this instance.`}
          confirmLabel="Detach"
          onConfirm={handleDetachSg}
          onCancel={() => setConfirmDetach(false)}
        />
      )}
    </div>
  );
}
