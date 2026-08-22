export default function Select({ label, options = [], placeholder, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="label-field">{label}</label>}
      <select className="input-field" {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rust-500">{error}</p>}
    </div>
  );
}
