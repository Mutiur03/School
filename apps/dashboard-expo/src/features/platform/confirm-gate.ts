/**
 * Confirm-then-run for every tenant-affecting platform action (create/update a school, domain
 * changes, billing status, admins, SMS credentials and balance, password rotation, exam-type
 * changes). One action at a time: while one is confirming or running, new requests are refused
 * and a second Confirm press (double tap, Enter repeat) never sends the request again. The
 * buttons are also disabled while busy, but that lands a render later; this guard is synchronous.
 */
import { createSingleFlight } from '@/features/admin/single-flight';
import type { ConfirmCopy } from './model';

export interface PendingAction {
  copy: ConfirmCopy;
  run: () => Promise<unknown>;
}

export interface ConfirmGate {
  readonly pending: PendingAction | null;
  readonly busy: boolean;
  /** Ask for confirmation. false (ignored) while another action is pending or running. */
  request(copy: ConfirmCopy, run: () => Promise<unknown>): boolean;
  /** Run the pending action once. 'skipped' when nothing is pending or it is already running. */
  confirm(): Promise<'ran' | 'failed' | 'skipped'>;
  /** Dismiss. Refused while the action runs (the request is already in flight). */
  cancel(): boolean;
}

export function createConfirmGate(onChange: () => void = () => {}): ConfirmGate {
  const flight = createSingleFlight();
  let pending: PendingAction | null = null;
  return {
    get pending() {
      return pending;
    },
    get busy() {
      return flight.busy;
    },
    request(copy, run) {
      if (pending || flight.busy) return false;
      pending = { copy, run };
      onChange();
      return true;
    },
    async confirm() {
      const action = pending;
      if (!action || flight.busy) return 'skipped';
      let outcome: 'ran' | 'failed' = 'ran';
      const ran = await flight.run(async () => {
        onChange();
        try {
          await action.run();
        } catch {
          // The action reports its own error (toast); the dialog still closes.
          outcome = 'failed';
        } finally {
          pending = null;
        }
        return true;
      });
      onChange();
      return ran ? outcome : 'skipped';
    },
    cancel() {
      if (flight.busy) return false;
      if (pending) {
        pending = null;
        onChange();
      }
      return true;
    },
  };
}
