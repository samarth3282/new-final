export default function LoadingSpinner({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="spinner" />
      {text && <p className="text-text-secondary text-base">{text}</p>}
    </div>
  );
}
