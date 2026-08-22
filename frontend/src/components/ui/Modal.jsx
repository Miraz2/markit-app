export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-forest-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-parchment-50 shadow-lift">
        <div className="border-b border-forest-900/10 px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-forest-800">{title}</h3>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-forest-900/10 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
