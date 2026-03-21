export default function ProgressBar({ current, total }) {
  const percent = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${percent}%`, background: 'var(--color-primary)' }}
      />
    </div>
  );
}
