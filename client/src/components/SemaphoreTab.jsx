import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import SemTokenField from './SemTokenField';

const REGIONS = [
  { label: 'EU', value: 1 },
  { label: 'US', value: 2 },
  { label: 'AP', value: 3 },
];

function templateName(t) {
  return t.name || t.alias || t.description || t.playbook || `Template #${t.id}`;
}

function TemplateCard({ template, isSelected, onSelect }) {
  const name = templateName(template);
  const subtitle = template.description && template.description !== name ? template.description : null;
  return (
    <button
      onClick={() => onSelect(isSelected ? null : template)}
      className={`w-full text-left px-4 py-3.5 border-2 transition-all duration-100 flex items-center justify-between gap-3 group ${
        isSelected
          ? 'bg-accent/20 border-accent shadow-brutal-sm'
          : 'bg-panel border-edge hover:-translate-y-px hover:shadow-brutal-sm'
      }`}
    >
      <div className="min-w-0">
        <span className={`font-bold text-sm leading-snug uppercase tracking-tight ${isSelected ? 'text-accent' : 'text-zinc-100'}`}>
          {name}
        </span>
        {subtitle && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate normal-case">{subtitle}</p>
        )}
      </div>
      <svg
        className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-accent' : 'text-zinc-600 group-hover:text-zinc-400'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      >
        {isSelected
          ? <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
          : <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
        }
      </svg>
    </button>
  );
}

function LaunchPanel({ template, projectId, onSuccess, onCancel, notify }) {
  const [vmCount, setVmCount] = useState(1);
  const [region, setRegion] = useState(1);
  const [launching, setLaunching] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (vmCount < 1 || vmCount > 50) {
      notify('VM count must be between 1 and 50', 'error');
      return;
    }
    setLaunching(true);
    try {
      const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region;
      const result = await api.semStartTask(projectId, template.id, { vmCount, userRegion: region });
      notify(`Task #${result.id} started — ${templateName(template)} (${vmCount} VM${vmCount !== 1 ? 's' : ''}, ${regionLabel})`);
      onSuccess();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-0 border-2 border-t-0 border-accent bg-surface px-4 py-4"
    >
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="brutal-label mb-0">VM Count</label>
          <input
            type="number"
            min={1}
            max={50}
            value={vmCount}
            onChange={(e) => setVmCount(parseInt(e.target.value, 10) || 1)}
            className="brutal-input w-24"
            disabled={launching}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="brutal-label mb-0">AWS Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(parseInt(e.target.value, 10))}
            className="brutal-input"
            disabled={launching}
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pb-0.5">
          <button
            type="submit"
            disabled={launching}
            className="btn-accent"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            {launching ? 'Starting…' : 'Launch Task'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={launching}
            className="btn-neutral"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export default function SemaphoreTab({ notify }) {
  const { semToken } = useConfig();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [views, setViews] = useState([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [query, setQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      templateName(t).toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }, [templates, query]);

  useEffect(() => {
    // Don't attempt to load anything until a token is configured.
    if (!semToken) {
      notifyRef.current('No Semaphore API token configured.', 'error');
      return;
    }
    const init = async () => {
      setLoadingViews(true);
      try {
        const projectData = await api.semGetProjects();
        setProjects(projectData);
        const project = projectData.length === 1 ? projectData[0] : null;
        if (project) {
          setSelectedProject(project);
          const viewData = await api.semGetViews(project.id);
          setViews(viewData || []);
        }
      } catch (err) {
        notifyRef.current(err.message, 'error');
      } finally {
        setLoadingViews(false);
      }
    };
    init();
  }, [semToken]);

  const fetchViewsForProject = useCallback(async (project) => {
    setSelectedProject(project);
    setViews([]);
    setSelectedViewId('');
    setTemplates([]);
    setLoaded(false);
    setLoadingViews(true);
    try {
      const viewData = await api.semGetViews(project.id);
      setViews(viewData || []);
    } catch (err) {
      notifyRef.current(err.message, 'error');
    } finally {
      setLoadingViews(false);
    }
  }, []);

  const loadTemplates = async () => {
    if (!selectedProject || !selectedViewId) return;
    setLoaded(true);
    setTemplates([]);
    setSelectedTemplate(null);
    setQuery('');
    setLoadingTemplates(true);
    try {
      const all = await api.semGetTemplates(selectedProject.id);
      // An "All" view isn't tagged onto templates, so show everything unfiltered.
      const selView = views.find((v) => String(v.id) === String(selectedViewId));
      const isAllView = /^all$/i.test((selView?.title || '').trim());
      setTemplates(
        isAllView
          ? (all || [])
          : (all || []).filter((t) => t.view_id === parseInt(selectedViewId, 10))
      );
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const isLoading = loadingViews || loadingTemplates;
  const canLoad = !!selectedViewId && !isLoading;

  const selectClass = 'brutal-input disabled:opacity-50';

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="brutal-panel">
        <div className="mb-3 pb-3 border-b-2 border-edge">
          <SemTokenField />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
        {projects.length > 1 && (
          <div>
            <label className="brutal-label">Project</label>
            <select
              value={selectedProject?.id ?? ''}
              onChange={(e) => {
                const proj = projects.find((p) => p.id === parseInt(e.target.value, 10));
                if (proj) fetchViewsForProject(proj);
              }}
              className={selectClass}
              disabled={isLoading}
            >
              <option value="" disabled>Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="brutal-label">View</label>
          <select
            value={selectedViewId}
            onChange={(e) => {
              setSelectedViewId(e.target.value);
              setLoaded(false);
              setTemplates([]);
              setSelectedTemplate(null);
            }}
            disabled={loadingViews || views.length === 0}
            className={selectClass}
          >
            <option value="" disabled>
              {loadingViews ? 'Loading views…' : views.length === 0 ? 'No views available' : 'Select view…'}
            </option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
        </div>

        <button
          onClick={loadTemplates}
          disabled={!canLoad}
          className="btn-accent"
        >
          {loadingTemplates ? 'Loading…' : 'Load Semaphore Tasks'}
        </button>


        </div>
      </div>

      {/* Empty / loading state */}
      {!loaded && (
        <div className="text-center text-zinc-500 py-16 font-medium">
          {loadingViews
            ? 'Loading views…'
            : views.length > 0
            ? <>Select a view and click <span className="text-accent font-bold">Load Semaphore Tasks</span></>
            : 'No Semaphore views available'}
        </div>
      )}

      {/* Template list */}
      {loaded && !loadingTemplates && (
        <div className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-12">No task templates in this view.</p>
          ) : (
            <>
              <div className="brutal-panel flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <label className="brutal-label">Search Tasks</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by name or description…"
                    className="brutal-input w-full"
                  />
                </div>
                {query && (
                  <button onClick={() => setQuery('')} className="btn-neutral">Clear</button>
                )}
                <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider pb-2.5 ml-auto">
                  {filteredTemplates.length} of {templates.length} task(s)
                </span>
              </div>

              {filteredTemplates.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-12">No tasks match your search.</p>
              ) : (
                filteredTemplates.map((tmpl) => (
                  <div key={tmpl.id}>
                    <TemplateCard
                      template={tmpl}
                      isSelected={selectedTemplate?.id === tmpl.id}
                      onSelect={setSelectedTemplate}
                    />
                    {selectedTemplate?.id === tmpl.id && (
                      <LaunchPanel
                        template={tmpl}
                        projectId={selectedProject.id}
                        notify={notify}
                        onSuccess={() => setSelectedTemplate(null)}
                        onCancel={() => setSelectedTemplate(null)}
                      />
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
