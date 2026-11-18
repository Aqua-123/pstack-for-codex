# Copilot review for merge readiness

Use this procedure for the current frontier in [Babysit](../playbooks/babysit.md) and [Shipping](../playbooks/shipping.md).

## Identify the PR version

- Read `baseRefName`, `baseRefOid`, and `headRefOid` with `gh pr view NUMBER --repo OWNER/REPO --json state,isDraft,baseRefName,baseRefOid,headRefOid,reviewRequests,reviewDecision`. Record the repository, PR number, and those three ref fields together. Any change to the three fields invalidates the recorded review, even if the head SHA stays the same.
- Before requesting a review, confirm the PR is open and that the current version has passed required CI. Use `gh pr checks NUMBER --repo OWNER/REPO --required` to distinguish required checks from the full rollup. If no checks appear, establish that none are required before proceeding.
- List reviews with `gh api repos/OWNER/REPO/pulls/NUMBER/reviews --paginate`. Reuse an existing review when the recorded evidence ties its ID to the current PR version. GitHub's `commit_id` identifies the head only. A review without evidence of which base it covered cannot clear the gate.
- If a request is already pending, including a request from automatic review, follow it. If you cannot tie the resulting review to the current version, treat it as stale or unverified. Use the PR review requests and the PR timeline to reconcile pending requests. Treat Actions runs as hints unless you can tie a run to the PR and review request. The absence of a run does not prove the request failed.

## Request and reconcile

When the current version has green CI and still needs a review, reread the ref fields. If any changed, repeat the CI check and preflight. Otherwise record the PR version, request start time, and latest known Copilot review ID in the babysit checkpoint. Submit `gh api --include --method POST repos/OWNER/REPO/pulls/NUMBER/copilot-code-review` on the GitHub host that owns the PR.

| GitHub result | Action |
| --- | --- |
| `201` with `PENDING` | Record the request `node_id` and wait for a submitted review. |
| `409` | A request for this PR is pending. Follow it. If it covers an earlier version, wait for it to finish before asking for the current version. |
| `422` | Read `failure_reason`. Quota, eligibility, and licensing denials block review. Surface the reason so the owner can address it or authorize a substitute. |
| `401`, `403`, or `404` | Check the host, PR, and permissions. Report the blocker if access cannot be restored. |
| `429` | Honor `Retry-After` when present. Otherwise wait for the next scheduled check. Reconcile the PR before retrying within the deadline. |
| `503`, a network timeout, or an unknown result | Reread pending requests and submitted reviews before any retry. When acceptance remains ambiguous, keep waiting within the deadline. Retry at most once within that deadline when the evidence shows that no request was accepted. |

See the [GitHub Copilot review endpoint](https://docs.github.com/en/rest/pulls/copilot-code-review) for the response contract. A resume starts with a read, including when the previous POST response was lost. Retry a terminal request on the same version only after the blocker clears and another request is authorized.

## Wait and assess

Use a completion event when available. Otherwise check after 1 minute, then at 3 and 5 minutes from the start. Allow 3 to 5 minutes for repos that commonly take that long. Continue at 5-minute intervals, with a default deadline of 15 minutes from the first request attempt or the first observation of an existing pending request. Keep the original deadline on resume. Use a bounded wait in the current task when an authorized heartbeat is unavailable. At the deadline, stop polling and report the missing review as a blocker. Include the PR version, request ID if known, last result, and next action.

Accept a submitted, non-dismissed review from `copilot-pull-request-reviewer[bot]` with `commit_id` equal to the current head. For a request GitHub accepted during the run, verify that the review is new since the request and that the observed PR version stayed the same through assessment. For pending or completed reviews from an earlier run or another actor, require a checkpoint or forge evidence that ties the review to that version. If GitHub posts an error or quota notice as `COMMENTED`, keep the review blocked. Read the body and its inline threads. Assess summary claims even when the review has no inline comments.

Triage the findings using [automated review triage](bugbot-triage.md). Record the review ID and the disposition of the findings. If the owner authorizes a different reviewer, require that review to complete on the same version and assess its findings before clearing the review gate. Required GitHub approvals remain a separate check.
