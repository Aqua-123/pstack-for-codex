# Sentry Error History

## What this source contains

Sentry is the archive of things that went wrong. For defensive, corrective, or error-handling code, it often holds the direct motivation: the specific exceptions, stack traces, and frequencies that pushed someone to add a check, catch, retry, or fallback.

- **Issues.** Grouped errors with counts, first/last seen timestamps, affected releases, and comments
- **Events.** Individual error instances within an issue (stack traces, tags, user context)
- **Releases.** Deployment records with associated issues (useful for "which version fixed this?")
- **Replays.** Session recordings of user-facing errors (if enabled)
- **Profiles.** Performance profiling data (less useful for "why"; more for "how slow")
- **Issue comments & assignments.** Sometimes contain engineer notes on root cause

The most valuable thing Sentry provides is **temporal correlation**: "issue X was created 2024-01-02, peaked at 500 events/day, stopped appearing after release v2.14.0 on 2024-01-15, the release that shipped the defensive check."

## How to search it

Use the Sentry MCP.

1. **Orient.** If you don't know the project slug and organization:

   ```
   find_organizations
   find_projects
   ```

2. **Search for issues related to the target.**

   ```
   search_issues (natural language, e.g., "errors in PaymentService timeout", "unhandled exceptions in uploadFile")
   ```

   Build queries from the exception class names the target handles, its function or class name, the error message strings it checks for, and its file path.

3. **Narrow by release and time window.**

   ```
   search_issue_events (filter by release, time, environment, trace ID, tags)
   get_issue_tag_values (for an issue, see distribution across versions, users, environments)
   ```

   For a suspected issue, check **first seen** and **last seen** (does the stop line up with the target's ship date?), the **affected releases** (which saw it, and which was the fix?), and the **frequency trajectory** (did it spike, then get resolved?).

4. **Pull the full event for context.**

   ```
   get_sentry_resource (pass a Sentry URL or type+ID)
   ```

   Does the stack trace pass through the target code? Do the tags and breadcrumbs match the conditions the target defends against?

5. **Check releases that landed near the target.**

   ```
   find_releases (around the commit date of the target)
   ```

   Cross-reference release version with the PR's merge date.

6. **Use Seer sparingly.**

   ```
   analyze_issue_with_seer
   ```

   Seer's AI root-cause analyses are a hypothesis generator. Treat them as inference, not authoritative. The actual events and stack traces are the primary evidence.

## What to return

For each relevant issue:
- Issue ID and title
- Project and organization
- First seen / last seen timestamps
- Event count (and sampling rate if known)
- Affected releases
- A representative stack trace snippet showing relevance to the target (verbatim excerpt, not summary)
- First/last-seen correlation with the target's ship date
- Link to the issue
- Any author comments or resolution notes
