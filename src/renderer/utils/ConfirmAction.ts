export function confirmAction(
  message: string,
  onConfirm: () => void,
  onAbort?: () => void
) {
  return () => {
    if (window.confirm(message)) onConfirm();
    else onAbort?.();
  };
}
