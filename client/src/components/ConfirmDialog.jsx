export default function ConfirmDialog({ message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <p className="text-white mb-6 leading-relaxed">{message}</p>
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
