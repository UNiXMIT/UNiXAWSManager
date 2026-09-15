import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export default function InstanceTags({ instanceId, region, notify }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [drafts, setDrafts] = useState({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getInstanceTags(instanceId, region);
      setTags(data);
      setDrafts(Object.fromEntries(data.map(t => [t.key, t.value])));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [instanceId, region, notify]);

  useEffect(() => { load(); }, [load]);

  const saveTag = async (key) => {
    const value = drafts[key] ?? '';
    setBusyKey(key);
    try {
      await api.setInstanceTags(instanceId, [{ key, value }], region);
      notify(`Tag "${key}" updated`);
      await load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyKey('');
    }
  };

  const removeTag = async (key) => {
    setBusyKey(key);
    try {
      await api.deleteInstanceTags(instanceId, [key], region);
      notify(`Tag "${key}" removed`);
      await load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyKey('');
    }
  };

  const addTag = async () => {
    const key = newKey.trim();
    if (!key) { notify('Tag key is required', 'error'); return; }
    setAdding(true);
    try {
      await api.setInstanceTags(instanceId, [{ key, value: newValue }], region);
      notify(`Tag "${key}" added`);
      setNewKey('');
      setNewValue('');
      await load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tags</h3>
        {loading && <span className="text-[10px] uppercase tracking-wider text-zinc-600">Loading…</span>}
      </div>

      <div className="space-y-2">
        {tags.length === 0 && !loading && (
          <p className="text-xs text-zinc-500">No tags</p>
        )}
        {tags.map(tag => {
          const dirty = (drafts[tag.key] ?? '') !== tag.value;
          const busy = busyKey === tag.key;
          return (
            <div key={tag.key} className="flex items-center gap-2">
              <span
                title={tag.key}
                className="w-32 shrink-0 truncate font-mono text-xs font-bold text-zinc-300"
              >
                {tag.key}
              </span>
              <input
                value={drafts[tag.key] ?? ''}
                onChange={e => setDrafts(d => ({ ...d, [tag.key]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && dirty && saveTag(tag.key)}
                className="brutal-input flex-1 min-w-0 text-xs"
              />
              <button
                onClick={() => saveTag(tag.key)}
                disabled={busy || !dirty}
                className="btn-info px-2 py-1 text-xs"
              >
                {busy ? '…' : 'Save'}
              </button>
              <button
                onClick={() => removeTag(tag.key)}
                disabled={busy}
                title="Remove tag"
                className="btn-danger px-2 py-1 text-xs"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-edge">
        <input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder="Key"
          className="brutal-input w-32 shrink-0 text-xs"
        />
        <input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTag()}
          placeholder="Value"
          className="brutal-input flex-1 min-w-0 text-xs"
        />
        <button
          onClick={addTag}
          disabled={adding || !newKey.trim()}
          className="btn-success px-2 py-1 text-xs"
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
    </section>
  );
}
