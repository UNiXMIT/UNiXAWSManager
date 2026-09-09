import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../api/client';

// Strip ANSI color/format escape sequences so raw Ansible output renders cleanly
function stripAnsi(str) {
  return (str || '').replace(/\x1b\[[\d;]*[a-zA-Z]/g, '');
}

// Format an ISO timestamp to [HH:MM:SS]
function formatTime(timeStr) {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `[${hh}:${mm}:${ss}]`;
  } catch {
    return '';
  }
}

// Map an Ansible output line to a Tailwind text colour class.
// Skips a leading [HH:MM:SS] timestamp prefix if present.
function lineClass(line) {
  const t = line.replace(/^\[\d{2}:\d{2}:\d{2}]\s*/, '').trimStart();
  if (/^ok:/.test(t))                     return 'text-green-400';
  if (/^changed:/.test(t))               return 'text-yellow-400';
  if (/^skipping:/.test(t))              return 'text-blue-400';
  if (/^(fatal|failed):/.test(t))        return 'text-red-400';
  if (/^unreachable:/.test(t))           return 'text-red-400';
  if (/^\[WARNING]|^warning:/i.test(t)) return 'text-purple-400';
  if (/^PLAY /.test(t))                  return 'text-white font-semibold';
  if (/^TASK /.test(t))                  return 'text-white';
  return 'text-gray-300';
}

const STATUS_STYLES = {
  running:  { dot: 'bg-yellow-400', pulse: true,  text: 'text-yellow-300', label: 'Running'  },
  waiting:  { dot: 'bg-blue-400',   pulse: true,  text: 'text-blue-300',   label: 'Waiting'  },
  success:  { dot: 'bg-green-500',  pulse: false, text: 'text-green-400',  label: 'Success'  },
  error:    { dot: 'bg-red-500',    pulse: false, text: 'text-red-400',    label: 'Error'    },
  stopped:  { dot: 'bg-gray-500',   pulse: false, text: 'text-gray-400',   label: 'Stopped'  },
};

function statusStyle(status) {
  return STATUS_STYLES[status] || { dot: 'bg-gray-600', pulse: false, text: 'text-gray-400', label: status || 'Unknown' };
}

function isActiveStatus(status) {
  return status === 'running' || status === 'waiting';
}

function TaskOutputModal({ task, projectId, showTimestamps, onClose, notify }) {
  const [output, setOutput]       = useState([]);
  const [taskStatus, setTaskStatus] = useState(task.status);
  const [loading, setLoading]     = useState(true);
  const [following, setFollowing] = useState(false);
  const [isPinned, setIsPinned]   = useState(true);
  const bottomRef      = useRef(null);
  const containerRef   = useRef(null);
  const pollRef        = useRef(null);
  const mountedRef     = useRef(true);
  const hasScrolled    = useRef(false);
  const pinnedToBottom = useRef(true); // tracks whether we should auto-follow new output

  const fetchOutput = useCallback(async () => {
    const data = await api.semGetTaskOutput(projectId, task.id);
    if (!mountedRef.current) return;
    setOutput(data || []);
  }, [projectId, task.id]);

  const fetchStatus = useCallback(async () => {
    const data = await api.semGetTask(projectId, task.id);
    if (!mountedRef.current) return null;
    setTaskStatus(data.status);
    return data.status;
  }, [projectId, task.id]);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        await fetchOutput();
        const status = await fetchStatus();
        setLoading(false);

        if (isActiveStatus(status ?? task.status)) {
          setFollowing(true);
          pollRef.current = setInterval(async () => {
            try {
              await fetchOutput();
              const next = await fetchStatus();
              if (!isActiveStatus(next)) {
                clearInterval(pollRef.current);
                setFollowing(false);
              }
            } catch {
              // keep polling quietly
            }
          }, 2000);
        }
      } catch (err) {
        if (mountedRef.current) notify(err.message, 'error');
        setLoading(false);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchOutput, fetchStatus, task.status, notify]);

  // Auto-scroll to bottom whenever output changes or loading completes.
  // bottomRef is only rendered once loading=false, so we must watch both.
  // On initial open: jump instantly to bottom and pin.
  // On polling updates: only scroll if pinnedToBottom is true.
  // pinnedToBottom is kept up-to-date by the scroll event listener below.
  useEffect(() => {
    if (loading || !bottomRef.current) return;
    if (!hasScrolled.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
      hasScrolled.current = true;
      pinnedToBottom.current = true;
    } else if (pinnedToBottom.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, loading]);

  // Update pinnedToBottom based on scroll position so follow-mode
  // disables when the user scrolls up, and re-enables when they
  // scroll back to the bottom (or click Latest).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      pinnedToBottom.current = pinned;
      setIsPinned(pinned);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading]); // re-attach once the container is rendered (loading → false)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const style   = statusStyle(taskStatus);
  const rawText = output
    .map((line) => {
      const text = stripAnsi(line.output ?? '');
      if (!text) return '';
      const prefix = showTimestamps && line.time ? `${formatTime(line.time)} ` : '';
      const combined = prefix + text;
      // Ensure each chunk ends with a newline so lines don't run together
      return combined.endsWith('\n') ? combined : combined + '\n';
    })
    .join('');
  // Insert a blank line before each TASK/PLAY header (with or without a timestamp prefix)
  const outputText = rawText.replace(/([^\n])\n(\[\d{2}:\d{2}:\d{2}] )?(TASK |PLAY )/g, '$1\n\n$2$3');
  const templateName = task._templateName || task.message || task.name || task.template?.name || (task.template_id ? `Template #${task.template_id}` : 'Unknown Task');

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="brutal-card bg-panel w-full max-w-4xl flex flex-col"
           style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-edge flex-shrink-0 bg-surface">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="text-zinc-400 text-sm font-mono flex-shrink-0">Task #{task.id}</span>
            <span className="text-white font-bold text-sm truncate uppercase tracking-tight">{templateName}</span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-2.5 h-2.5 border border-black ${style.dot} ${style.pulse ? 'animate-pulse' : ''}`} />
              <span className="text-xs font-bold uppercase text-zinc-300">{style.label}</span>
            </span>
            {following && isPinned && (
              <span className="flex items-center gap-1.5 flex-shrink-0 text-xs font-bold">
                <span className="text-amber-400 animate-pulse">●</span>
                <span className="text-zinc-300">Following…</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 hover:bg-black transition-colors ml-3 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Terminal output */}
        <div ref={containerRef} className="theme-term flex-1 overflow-y-auto bg-black p-4 min-h-0">
          {loading ? (
            <span className="text-gray-500 text-xs font-mono">Loading output…</span>
          ) : outputText ? (
            <>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
                {outputText.split('\n').map((line, i) => (
                  <span key={i} className={lineClass(line)}>{line}{'\n'}</span>
                ))}
              </pre>
              <div ref={bottomRef} />
            </>
          ) : (
            <span className="text-gray-500 text-xs font-mono">No output yet.</span>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-edge flex items-center justify-between flex-shrink-0 bg-surface">
          <span className="text-xs text-zinc-500">
            {task.created ? `Created: ${new Date(task.created).toLocaleString('en-GB')}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                pinnedToBottom.current = true;
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-neutral px-3 py-1.5 text-xs"
              title="Jump to latest output"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Latest
            </button>
            <button
              onClick={onClose}
              className="btn-neutral px-4 py-1.5 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SemTasksTab({ notify }) {
  const [projects, setProjects]         = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [initLoading, setInitLoading]   = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [query, setQuery]               = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [taskCount, setTaskCount]       = useState(5);

  const presentStatuses = useMemo(() => {
    const seen = new Set(tasks.map((t) => t.status));
    return [...seen];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(t.id).includes(q) ||
        (t._templateName || '').toLowerCase().includes(q) ||
        (t._startedBy || '').toLowerCase().includes(q) ||
        (t.status || '').toLowerCase().includes(q) ||
        (t._semStatus || '').toLowerCase().includes(q)
      );
    });
  }, [tasks, query, statusFilter]);

  useEffect(() => {
    const init = async () => {
      try {
        const projectData = await api.semGetProjects();
        setProjects(projectData || []);
        if ((projectData || []).length === 1) {
          setSelectedProjectId(projectData[0].id);
        }
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, [notify]);

  const fetchTasks = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const [rawTasks, templates, users] = await Promise.all([
        api.semGetLastTasks(selectedProjectId, taskCount),
        api.semGetTemplates(selectedProjectId),
        api.semGetProjectUsers(selectedProjectId),
      ]);
      // Build id→name maps
      const tplMap = {};
      (templates || []).forEach((t) => { tplMap[t.id] = t.name; });
      const userMap = {};
      (users || []).forEach((u) => { userMap[u.id] = u.name || u.username; });
      const taskIds = (rawTasks || []).map((t) => String(t.id));
      // Fetch SemStatus AWS tags for all tasks in parallel with the maps already built
      const semStatusMap = taskIds.length ? await api.getSemTaskStatuses(taskIds).catch(() => ({})) : {};
      const enriched = (rawTasks || []).map((t) => ({
        ...t,
        _templateName: tplMap[t.template_id] || t.template?.name || `Template #${t.template_id}`,
        _startedBy: userMap[t.user_id] || (t.user_id ? `User #${t.user_id}` : '—'),
        _semStatus: semStatusMap[String(t.id)] ?? null,
      }));
      setTasks(enriched);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    'brutal-input disabled:opacity-50';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="brutal-panel">
        <div className="flex flex-wrap items-center gap-3">
          {projects.length > 1 && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => {
                setSelectedProjectId(Number(e.target.value));
                setTasks([]);
              }}
              className={selectClass}
              disabled={loading}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="sem-task-count" className="brutal-label whitespace-nowrap">Tasks to fetch</label>
            <input
              id="sem-task-count"
              type="number"
              min={1}
              max={100}
              value={taskCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setTaskCount(Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 1);
              }}
              className="brutal-input w-20"
              disabled={loading}
            />
          </div>
          <button
            onClick={fetchTasks}
            disabled={loading || !selectedProjectId || initLoading}
            className="btn-accent"
          >
            {loading ? 'Loading…' : `Fetch Last ${taskCount} Task${taskCount === 1 ? '' : 's'}`}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Fetches the <span className="text-zinc-300">last {taskCount} task{taskCount === 1 ? '' : 's'}</span> from Semaphore.
          Click <span className="text-zinc-300">View Output</span> on any row to inspect its log.
          Running tasks will auto-follow new output.
        </p>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && !loading && (
        <div className="text-center text-zinc-500 py-16 font-medium">
          Click <span className="text-accent font-bold">Fetch Last {taskCount} Task{taskCount === 1 ? '' : 's'}</span> to load recent tasks
        </div>
      )}

      {/* Filter bar */}
      {tasks.length > 0 && (
        <div className="brutal-panel flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[12rem]">
            <label className="brutal-label">Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, ID, user, status…"
              className="brutal-input w-full"
            />
          </div>
          <div>
            <label className="brutal-label">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="brutal-input"
            >
              <option value="all">All statuses ({tasks.length})</option>
              {presentStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusStyle(s).label} ({tasks.filter((t) => t.status === s).length})
                </option>
              ))}
            </select>
          </div>
          {(query || statusFilter !== 'all') && (
            <button
              onClick={() => { setQuery(''); setStatusFilter('all'); }}
              className="btn-neutral"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Task table */}
      {tasks.length > 0 && (
        <div className="brutal-card overflow-hidden">
          <div className="px-4 py-2 border-b-2 border-edge text-xs text-zinc-400 uppercase font-bold tracking-wider bg-surface">
            Showing {filteredTasks.length} of {tasks.length} task(s)
          </div>
          {filteredTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-zinc-500 text-sm">No tasks match your filters</p>
          ) : (
          <div className="overflow-auto max-h-[calc(100vh-22rem)]">
            <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-zinc-400 border-b-2 border-edge uppercase text-xs tracking-wider bg-surface">
                <th className="px-4 py-3 font-bold">ID</th>
                <th className="px-4 py-3 font-bold">Task Name</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">SEM Status</th>
                <th className="px-4 py-3 font-bold">Started By</th>
                <th className="px-4 py-3 font-bold">Created</th>
                <th className="px-4 py-3 font-bold text-right">Output</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const style     = statusStyle(task.status);
                const active    = isActiveStatus(task.status);
                const tplName   = task._templateName || '—';
                const startedBy = task._startedBy || '—';
                const semStatus = task._semStatus;
                return (
                  <tr
                    key={task.id}
                    className="border-b border-zinc-800 last:border-0 hover:bg-surface"
                  >
                    <td className="px-4 py-3 font-mono text-zinc-400 text-xs">#{task.id}</td>
                    <td className="px-4 py-3 font-bold text-white">{tplName}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 border border-black flex-shrink-0 ${style.dot} ${active ? 'animate-pulse' : ''}`} />
                        <span className="text-xs font-bold uppercase text-zinc-300">{style.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">
                      {semStatus == null
                        ? <span className="text-zinc-600">—</span>
                        : semStatus
                          ? <span className="font-bold text-zinc-300">{semStatus}</span>
                          : <span className="text-zinc-500">No status</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-sm">{startedBy}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {task.created ? new Date(task.created).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedTask({ task, timestamps: false })}
                          className="btn-neutral px-3 py-1.5 text-xs"
                        >
                          View Output
                        </button>
                        <button
                          onClick={() => setSelectedTask({ task, timestamps: true })}
                          className="btn-neutral px-3 py-1.5 text-xs"
                          title="Show output with timestamps"
                        >
                          Timestamps
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          )}
        </div>
      )}

      {/* Output modal */}
      {selectedTask && (
        <TaskOutputModal
          task={selectedTask.task}
          projectId={selectedProjectId}
          showTimestamps={selectedTask.timestamps}
          onClose={() => setSelectedTask(null)}
          notify={notify}
        />
      )}
    </div>
  );
}
