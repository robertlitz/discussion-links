# Validation

Recorded on November 11, 2026. These checks describe the development prototype and their actual scope.

| Check | Observed result | Scope |
|---|---|---|
| Source and worker behavior | 19 passing tests | Production modules with Chrome API fixtures |
| Live Hacker News discovery | HTTP 200, 24 exact-link submissions | One Paul Graham article |
| Live Reddit discovery | HTTP 403 | Anonymous prototype endpoint; approval and OAuth still needed |
| Warm-cache engine lookup | Median 0.0037 ms, p95 0.0172 ms; no added requests | 2,000 Node iterations |
| Parsing 100 candidates | Median 0.3731 ms, p95 0.6483 ms | 100 Node iterations |
| Local page loading | Baseline median 15.6 ms; deferred-lookup median 15.5 ms | 30 local browser samples per mode, no installed extension |
| Local load p95 | Baseline 19.5 ms; lookup 17.2 ms | Descriptive variation, not a speedup claim |

Raw microbenchmark and browser-harness results are in [measurements](measurements/). They include timestamps and individual browser samples. Local timings vary with the machine, browser, cache state and other work.

## Functional coverage

The tests cover URL normalization, secret/local URL exclusions, exact-link filtering, duplicate handling, queue and cache bounds, shared requests, source timeouts, rate-limit backoff, bounded pagination/response sizes and request credential/referrer options.

Production-worker fixtures check post-load scheduling, badge API calls, cache reuse, hash navigation, Pause/resume, unsupported pages, inactive tabs and stale-navigation cancellation. Additional tests use hanging requests to verify active-tab cancellation, same-URL reopening and shared subscribers.

## Popup browser review

The actual popup files were served in the Codex browser through a fixture-only Chrome API bridge. Review covered source filtering, empty results, partial failure, Pause, loading, unsupported pages, long titles with unsafe-looking markup and a 200-link scrolling list. Markup-like titles rendered as text without creating image elements; the long-title and large-list cases had no horizontal overflow.

A separate captured-live-result view displayed all 24 HN matches. Its first link opened the expected HN discussion. The README screenshot shows a labeled fixture preview, not that captured live view.

## Remaining acceptance

An extension has not been installed through the browser tooling available for this development session. Actual toolbar rendering, Chrome's popup window dimensions, extension host-permission fetch behavior, worker sleep/restart and multiwindow behavior still need installed-browser checks.

The page harness does not measure worker startup, browser event dispatch, toolbar rendering or shared browser-process contention. The absence of page injection and interception reduces direct page work, but cannot prove literally zero system impact.

After installation, compare disabled and enabled runs on articles, documentation, a single-page app, video and a heavy news page. Include cache-cold/cache-warm, offline/throttled, rapid navigation and worker restart cases. Record load/FCP/LCP, long tasks, CPU, request count and result latency. Do not substitute fixture success for that evidence.

Reddit acceptance also requires legitimate API approval, OAuth implementation and successful live matching tests. Retention/deletion behavior must be verified before that integration is enabled.
