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
