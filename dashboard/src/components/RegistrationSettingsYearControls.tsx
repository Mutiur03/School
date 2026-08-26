import { CalendarDays, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { filterSelectClassName } from '@/components/FilterSelection';

type YearHeaderProps = {
  id: string;
  label: string;
  settingsYear: string;
  settingsYearOptions: number[];
  defaultSettingsYear: string;
  settingsYearTouched: boolean;
  onYearChange: (value: string) => void;
  onUseLatest: () => void;
};

export function RegistrationSettingsYearHeader({
  id,
  label,
  settingsYear,
  settingsYearOptions,
  defaultSettingsYear,
  settingsYearTouched,
  onYearChange,
  onUseLatest,
}: YearHeaderProps) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
      <div className="min-w-0 sm:w-44">
        <label
          htmlFor={id}
          className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium"
        >
          <CalendarDays size={13} aria-hidden="true" />
          {label}
        </label>
        <select
          id={id}
          name={id}
          value={settingsYear}
          onChange={(e) => onYearChange(e.target.value)}
          className={`${filterSelectClassName} h-10 min-w-32 tabular-nums`}
          aria-describedby={`${id}-status`}
        >
          {settingsYearOptions.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onUseLatest}
        disabled={settingsYear === defaultSettingsYear && !settingsYearTouched}
        className="h-10 gap-2"
      >
        <RotateCcw size={15} aria-hidden="true" />
        Use Latest
      </Button>
    </div>
  );
}

type YearStatusProps = {
  statusId: string;
  settingsFetching: boolean;
  loadingLabel: string;
  showCreateHint: boolean;
  createHint: string;
};

export function RegistrationSettingsYearStatus({
  statusId,
  settingsFetching,
  loadingLabel,
  showCreateHint,
  createHint,
}: YearStatusProps) {
  return (
    <>
      {settingsFetching && (
        <div
          id={statusId}
          aria-live="polite"
          className="text-muted-foreground -mt-2 flex items-center gap-2 text-sm"
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {loadingLabel}
        </div>
      )}
      {showCreateHint && <p className="text-muted-foreground text-sm">{createHint}</p>}
    </>
  );
}
