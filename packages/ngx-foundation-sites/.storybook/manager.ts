import { createElement } from 'react';
import { addons, types } from 'storybook/manager-api';
import { ThemingPanel } from './theming-panel';

// D032/D035: workspace-local addon for the Theming panel (R009). Story-mode
// only, no toolbar entry: no `addons: []` wiring and no new package, per the
// decision. Only mounted while active, matching the addon-a11y panel this
// harness was proven against (R021 lane 3).
addons.register('nfs/theming', () => {
  addons.add('nfs/theming/panel', {
    type: types.PANEL,
    title: 'Theming',
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: ({ active }) => (active ? createElement(ThemingPanel) : null),
  });
});
