import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

function formatDuration(seconds) {
  if (seconds % 86400 === 0) return `${seconds / 86400} day(s)`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour(s)`;
  return `${Math.round(seconds / 60)} minute(s)`;
}

// Breadcrumb segments for a key prefix like "logs/2024/" -> [{label, prefix}, ...]
function crumbsFor(prefix) {
  const parts = prefix.split('/').filter(Boolean);
  let acc = '';
  return parts.map(part => {
    acc += `${part}/`;
    return { label: part, prefix: acc };
  });
}

export default function S3Tab({ notify }) {
  const { s3Bucket, s3Region, s3Expiry, hasAwsCreds } = useConfig();
  const [prefix, setPrefix] = useState('');
  const [folders, setFolders] = useState([]);
  const [objects, setObjects] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [presigned, setPresigned] = useState(null);
  const [signingKey, setSigningKey] = useState(null);

  const load = useCallback(async (targetPrefix, token = null) => {
    if (!s3Bucket) {
      notify('No S3 bucket configured. Set one in Settings.', 'error');
      return;
    }
    if (!hasAwsCreds) {
      notify('No AWS credentials configured.', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await api.s3ListObjects(s3Bucket, targetPrefix, s3Region, token);
      setFolders(prev => (token ? [...prev, ...data.folders] : data.folders));
      setObjects(prev => (token ? [...prev, ...data.objects] : data.objects));
      setNextToken(data.nextToken);
    } catch (err) {
      notify(err.message, 'error');
      if (!token) {
        setFolders([]);
        setObjects([]);
        setNextToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [s3Bucket, s3Region, hasAwsCreds, notify]);

  useEffect(() => {
    if (s3Bucket && hasAwsCreds) load(prefix);
    // Reloading on prefix change is the whole navigation model here.
  }, [load, prefix, s3Bucket, hasAwsCreds]);

  const navigate = (target) => {
    setFilter('');
    setPresigned(null);
    setPrefix(target);
  };

  const handlePresign = async (key) => {
    setSigningKey(key);
    try {
      const data = await api.s3Presign(s3Bucket, key, s3Region, s3Expiry);
      setPresigned({ key, ...data });
      notify(`Presigned URL generated (valid ${formatDuration(data.expiresIn)})`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSigningKey(null);
    }
  };

  const copyUrl = async () => {
    if (!presigned) return;
    try {
      await navigator.clipboard.writeText(presigned.url);
      notify('URL copied to clipboard');
    } catch {
      notify('Copy failed — select the URL and copy manually.', 'error');
    }
  };

  const term = filter.trim().toLowerCase();
  const visibleFolders = useMemo(
    () => folders.filter(f => !term || f.toLowerCase().includes(term)),
    [folders, term]
  );
  const visibleObjects = useMemo(
    () => objects.filter(o => !term || o.name.toLowerCase().includes(term)),
    [objects, term]
  );

  const crumbs = crumbsFor(prefix);

  if (!s3Bucket) {
    return (
      <div className="text-center text-zinc-500 py-16 font-medium">
        No bucket configured. Set an <span className="text-accent font-bold">S3 bucket</span> in Settings.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="brutal-panel flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[12rem]">
          <label className="brutal-label">Filter</label>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter this folder…"
            className="brutal-input w-full"
            spellCheck={false}
          />
        </div>
        <button onClick={() => load(prefix)} disabled={loading} className="btn-accent">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <span className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
          URLs valid {formatDuration(s3Expiry)}
        </span>
      </div>

      <div className="brutal-card px-4 py-2 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => navigate('')} className="font-bold text-accent hover:underline">
          {s3Bucket}
        </button>
        {crumbs.map(c => (
          <span key={c.prefix} className="flex items-center gap-2">
            <span className="text-zinc-500">/</span>
            <button onClick={() => navigate(c.prefix)} className="text-zinc-300 hover:text-white hover:underline">
              {c.label}
            </button>
          </span>
        ))}
      </div>

      {presigned && (
        <div className="brutal-card bg-surface border-l-4 border-l-accent px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Presigned URL</h3>
            <span className="brutal-badge border-black bg-green-400 text-black">
              Expires {new Date(presigned.expiresAt).toLocaleString('en-GB')}
            </span>
            <button onClick={() => setPresigned(null)} className="btn-neutral ml-auto">Dismiss</button>
          </div>
          <p className="text-xs text-zinc-400 font-mono break-all">{presigned.key}</p>
          <textarea
            readOnly
            value={presigned.url}
            rows={3}
            onFocus={e => e.target.select()}
            className="brutal-input w-full font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={copyUrl} className="btn-accent">Copy URL</button>
            <a href={presigned.url} target="_blank" rel="noopener noreferrer" className="btn-neutral">
              Open
            </a>
          </div>
        </div>
      )}

      <div className="brutal-card overflow-hidden">
        <div className="px-4 py-2 border-b-2 border-edge text-xs text-zinc-400 uppercase font-bold tracking-wider bg-surface">
          {visibleFolders.length} folder(s), {visibleObjects.length} file(s)
          {prefix ? ` in ${prefix}` : ' at bucket root'}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="text-left text-zinc-400 border-b-2 border-edge uppercase text-xs tracking-wider">
                <th className="min-w-[18rem] px-4 py-3 font-bold">Name</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Size</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Last Modified</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prefix && (
                <tr className="border-b border-zinc-800 hover:bg-surface">
                  <td colSpan={4} className="px-4 py-3">
                    <button
                      onClick={() => navigate(crumbs.length > 1 ? crumbs[crumbs.length - 2].prefix : '')}
                      className="font-bold text-accent hover:underline"
                    >
                      ../
                    </button>
                  </td>
                </tr>
              )}
              {visibleFolders.map(folder => (
                <tr key={folder} className="border-b border-zinc-800 hover:bg-surface">
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(folder)} className="font-bold text-white hover:text-accent hover:underline">
                      📁 {folder.slice(prefix.length)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">—</td>
                  <td className="px-4 py-3 text-zinc-500">—</td>
                  <td className="px-4 py-3" />
                </tr>
              ))}
              {visibleObjects.map(obj => (
                <tr key={obj.key} className="border-b border-zinc-800 last:border-0 hover:bg-surface">
                  <td className="min-w-[18rem] px-4 py-3 font-mono text-zinc-200 text-xs break-all">{obj.name}</td>
                  <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{formatSize(obj.size)}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                    {obj.lastModified ? new Date(obj.lastModified).toLocaleString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handlePresign(obj.key)}
                      disabled={signingKey === obj.key}
                      className="btn-accent whitespace-nowrap"
                    >
                      {signingKey === obj.key ? 'Signing…' : 'Presign URL'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && visibleFolders.length === 0 && visibleObjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-500 font-medium">
                    {term ? 'Nothing matches the filter' : 'This folder is empty'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {nextToken && (
          <div className="px-4 py-3 border-t-2 border-edge">
            <button onClick={() => load(prefix, nextToken)} disabled={loading} className="btn-neutral">
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
