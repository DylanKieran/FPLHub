export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'var(--border-subtle)' }} />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: 'var(--semantic-blue-500)' }}
        />
      </div>
      <p className="mt-4 text-sm-design" style={{ color: 'var(--text-tertiary)' }}>{message}</p>
    </div>
  );
}
