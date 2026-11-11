# Reddit access plan

The initial intended use is a single user's personal browsing, without monetization. Publishing this source allows review; it does not create a hosted service or a shared Reddit data feed.

Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) requires approval before Data API use. Eligible approved uses can receive free access under Reddit's [published rate limits](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki). Approval and eligibility are decisions for Reddit.

## Requested behavior

Use read-only public submission search to find links to the current webpage. Display the title, subreddit, permalink, score, comment count and date, then open the original Reddit discussion when selected. No posting, voting, comments, messages, moderation, account profiling, private-content access, model training or data resale is planned.

The extension needs Chrome's active-tab URL and toolbar UI on websites outside Reddit. This differs from a Reddit-hosted Devvit app installed in a community. Reddit's [developer FAQ](https://developers.reddit.com/docs/guides/faq) directs external integrations to the Data API access process.

## Current and proposed implementation

The current source is a prototype using anonymous JSON search, which returned HTTP 403. OAuth is not implemented, and the README does not claim approved access or working automatic Reddit coverage.

After approval, the intended route is an installed-app OAuth client. Reddit's [OAuth documentation](https://github.com/reddit-archive/reddit/wiki/OAuth2#application-only-oauth) describes an app-only installed-client grant with a client ID and no client secret. Its availability must be verified for the approved client before depending on it.

Before enabling approved access:

- Add and verify OAuth token handling and the necessary host permission.
- Monitor Reddit's rate-limit response headers and honor the assigned limits.
- Complete cache expiry and deleted-content handling; freshness TTL alone is insufficient.
- Verify real Reddit matches, including unavailable and rate-limited cases.
- Finish installed-extension UAT and loading/resource comparisons.

The application and account contact details are managed separately and are not part of this repository. Source publication does not mean that an access request has been submitted or approved.
