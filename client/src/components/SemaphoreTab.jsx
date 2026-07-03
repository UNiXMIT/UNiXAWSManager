import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

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
      className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all duration-150 flex items-center justify-between gap-3 group ${
        isSelected
          ? 'bg-orange-950/40 border-orange-500/70 shadow-sm shadow-orange-900/30'
          : 'bg-gray-800/70 border-gray-700/60 hover:bg-gray-800 hover:border-gray-600'
      }`}
    >
      <div className="min-w-0">
        <span className={`font-medium text-sm leading-snug ${isSelected ? 'text-orange-200' : 'text-gray-100'}`}>
          {name}
        </span>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      <svg
        className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-orange-400' : 'text-gray-600 group-hover:text-gray-400'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
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
      className="mt-1 rounded-b-lg border border-t-0 border-orange-500/40 bg-gray-900/60 px-4 py-4"
    >
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">VM Count</label>
          <input
            type="number"
            min={1}
            max={50}
            value={vmCount}
            onChange={(e) => setVmCount(parseInt(e.target.value, 10) || 1)}
            className="w-24 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 transition-colors"
            disabled={launching}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">AWS Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(parseInt(e.target.value, 10))}
            className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 transition-colors"
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
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 px-4 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm"
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
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export default function SemaphoreTab({ notify }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [views, setViews] = useState([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
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
        notify(err.message, 'error');
      } finally {
        setLoadingViews(false);
      }
    };
    init();
  }, [notify]);

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
      notify(err.message, 'error');
    } finally {
      setLoadingViews(false);
    }
  }, [notify]);

  const loadTemplates = async () => {
    if (!selectedProject || !selectedViewId) return;
    setLoaded(true);
    setTemplates([]);
    setSelectedTemplate(null);
    setLoadingTemplates(true);
    try {
      const all = await api.semGetTemplates(selectedProject.id);
      setTemplates((all || []).filter((t) => t.view_id === parseInt(selectedViewId, 10)));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const isLoading = loadingViews || loadingTemplates;
  const canLoad = !!selectedViewId && !isLoading;

  const selectClass = 'bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 transition-colors disabled:opacity-50';

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-gray-800 rounded-lg p-4 flex flex-wrap gap-3 items-end border border-gray-700">
        {projects.length > 1 && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Project</label>
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
          <label className="block text-xs text-gray-400 mb-1">View</label>
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
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm"
        >
          {loadingTemplates ? 'Loading…' : 'Load Semaphore Tasks'}
        </button>


      </div>

      {/* Empty / loading state */}
      {!loaded && (
        <div className="text-center text-gray-500 py-16">
          {loadingViews
            ? 'Loading views…'
            : views.length > 0
            ? <>Select a view and click <span className="text-orange-400">Load Semaphore Tasks</span></>
            : 'No Semaphore views available'}
        </div>
      )}

      {/* Template list */}
      {loaded && !loadingTemplates && (
        <div className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No task templates in this view.</p>
          ) : (
            templates.map((tmpl) => (
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
        </div>
      )}
    </div>
  );
}
