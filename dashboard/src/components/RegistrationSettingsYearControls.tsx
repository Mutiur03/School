import { CalendarDays, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { filterSelectClassName } from '@/components/FilterSelection';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium"
      >
        <CalendarDays size={14} aria-hidden="true" />
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={settingsYear}
        onChange={(e) => onYearChange(e.target.value)}
        className={cn(filterSelectClassName, 'h-8 w-auto font-medium tabular-nums')}
        aria-describedby={`${id}-status`}
      >
        {settingsYearOptions.map((year) => (
          <option key={year} value={String(year)}>
            {year}
          </option>
        ))}
      </select>
      {/* Only offered once the user has moved off the latest year. */}
      {(settingsYear !== defaultSettingsYear || settingsYearTouched) && (
        <Button type="button" variant="ghost" size="sm" onClick={onUseLatest}>
          <RotateCcw aria-hidden="true" />
          Use latest
        </Button>
      )}
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
