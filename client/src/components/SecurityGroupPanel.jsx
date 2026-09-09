import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';

const DEFAULT_VPC = 'vpc-6e7f1d06';

export default function SecurityGroupPanel({ instance, region, notify, selectedSgId, setSelectedSgId }) {
  const [sgDetails, setSgDetails] = useState(null);
  const [loadingSg, setLoadingSg] = useState(false);

  // Add IP form
  const [addIp, setAddIp] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addingIp, setAddingIp] = useState(false);

  // Create SG form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createVpc, setCreateVpc] = useState(DEFAULT_VPC);

  // Attach SG form
  const [showAttach, setShowAttach] = useState(false);
  const [attachSgId, setAttachSgId] = useState('');

  // Confirm delete SG
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDeleteSg = async () => {
    try {
      await api.deleteSg(selectedSgId, region);
      notify(`Deleted ${selectedSgId}`);
      setSelectedSgId(instance.securityGroups.filter(sg => sg.groupId !== selectedSgId)[0]?.groupId || '');
      setSgDetails(null);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setConfirmDelete(false);
    }
  };

  const handleCreateSg = async () => {
    if (!createName || !createDesc) return;
    try {
      const { groupId } = await api.createSg(createName, createDesc, createVpc, region);
      notify(`Created ${groupId}`);
      setCreateName('');
      setCreateDesc('');
      setShowCreate(false);
      setSelectedSgId(groupId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleAttach = async () => {
    if (!attachSgId) return;
    const existing = instance.securityGroups.map(sg => sg.groupId);
    if (existing.includes(attachSgId)) {
      notify('That security group is already attached', 'error');
      return;
    }
    try {
      await api.attachSgToInstance(instance.instanceId, [...existing, attachSgId], region);
      notify(`Attached ${attachSgId} to ${instance.instanceId}`);
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
              <div className="text-zinc-500 font-mono">VPC: {sgDetails.vpcId}</div>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-danger px-2 py-1 text-xs flex-shrink-0"
            >
              Delete SG
            </button>
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
          {showAttach ? '▲ Hide' : '▼ Attach SG to this Instance'}
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

      {/* Create New SG */}
      <div className="border-t-2 border-edge pt-3">
        <button
          onClick={() => setShowCreate(v => !v)}
          className="text-xs font-bold uppercase text-accent hover:text-accent-hover transition-colors"
        >
          {showCreate ? '▲ Hide' : '▼ Create New Security Group'}
        </button>
        {showCreate && (
          <div className="mt-2 space-y-2 max-w-sm">
            <input
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Group name"
              className="brutal-input w-full text-xs py-1.5"
            />
            <input
              value={createDesc}
              onChange={e => setCreateDesc(e.target.value)}
              placeholder="Description"
              className="brutal-input w-full text-xs py-1.5"
            />
            <input
              value={createVpc}
              onChange={e => setCreateVpc(e.target.value)}
              placeholder="VPC ID"
              className="brutal-input w-full text-xs font-mono py-1.5"
            />
            <button
              onClick={handleCreateSg}
              disabled={!createName || !createDesc}
              className="btn-success px-3 py-1.5 text-xs"
            >
              Create Security Group
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete security group ${selectedSgId}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteSg}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
