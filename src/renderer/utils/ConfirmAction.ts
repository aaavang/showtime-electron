export function confirmAction(
  message: string,
  onConfirm: () => void,
  onAbort?: () => void,
) {
  return () => {
    // eslint-disable-next-line no-alert
    if (window.confirm(message)) onConfirm();
    else onAbort?.();
  };
}
