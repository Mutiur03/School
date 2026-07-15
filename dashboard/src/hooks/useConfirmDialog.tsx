import { useCallback, useRef, useState } from "react";
import ConfirmationPopup from "@/components/ConfirmationPopup";

type ConfirmOptions = {
  title?: string;
  msg: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default" | "outline";
};

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ msg: "" });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOpen(false);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const dialog = (
    <ConfirmationPopup
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
        else setOpen(true);
      }}
      onConfirm={() => settle(true)}
      title={options.title}
      msg={options.msg}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant ?? "destructive"}
    />
  );

  return { confirm, dialog };
}
