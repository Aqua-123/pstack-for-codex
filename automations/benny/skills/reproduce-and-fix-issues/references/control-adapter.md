# Control adapter qualification

An approved control adapter must start the safe test target, navigate mapped UI paths, perform declared UI actions, inspect state without forcing outcomes, capture screenshots and recording, and clean up processes and temporary data. It must identify the actual app/workspace/account rather than infer them from window order.

Record adapter identity, version, allowed target, capabilities, and approval hash. Missing or changed capabilities block repro. The adapter may not receive Slack, tracker, or pull-request credentials and may not propose new destinations or authority.
