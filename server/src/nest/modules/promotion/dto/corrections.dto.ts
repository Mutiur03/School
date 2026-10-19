import { IsBoolean, IsOptional } from 'class-validator';

/** "Correct mistakes": any mix of these, at least one true (checked by the service). */
export class CorrectionsDto {
  /** Remove next-year rows created by promoting classes 6-9; the page goes back to "Not promoted yet". */
  @IsOptional()
  @IsBoolean()
  reset_promotion?: boolean;

  /** Alumni back to active Passed students; retained class-10 rows removed. */
  @IsOptional()
  @IsBoolean()
  undo_graduation?: boolean;

  /** Drop every manual pass/fail so marks decide again. */
  @IsOptional()
  @IsBoolean()
  clear_manual?: boolean;

  /** Late-released results rank by marks again, like on-time ones. */
  @IsOptional()
  @IsBoolean()
  reset_release_batches?: boolean;
}
