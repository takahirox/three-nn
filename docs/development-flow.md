# Development flow

Work in three-nn follows **Issue → implementation → PR → review → revision as
needed → merge**. Add post-merge work only when the actual Issue requires it.
Target `main` unless the Issue or authorized workflow specifies another branch.

## Collaboration language

Use **English** for repository documentation, agent guidance, templates, Issue/PR
titles and bodies, reviews and commit messages. This does not require translating
historical material or changing product localization or the maintainer's chat
language.

## Scope and acceptance

Read the current Issue, relevant discussion and repository instructions. Use the
[Issue template](../.github/ISSUE_TEMPLATE/issue.md) to describe the problem,
expected outcome, context and acceptance criteria with stable identifiers.
Preserve approved owner decisions within their agreed scope. A later clarification
replaces the superseded requirement; update acceptance and evidence accordingly.
Resolve genuinely blocking ambiguity before dependent work and continue independent
work while awaiting necessary input.

Implement the smallest coherent change that fully satisfies the Issue. Assess
both missing requirements and unnecessary scope, abstractions, unrelated refactors,
frameworks, dependencies and configuration. Simplicity must preserve required
behavior and validation.

Keep three categories distinct:

- **Mandatory pre-merge acceptance:** requirements and checks achievable and
  verifiable before merge.
- **Optional validation:** useful extra checks outside completion criteria.
- **Required post-merge verification:** genuinely required checks possible only
  after merge. Include them as completion requirements only when the actual Issue
  explicitly requires them; otherwise state "None required."

Use ordinary implementation judgment within authorized scope. Do not create new
human-approval gates for routine choices or optional manual follow-up. Require
external evidence or decisions only when necessary for the actual Issue, stating
why and the expected evidence. A merge-triggered deployment cannot be a pre-merge
prerequisite. These categories do not waive implementation or applicable checks.

## Implementation and validation

Inspect the current tree before editing. The neural shading demo uses Vite,
Three.js WebGPU/TSL and Node's built-in test runner. Use `npm test` for the model
contract/accuracy checks and `npm run build` for the production build. Browser
shader or interaction changes also need a WebGPU browser smoke test; a build alone
does not validate GPU execution. Offline training uses the separate Python setup
in the README. No CI or deployment tooling is established; do not invent results.

Apply the [UI/UX and layout principles](ui-ux-principles.md) when interfaces are
introduced. Choose checks using the [test and CI performance principles](testing-ci-principles.md)
and tooling actually present.

For documentation changes, validate template metadata, Markdown structure, local
links and heading anchors, cross-document consistency and whitespace. Run
`git diff --check`, or `git diff --cached --check` for staged changes. Inspect the
complete diff including added files; an unstaged diff alone omits untracked files.
Use available lightweight checks without adding dependencies or unrelated runtime
suites, browser checks or design-approval requirements.

Record each command or method, relevant revision, actual outcome and limitations:

- **Pass:** executed successfully.
- **Fail:** executed and failed; record the cause and required correction.
- **Skipped:** deliberately omitted; state why.
- **Not run:** unperformed or unavailable; state why and the resume condition.

Pending CI is **Not run**, with its pending state and run reference identified;
it is not a pass. A skipped or unperformed mandatory check remains unmet.

## PR, review and revision

Use the [PR template](../.github/pull_request_template.md) to describe the resulting
behavior, focused changes, related Issue, evidence for every criterion at the
current head, actual results and remaining scope. Keep optional validation and
required post-merge verification separate from pre-merge acceptance.

Follow the [review and merge guidelines](review-guidelines.md) for full-Issue
review, closing references, authorized partial work and merge readiness. Fix
demonstrated defects and unmet requirements through normal revision, then review
the updated head and affected evidence. Wait for pending CI or resolution of a
real blocker before repeating an unchanged review, publication or merge attempt.

## Merge and follow-up

Merge the reviewed current head after applicable mandatory checks pass, under
existing repository/workflow authorization and required protections as defined in
the review guide. These documents do not grant merge permission or add a blanket
human-approval requirement.

Keep genuinely required post-merge-only checks pending until performed, then record
actual results and follow-up. Pre-merge success does not prove deployment or
publication success. This documentation/template baseline requires no post-merge
verification.
