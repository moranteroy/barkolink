import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DropdownMenuContent from '../../src/components/ui/dropdown-menu/DropdownMenuContent.vue';

afterEach(() => { vi.unstubAllGlobals(); });
describe('dropdown content attributes', () => {
  it('applies custom attributes to the menu instead of the teleport portal without Vue warnings', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const warnings: string[] = [];
    const wrapper = mount(defineComponent({
      setup: () => () => h(DropdownMenuRoot, { open: true }, { default: () => [
        h(DropdownMenuTrigger, {}, { default: () => 'Account' }),
        h(DropdownMenuContent, { class: 'admin-account-menu', 'data-test': 'account-content', style: { width: '260px' }, align: 'end' }, { default: () => 'Settings' }),
      ] }),
    }), { attachTo: document.body, global: { config: { warnHandler: message => warnings.push(message) } } });
    try {
      await flushPromises();
      const menu = document.querySelector('[data-test="account-content"]');
      expect(menu?.getAttribute('role')).toBe('menu');
      expect(menu?.classList.contains('ui-menu')).toBe(true);
      expect(menu?.classList.contains('admin-account-menu')).toBe(true);
      expect((menu as HTMLElement).style.width).toBe('260px');
      expect(warnings.filter(message => message.includes('Extraneous non-props attributes'))).toEqual([]);
    } finally { wrapper.unmount(); }
  });
});
