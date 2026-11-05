const TONES = {
  default: 'text-white',
  accent: 'text-accent',
  running: 'text-emerald-400',
  stopped: 'text-red-400',
  warn: 'text-amber-300',
  muted: 'text-zinc-400',
};

function StatCard({ label, value, tone, onClick, active }) {
  const body = (
    <>
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-3xl font-bold tabular-nums leading-tight mt-1 ${TONES[tone] || TONES.default}`}>
        {value}
      </div>
    </>
  );

  if (!onClick) return <div className="brutal-card px-4 py-3">{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`brutal-card px-4 py-3 text-left transition-colors hover:border-accent ${
        active ? 'border-accent bg-accent/10' : ''
      }`}
    >
      {body}
    </button>
  );
}

// A stat with `onClick` renders as a clickable filter card; `active` highlights it.
export default function StatCards({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone} onClick={s.onClick} active={s.active} />
      ))}
    </div>
  );
}
