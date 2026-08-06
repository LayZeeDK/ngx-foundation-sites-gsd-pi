import type { Meta, StoryObj } from '@storybook/angular';
import { Placeholder } from './placeholder';
import { expect } from 'storybook/test';

const meta: Meta<Placeholder> = {
  component: Placeholder,
  title: 'Placeholder',
};
export default meta;

type Story = StoryObj<Placeholder>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/placeholder/gi)).toBeTruthy();
  },
};
