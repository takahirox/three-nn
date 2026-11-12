# Test and CI performance principles

Catch concrete defects at the lightest meaningful layer. Preserve necessary
assertions, regression confidence and meaningful integration coverage when moving
or simplifying checks.

## Current tooling and change-based validation

three-nn contains a Vite/Three.js WebGPU demo, a Node built-in numeric test
(`npm test`), and an offline PyTorch training script. `npm run build` checks the
production bundle. Shader compilation and interaction require an actual WebGPU
browser smoke test; report the backend and environment. No CI or deployment
tooling, timing baseline or CI performance budget is established. Do not invent
results, timings or workflows.

Match checks to the actual change and tooling:

- **Documentation/templates:** validate template metadata, Markdown structure,
  local links and heading anchors, cross-document consistency and whitespace.
  Run `git diff --check` or `git diff --cached --check`, and inspect the complete
  diff including added files. Use available lightweight tooling without adding
  dependencies or unrelated runtime suites solely for this baseline.
- **Logic, when introduced:** prefer fast unit/component tests for calculations,
  decisions and data handling.
- **Interfaces and integration boundaries, when introduced:** check relevant
  behavior, accessibility and rendering. Use costly integration/browser/device/
  service checks for boundaries that need those environments.
- **Build/CI changes, when introduced:** check the affected pipeline and artifacts.

Give fast feedback, required regression coverage, expensive exploratory checks and
deployment distinct responsibilities with suitable triggers. Follow the
[validation reporting convention](development-flow.md#implementation-and-validation):
record commands or methods, actual outcomes, limitations and skip reasons.
Pending or unperformed checks are not passes. Optional checks stay outside
completion criteria; post-merge-only checks are required only when the actual
Issue explicitly requires them. This baseline requires none.

## Meaningful coverage and representative fixtures

Each test should catch an identifiable defect. Avoid assertions that merely mirror
the implementation and equivalent duplicate suites. Cover distinct paths and risky
interactions with representative cases. Do not automatically combine every
environment, input, format and state; add combinations when their interactions
justify the additional coverage.

Prefer small synthetic or appropriately licensed representative fixtures. Justify
large datasets, downloads and external services by additional concrete defect
coverage that smaller local fixtures cannot supply. Record fixture sources and
licenses. Preserve necessary regressions and integration confidence while reducing
cost.

## Reuse and scheduling

When executable tooling exists, reuse appropriate builds, cached assets and
downloads with cache keys reflecting inputs, dependencies, toolchain and
environment. Keep runs isolated and prevent stale artifacts from appearing as
fresh results. Avoid equivalent push/PR validation of the same revision. Cancel
superseded work when safe, preserving necessary deployment ordering.

Choose parallelism from measured resource use and elapsed time. Extra workers can
increase setup, contention and total cost; parallelize independent checks where
measurements justify it.

## Cost review and measured budgets

Review every new or expanded check for additional defect coverage, duplication,
runtime and maintenance cost. Investigate CI growth, repeated setup, oversized
fixtures, large downloads and multiplication of combinations without weakening
required coverage.

When executable tooling exists, establish repository-specific measured baselines
and budgets from representative runs, recording commands and environments. Track
elapsed feedback time, total runner/resource use and queue time separately.
Investigate growth beyond the budgets and adjust layers, reuse, selection or
scheduling using evidence. Do not impose an invented universal time limit or claim
unmeasured improvements. Changes to tooling, triggers, caches or worker counts
belong in appropriately scoped implementation work with relevant validation.
