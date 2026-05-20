import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmDialog from './ConfirmDialog';

const DEFAULT_VPC = 'vpc-6e7f1d06';

export default function SecurityGroupPanel({ instance, region, notify }) {
  const [selectedSgId, setSelectedSgId] = useState(instance.securityGroups[0]?.groupId || '');
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
    if (selectedSgId) loadSgDetails();
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
    <div className="bg-gray-900 rounded-lg border border-gray-600 p-4 mt-2 space-y-4">

      {/* SG selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Select Security Group to Inspect</label>
        <div className="flex gap-2">
          <input
            value={selectedSgId}
            onChange={e => setSelectedSgId(e.target.value)}
            placeholder="sg-..."
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400 flex-1 max-w-xs"
          />
          <button
            onClick={loadSgDetails}
            className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded text-xs transition-colors"
          >
            Load
          </button>
        </div>
        {/* Quick-select from instance's current SGs */}
        {instance.securityGroups.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {instance.securityGroups.map(sg => (
              <button
                key={sg.groupId}
                onClick={() => setSelectedSgId(sg.groupId)}
                className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
                  selectedSgId === sg.groupId
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {sg.groupId}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SG Details */}
      {loadingSg && <p className="text-xs text-gray-400">Loading…</p>}
      {sgDetails && !loadingSg && (
        <div className="space-y-3 border-t border-gray-700 pt-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs space-y-0.5">
              <span className="font-medium text-white">{sgDetails.groupName}</span>
              {sgDetails.description && <span className="text-gray-400 ml-2">{sgDetails.description}</span>}
              <div className="text-gray-500 font-mono">VPC: {sgDetails.vpcId}</div>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs bg-red-900 hover:bg-red-800 border border-red-700 px-2 py-1 rounded transition-colors flex-shrink-0"
            >
              Delete SG
            </button>
          </div>

          {/* Ingress Rules */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ingress Rules</h4>
            {sgDetails.rules.length === 0 ? (
              <p className="text-xs text-gray-500">No ingress rules</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 text-left">
                      <th className="pb-1 pr-4">CIDR</th>
                      <th className="pb-1 pr-4">Description</th>
                      <th className="pb-1 pr-4">Protocol</th>
                      <th className="pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sgDetails.rules.map((rule, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        <td className="py-1.5 pr-4 font-mono text-gray-200">{rule.cidr}</td>
                        <td className="py-1.5 pr-4 text-gray-400">{rule.description || '—'}</td>
                        <td className="py-1.5 pr-4 text-gray-500">
                          {rule.protocol === '-1' ? 'All traffic' : `${rule.protocol} ${rule.fromPort}–${rule.toPort}`}
                        </td>
                        <td className="py-1.5">
                          <button
                            onClick={() => handleRevoke(rule.cidr)}
                            className="text-red-400 hover:text-red-300 transition-colors"
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
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Add IP</h4>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1">
                <input
                  value={addIp}
                  onChange={e => setAddIp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddIp()}
                  placeholder="1.2.3.4"
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-orange-400 w-32"
                />
                <button
                  onClick={handleUseMyIp}
                  className="bg-gray-600 hover:bg-gray-500 px-2 py-1.5 rounded text-xs transition-colors whitespace-nowrap"
                >
                  My IP
                </button>
              </div>
              <input
                value={addDesc}
                onChange={e => setAddDesc(e.target.value)}
                placeholder="Username / description"
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 w-48"
              />
              <button
                onClick={handleAddIp}
                disabled={!addIp || addingIp}
                className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-3 py-1.5 rounded text-xs font-medium transition-colors"
              >
                {addingIp ? '…' : 'Add IP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach SG to Instance */}
      <div className="border-t border-gray-700 pt-3">
        <button
          onClick={() => setShowAttach(v => !v)}
          className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          {showAttach ? '▲ Hide' : '▼ Attach SG to this Instance'}
        </button>
        {showAttach && (
          <div className="mt-2 flex gap-2">
            <input
              value={attachSgId}
              onChange={e => setAttachSgId(e.target.value)}
              placeholder="sg-..."
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-orange-400 w-48"
            />
            <button
              onClick={handleAttach}
              disabled={!attachSgId}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-3 py-1.5 rounded text-xs font-medium transition-colors"
            >
              Attach
            </button>
          </div>
        )}
      </div>

      {/* Create New SG */}
      <div className="border-t border-gray-700 pt-3">
        <button
          onClick={() => setShowCreate(v => !v)}
          className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          {showCreate ? '▲ Hide' : '▼ Create New Security Group'}
        </button>
        {showCreate && (
          <div className="mt-2 space-y-2 max-w-sm">
            <input
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Group name"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
            <input
              value={createDesc}
              onChange={e => setCreateDesc(e.target.value)}
              placeholder="Description"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
            <input
              value={createVpc}
              onChange={e => setCreateVpc(e.target.value)}
              placeholder="VPC ID"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-orange-400"
            />
            <button
              onClick={handleCreateSg}
              disabled={!createName || !createDesc}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 px-3 py-1.5 rounded text-xs font-medium transition-colors"
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
