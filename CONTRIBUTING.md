# Contributing

This is a development prototype. Start by reading the current status in the README and the remaining acceptance work in [validation](docs/validation.md).

Use Node.js 24 or newer, then run `npm run check`, `npm test`, and `npm run package`. Keep tests serial to limit local process load. There are no dependencies to install.

For a bug report, include the browser version, steps to reproduce, expected result and actual result. A public example URL is useful. Do not include credentials, signed URLs, personal browsing history, or private page content.

Changes to discovery should preserve exact destination-URL checks, request bounds, navigation cancellation, cache limits and unavailable-source reporting. Explain any new host permission or data destination. Tests should cover behavior rather than duplicate the implementation.

Keep fixture data clearly labeled. A popup preview or a passing mock test cannot establish installed-extension behavior, public API access or browser-wide performance.
