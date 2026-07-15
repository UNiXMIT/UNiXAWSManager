import { useState, useEffect, useRef, useCallback } from 'react';
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
      pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-4xl flex flex-col shadow-2xl"
           style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="text-gray-400 text-sm font-mono flex-shrink-0">Task #{task.id}</span>
            <span className="text-white font-medium text-sm truncate">{templateName}</span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${style.dot} ${style.pulse ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
            </span>
            {following && (
              <span className="text-xs text-yellow-400 animate-pulse flex-shrink-0">● Following…</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors ml-3 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Terminal output */}
        <div ref={containerRef} className="flex-1 overflow-y-auto bg-gray-950 p-4 min-h-0">
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
        <div className="px-5 py-3 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-500">
            {task.created ? `Created: ${new Date(task.created).toLocaleString('en-GB')}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                pinnedToBottom.current = true;
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded transition-colors flex items-center gap-1.5"
              title="Jump to latest output"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Latest
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded transition-colors"
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
        api.semGetLastTasks(selectedProjectId),
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
    'bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 transition-colors disabled:opacity-50';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
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
          <button
            onClick={fetchTasks}
            disabled={loading || !selectedProjectId || initLoading}
            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            {loading ? 'Loading…' : 'Fetch Last 20 Tasks'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Fetches the <span className="text-gray-400">last 20 tasks</span> from Semaphore.
          Click <span className="text-gray-400">View Output</span> on any row to inspect its log.
          Running tasks will auto-follow new output.
        </p>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-16">
          Click <span className="text-orange-400">Fetch Last 20 Tasks</span> to load recent tasks
        </div>
      )}

      {/* Task table */}
      {tasks.length > 0 && (
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Task Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">SEM Status</th>
                <th className="px-4 py-3 font-medium">Started By</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Output</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const style     = statusStyle(task.status);
                const active    = isActiveStatus(task.status);
                const tplName   = task._templateName || '—';
                const startedBy = task._startedBy || '—';
                const semStatus = task._semStatus;
                return (
                  <tr
                    key={task.id}
                    className="border-b border-gray-700 last:border-0 hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-mono text-gray-400 text-xs">#{task.id}</td>
                    <td className="px-4 py-3 text-white">{tplName}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot} ${active ? 'animate-pulse' : ''}`} />
                        <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {semStatus == null
                        ? <span className="text-gray-600">—</span>
                        : semStatus
                          ? <span className={semStatus === 'READY' ? 'text-green-400' : 'text-yellow-300'}>{semStatus}</span>
                          : <span className="text-gray-500">No status</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{startedBy}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {task.created ? new Date(task.created).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedTask({ task, timestamps: false })}
                          className="bg-gray-700 hover:bg-gray-600 border border-gray-600 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        >
                          View Output
                        </button>
                        <button
                          onClick={() => setSelectedTask({ task, timestamps: true })}
                          className="bg-gray-700 hover:bg-gray-600 border border-gray-600 px-3 py-1.5 rounded text-xs font-medium transition-colors"
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
