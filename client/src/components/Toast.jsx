export default function Toast({ message, type = 'success', onClose }) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 border-2 border-black shadow-brutal max-w-sm font-bold ${
        type === 'error'
          ? 'bg-red-500 text-black'
          : 'bg-emerald-500 text-black'
      }`}
    >
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 ml-auto text-lg leading-none">
        ✕
      </button>
    </div>
  );
}
