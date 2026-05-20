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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <p className="text-white leading-relaxed">{message}</p>
        {previewItems.length > 0 && (
          <div className="mt-4 mb-6 rounded border border-gray-700 bg-gray-900/60">
            <div className="px-3 py-2 border-b border-gray-700 text-xs text-gray-400">
              {previewTitle || `Instances selected (${previewItems.length})`}
            </div>
            <div className="max-h-48 overflow-y-auto">
              {previewItems.map((item, index) => (
                <div key={`${item.id || item.primary || 'item'}-${index}`} className="px-3 py-2 border-b border-gray-800 last:border-b-0">
                  <div className="text-xs font-mono text-gray-200">{item.primary || item.id || 'Unknown'}</div>
                  {item.secondary && (
                    <div className="text-[11px] text-gray-400 mt-0.5">{item.secondary}</div>
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
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              danger ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
