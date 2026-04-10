type StatusBadgeProps = {
  status: 'NEW' | 'CONTACTED' | 'IGNORED';
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    NEW: 'bg-blue-100 text-blue-800',
    CONTACTED: 'bg-green-100 text-green-800',
    IGNORED: 'bg-gray-100 text-gray-800',
  };
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}