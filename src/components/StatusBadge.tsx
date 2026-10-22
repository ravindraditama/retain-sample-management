import type { SampleStatus } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/sampleStatus';

export default function StatusBadge({ status }: { status: SampleStatus }) {
  return (
    <span className={`badge ${STATUS_COLORS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
