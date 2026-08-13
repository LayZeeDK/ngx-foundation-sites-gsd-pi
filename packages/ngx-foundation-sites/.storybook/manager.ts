import { addons, types } from 'storybook/manager-api';

// D032: workspace-local addon skeleton for the Theming panel (R009). This is
// a stub -- render is a no-op until the theming-sources generator (D034) and
// the compile pipeline land. Story-mode only, no toolbar entry: no `addons:
// []` wiring and no new package, per the decision.
addons.register('nfs/theming', () => {
  addons.add('nfs/theming/panel', {
    type: types.PANEL,
    title: 'Theming',
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () => null,
  });
});
