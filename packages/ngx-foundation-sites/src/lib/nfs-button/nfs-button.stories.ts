import type { Meta, StoryObj } from '@storybook/angular';
import { expect, userEvent, within } from 'storybook/test';
import { NfsButton } from './nfs-button';

const meta: Meta<NfsButton> = {
  component: NfsButton,
  title: 'NfsButton',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Foundation for Sites button, applied to a native `<button>` or `<a>` element via the `nfsButton` attribute selector.\n\nRenders Foundation's `.button` classes and states (color, hollow, size, expanded, dropdown, disabled/soft-disabled) while keeping the host's native button or anchor semantics intact.",
      },
    },
  },
  argTypes: {
    color: {
      control: 'radio',
      options: ['primary', 'secondary', 'success', 'warning', 'alert'],
    },
    hollow: {
      control: 'boolean',
    },
    size: {
      control: 'radio',
      options: ['tiny', 'small', 'large'],
    },
    expanded: {
      control: 'boolean',
    },
    dropdown: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
};
export default meta;

type Story = StoryObj<NfsButton>;

export const Primary: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Primary button</button>`,
  }),
  args: {
    color: 'primary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Primary button' });
    await expect(button).toHaveClass('button');
    await expect(button).not.toHaveClass('secondary');
    await expect(button).not.toBeDisabled();

    await userEvent.tab();
    await expect(button).toHaveFocus();
  },
};

export const Secondary: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Secondary button</button>`,
  }),
  args: {
    color: 'secondary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Secondary button' });
    await expect(button).toHaveClass('secondary');
  },
};

export const Hollow: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Hollow button</button>`,
  }),
  args: {
    color: 'primary',
    hollow: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Hollow button' });
    await expect(button).toHaveClass('hollow');
  },
};

export const Success: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Success button</button>`,
  }),
  args: {
    color: 'success',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Success button' });
    await expect(button).toHaveClass('success');
  },
};

export const Warning: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Warning button</button>`,
  }),
  args: {
    color: 'warning',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Warning button' });
    await expect(button).toHaveClass('warning');
  },
};

export const Alert: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Alert button</button>`,
  }),
  args: {
    color: 'alert',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Alert button' });
    await expect(button).toHaveClass('alert');
  },
};

export const Expanded: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Expanded button</button>`,
  }),
  args: {
    color: 'primary',
    expanded: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Expanded button' });
    await expect(button).toHaveClass('expanded');
  },
};

export const Dropdown: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Dropdown button</button>`,
  }),
  args: {
    color: 'primary',
    dropdown: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Dropdown button' });
    await expect(button).toHaveClass('dropdown');
  },
};

// R006 requires the stories to cover RTL, and until now they did not. That gap
// was invisible while RTL was a separate build artefact (a `.rtl.css` twin that
// Storybook never loaded); under ticket 03's mechanism the mirroring lives in
// the single component stylesheet, so a story can and must exercise it.
//
// The dropdown variant is the only one with anything to mirror: Foundation's
// unmodified `button-dropdown` emits `float: inline-end` and
// `margin-inline-start: 1em` on `::after`, and those are the only two
// directional declarations the whole sheet contains. `float` is deliberately NOT
// asserted -- it computes to "inline-end" in both directions, so asserting it
// would pass vacuously. Same observable, same reasoning and same numeric
// tolerance as apps/nfs-demo/e2e/nfs-button-rtl.spec.ts.
export const Rtl: Story = {
  name: 'RTL (dir="rtl") mirroring',
  render: (args) => ({
    props: args,
    template: `
      <div data-testid="ltr-container">
        <button nfsButton dropdown [color]="color">LTR dropdown</button>
      </div>
      <div dir="rtl" data-testid="rtl-container">
        <button nfsButton dropdown [color]="color">RTL dropdown</button>
      </div>
    `,
  }),
  args: {
    color: 'primary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const readArrowMargins = (element: Element) => {
      const style = getComputedStyle(element, '::after');

      return {
        marginLeft: Number.parseFloat(style.marginLeft),
        marginRight: Number.parseFloat(style.marginRight),
      };
    };

    const ltrArrow = readArrowMargins(
      canvas.getByRole('button', { name: 'LTR dropdown' }),
    );
    const rtlArrow = readArrowMargins(
      canvas.getByRole('button', { name: 'RTL dropdown' }),
    );

    // Anti-vacuity first: without a non-zero inline-start margin both
    // directions would trivially agree on 0.
    await expect(ltrArrow.marginLeft).toBeGreaterThan(0);
    await expect(ltrArrow.marginRight).toBe(0);
    await expect(rtlArrow.marginRight).toBeGreaterThan(0);
    await expect(rtlArrow.marginLeft).toBe(0);

    // Then the mirroring itself. A physical `margin-left` does not mirror, so a
    // regression makes rtlArrow equal ltrArrow and both of these fail.
    await expect(rtlArrow.marginLeft).toBeCloseTo(ltrArrow.marginRight, 1);
    await expect(rtlArrow.marginRight).toBeCloseTo(ltrArrow.marginLeft, 1);
  },
};

export const Tiny: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Tiny button</button>`,
  }),
  args: {
    color: 'primary',
    size: 'tiny',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Tiny button' });
    await expect(button).toHaveClass('tiny');
  },
};

export const Small: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Small button</button>`,
  }),
  args: {
    color: 'primary',
    size: 'small',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Small button' });
    await expect(button).toHaveClass('small');
  },
};

export const Large: Story = {
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Large button</button>`,
  }),
  args: {
    color: 'primary',
    size: 'large',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Large button' });
    await expect(button).toHaveClass('large');
  },
};

export const DisabledButton: Story = {
  name: 'Disabled (button)',
  render: (args) => ({
    props: args,
    template: `<button nfsButton [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Disabled button</button>`,
  }),
  args: {
    color: 'primary',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', {
      name: 'Disabled button',
    }) as HTMLButtonElement;
    await expect(button).toBeDisabled();
    await expect(button).not.toHaveClass('disabled');

    let clicked = false;
    button.addEventListener('click', () => {
      clicked = true;
    });
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(clicked).toBe(false);
  },
};

export const Anchor: Story = {
  render: (args) => ({
    props: args,
    template: `<a nfsButton href="#" [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Anchor button</a>`,
  }),
  args: {
    color: 'primary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const anchor = canvas.getByRole('link', {
      name: 'Anchor button',
    }) as HTMLAnchorElement;
    await expect(anchor).not.toHaveAttribute('aria-disabled');

    await userEvent.tab();
    await expect(anchor).toHaveFocus();

    let clicked = false;
    anchor.addEventListener('click', (event) => {
      clicked = true;
      event.preventDefault();
    });
    await userEvent.click(anchor);
    await expect(clicked).toBe(true);
  },
};

export const DisabledAnchor: Story = {
  name: 'Disabled (anchor, soft-disabled)',
  render: (args) => ({
    props: args,
    template: `<a nfsButton href="#" [color]="color" [hollow]="hollow" [size]="size" [expanded]="expanded" [dropdown]="dropdown" [disabled]="disabled">Disabled anchor</a>`,
  }),
  args: {
    color: 'primary',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const anchor = canvas.getByRole('link', { name: 'Disabled anchor' });
    await expect(anchor).toHaveAttribute('aria-disabled', 'true');
    await expect(anchor).toHaveClass('disabled');
    await expect(anchor).not.toHaveAttribute('disabled');
    await expect(anchor).toHaveAttribute('tabindex', '-1');
  },
};
