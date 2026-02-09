import { confirmAction } from '../../renderer/utils/ConfirmAction';

describe('confirmAction', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    confirmSpy = jest.spyOn(window, 'confirm');
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('returns a function', () => {
    const result = confirmAction('msg', jest.fn());
    expect(typeof result).toBe('function');
  });

  it('calls window.confirm with the message when invoked', () => {
    confirmSpy.mockReturnValue(true);
    const fn = confirmAction('Are you sure?', jest.fn());
    fn();
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?');
  });

  it('calls onConfirm when user confirms', () => {
    confirmSpy.mockReturnValue(true);
    const onConfirm = jest.fn();
    const fn = confirmAction('msg', onConfirm);
    fn();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onAbort when user cancels', () => {
    confirmSpy.mockReturnValue(false);
    const onConfirm = jest.fn();
    const onAbort = jest.fn();
    const fn = confirmAction('msg', onConfirm, onAbort);
    fn();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onAbort).toHaveBeenCalled();
  });

  it('does not throw when onAbort is undefined and user cancels', () => {
    confirmSpy.mockReturnValue(false);
    const fn = confirmAction('msg', jest.fn());
    expect(() => fn()).not.toThrow();
  });
});
