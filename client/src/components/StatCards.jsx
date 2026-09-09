const TONES = {
  default: 'text-white',
  accent: 'text-accent',
  running: 'text-emerald-400',
  stopped: 'text-red-400',
  warn: 'text-amber-300',
  muted: 'text-zinc-400',
};

function StatCard({ label, value, tone }) {
  return (
    <div className="brutal-card px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-3xl font-bold tabular-nums leading-tight mt-1 ${TONES[tone] || TONES.default}`}>
        {value}
      </div>
    </div>
  );
}

export default function StatCards({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone} />
      ))}
    </div>
  );
}
