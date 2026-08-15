import { setCompodocJson } from '@storybook/addon-docs/angular';
// Generated (and gitignored) by the `compodoc: true` option on both Storybook
// targets, which runs Compodoc against tsconfig.lib.json before the build.
import docJson from '../documentation.json';

// R007: the autodocs ArgTypes table is populated from Compodoc's docgen JSON.
// @storybook/angular reads it from globalThis.__STORYBOOK_COMPODOC_JSON__ and
// nothing sets that for you, so without this call every input renders as `-`
// with no description, type or default -- which is exactly what R007's
// recorded proof claims autodocs shows.
setCompodocJson(docJson);

// D035 part b: nfsTheme is a sparse, canonical-minimal override map over the
// Theming panel's six controls (R009). `{}` means "Foundation's default
// theme" -- a key is present only when its live value differs from that
// default, so the default theme yields an empty `?globals=`.
export const initialGlobals = {
  nfsTheme: {},
};
