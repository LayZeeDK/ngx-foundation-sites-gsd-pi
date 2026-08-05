import type { Meta, StoryObj } from '@storybook/angular';
import { NfsButton } from './nfs-button';
import { expect } from 'storybook/test';

const meta: Meta<NfsButton> = {
  component: NfsButton,
  title: 'NfsButton',
};
export default meta;

type Story = StoryObj<NfsButton>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/nfs-button/gi)).toBeTruthy();
  },
};
