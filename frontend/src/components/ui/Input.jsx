export default function Input({ label, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="label-field">{label}</label>}
      <input className="input-field" {...props} />
      {error && <p className="mt-1 text-xs text-rust-500">{error}</p>}
    </div>
  );
}
