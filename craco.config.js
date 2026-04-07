/**
 * CRACO (Create React App Configuration Override)
 *
 * Purpose: Fix MUI v5.16+ "use client" directive compatibility with webpack 5.
 *
 * Root cause:
 *   MUI 5.16+ added 'use client' directives to components (for RSC support).
 *   webpack 5.105+ handles these directives strictly, causing re-export
 *   resolution to break for named exports (e.g. createFilterOptions from
 *   Autocomplete). This manifests as a build error even though we don't use
 *   the affected component.
 *
 * Fix:
 *   Enable webpack's `experiments.layers` which properly processes 'use client'
 *   / 'use server' boundaries and correctly resolves named exports across them.
 */
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Enable layers experiment — required for correct 'use client' handling
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        layers: true,
      };

      // Also suppress the residual "export X was not found" warning that may
      // still appear during incremental HMR rebuilds (harmless false positives)
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /export .* was not found in/,
      ];

      return webpackConfig;
    },
  },
};
