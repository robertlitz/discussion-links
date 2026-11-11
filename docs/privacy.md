# Privacy and permissions

Discussion Links reads the URL of the active tab so it can find submissions linking to that page. It does not inject code into the page or inspect its DOM, text, forms or images.

## Data destinations

The prototype sends a cleaned URL to `https://www.reddit.com/search.json` and `https://hn.algolia.com/api/v1/search`. The anonymous Reddit endpoint was rejected with HTTP 403 in the live probe. Approved OAuth support is planned, not implemented; its host permissions and token handling must be reviewed before activation.

Requests omit cookies and referrers. The extension has no analytics, remote collection server, advertising or browsing-history upload service. Requests are direct to the listed search services.

The extension strips fragments and known tracking parameters. It skips local hostnames, IP literals, embedded usernames/passwords and recognized secret query parameters. A public URL can still contain sensitive information that those rules do not recognize. Pause automatic checks before using such pages.

## Browser permissions

| Permission | Purpose |
|---|---|
| `tabs` | Read tab URLs and respond to loading/activation events |
| `storage` | Hold session results and the local Pause preference |
| `https://www.reddit.com/*` | Prototype Reddit lookup endpoint |
| `https://hn.algolia.com/*` | Hacker News URL searches |

The manifest requests no scripting, webRequest, debugger, offscreen or alarm permissions. There are no content scripts.

## Local storage

Result metadata and normalized URLs stay in `chrome.storage.session`, bounded to 100 entries and approximately 1.5 MB serialized data. Closing the browser clears that session data. Pause is stored locally so it survives a restart.

Result freshness is 15 minutes for positive matches, five minutes for empty results and one minute for partial failures. Freshness expiry is not the same as physical deletion: expired entries can remain until eviction or session end. Retention/deletion handling must be completed and verified before approved Reddit API integration is enabled. This prototype does not claim finished retention compliance.

The extension retains the displayed submission ID, title, community, permalink, score, comment count and date. It does not request comment threads, private messages or account profiles.
