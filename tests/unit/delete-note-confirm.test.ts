import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../extension/node_modules/react', () => ({
  useState: (value: unknown) => [value, vi.fn()],
  useRef: (current: unknown) => ({ current }),
}));
import { DeleteNoteButton } from '../../extension/src/ui/DeleteNoteButton';
afterEach(() => vi.unstubAllGlobals());
it.each([true, false])(
  '删除确认取消时不调用删除，确认后才调用（iconOnly=%s）',
  async (iconOnly) => {
    const confirm = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    vi.stubGlobal('window', { confirm });
    const onDelete = vi.fn(async () => {});
    const element = DeleteNoteButton({ onDelete, iconOnly });
    const click = element.props.children[0].props.onClick;
    click();
    expect(onDelete).not.toHaveBeenCalled();
    click();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('AI 问答'));
    await Promise.resolve();
  },
);
it('删除未完成时再次点击不重复确认或删除', async () => {
  const confirm = vi.fn(() => true);
  vi.stubGlobal('window', { confirm });
  let finish!: () => void;
  const onDelete = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const element = DeleteNoteButton({ onDelete, iconOnly: true });
  const click = element.props.children[0].props.onClick;
  click();
  click();
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledTimes(1);
  finish();
  await Promise.resolve();
});
