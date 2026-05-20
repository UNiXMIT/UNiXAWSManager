export default function Toast({ message, type = 'success', onClose }) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl max-w-sm border ${
        type === 'error'
          ? 'bg-red-900 border-red-600 text-red-100'
          : 'bg-green-900 border-green-600 text-green-100'
      }`}
    >
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 ml-auto text-lg leading-none">
        ✕
      </button>
    </div>
  );
}
