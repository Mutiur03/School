import { Skeleton } from '@/components/ui/skeleton';

export function ExamTypeRowSkeleton() {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-48 max-w-full" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:flex">
        <Skeleton className="h-8 w-full sm:w-16" />
        <Skeleton className="h-8 w-full sm:w-20" />
      </div>
    </li>
  );
}

export function SchoolListItemSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3 w-28" />
      </div>
    </li>
  );
}

export function EditorPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
