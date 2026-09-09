export default function ConfirmDialog({
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
  previewTitle = '',
  previewItems = [],
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="brutal-card bg-panel p-6 max-w-md w-full mx-4">
        <p className="text-white leading-relaxed font-bold">{message}</p>
        {previewItems.length > 0 && (
          <div className="mt-4 mb-6 border-2 border-edge bg-ink">
            <div className="px-3 py-2 border-b-2 border-edge text-xs text-zinc-400 uppercase font-bold tracking-wider">
              {previewTitle || `Instances selected (${previewItems.length})`}
            </div>
            <div className="max-h-48 overflow-y-auto">
              {previewItems.map((item, index) => (
                <div key={`${item.id || item.primary || 'item'}-${index}`} className="px-3 py-2 border-b border-zinc-800 last:border-b-0">
                  <div className="text-xs font-mono text-zinc-200">{item.primary || item.id || 'Unknown'}</div>
                  {item.secondary && (
                    <div className="text-[11px] text-zinc-400 mt-0.5">{item.secondary}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {previewItems.length === 0 && <div className="mb-6" />}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn-neutral"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn-danger' : 'btn-info'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
