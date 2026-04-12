type StatusBadgeProps = {
  status: 'NEW' | 'CONTACTED' | 'IGNORED';
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    NEW: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 border border-blue-300 dark:border-blue-700',
    CONTACTED: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 border border-green-300 dark:border-green-700',
    IGNORED: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-700',
  };

  const icons = {
    NEW: '●',
    CONTACTED: '✓',
    IGNORED: '✕',
  };
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${styles[status]}`}
    >
      <span className="text-xs">{icons[status]}</span>
      {status}
    </span>
  );
}