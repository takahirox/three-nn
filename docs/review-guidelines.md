# Review and merge guidelines

Follow the [development flow](development-flow.md), including the
[English collaboration convention](development-flow.md#collaboration-language).

## Review the full Issue against the current head

Read the full current Issue and discussion, PR description, complete diff including
added files, and validation evidence. Identify the actual current PR head commit.
Map every required Issue criterion to implementation and evidence at that head,
recording gaps. Confirm that earlier evidence still applies; rerun affected checks
when needed. A changed head needs review of its changes and relevant evidence.

Assess correctness, consistency and affected documentation. Check both missing
requirements and unnecessary scope, abstractions, unrelated refactors, frameworks,
dependencies and configuration. Prefer the smallest coherent change that fulfills
the Issue. Review interfaces against the [UI/UX and layout principles](ui-ux-principles.md).

Preserve approved owner decisions within their agreed scope. A later clarification
replaces its superseded requirement; assess the current scope and update the
criterion and evidence rather than retaining conflicting requirements. Do not
repeatedly request a resolved decision or treat silence as agreement.

## Evaluate evidence

Use the [validation guidance](development-flow.md#implementation-and-validation)
and [test and CI performance principles](testing-ci-principles.md). Validate the
actual change with available tooling. Documentation checks cover metadata,
Markdown structure, local links/anchors, consistency and whitespace across the
complete diff, including added files.

Verify actual Pass, Fail, Skipped and Not run results with reasons for gaps.
Pending CI is not a pass; skipped or missing mandatory pre-merge checks remain
blockers.
Keep optional validation outside completion criteria. Ordinary implementation
choices and optional manual follow-up do not create new human-approval gates.
Require external evidence or decisions only when the actual Issue needs them,
with a concrete reason and expected evidence.

## Findings, blockers and waiting

- **Fixable finding:** identify the affected criterion or location, demonstrated
  defect or missing implementation/validation, and expected correction. Return it
  to the normal revision flow. Do not silently relabel incomplete work as partial
  success or demand external approval for a fix the implementer can perform.
- **External blocker:** identify the genuinely missing external evidence,
  dependency or decision, why it cannot be resolved within current authority,
  and the resume condition. Keep it separate from code defects and continue
  independent work. Preserve progress, findings and evidence while blocked.
- **Pending CI:** await the existing run before repeating an unchanged review,
  publication or merge attempt. Inspect failures and classify their cause as an
  implementation defect, infrastructure problem or external dependency before
  fixing or retrying. Retry only when evidence justifies it.

A completed check result, changed code or resolved blocker can justify another
review or attempt; unchanged state cannot. Resume dependent work when the stated
condition is met.

## Readiness and merge

Full Issue resolution requires all implementation and mandatory pre-merge criteria
to be met, with no unresolved blocking findings. Use a closing reference such as
`Closes #1` for that complete resolution, even when required post-merge-only checks
are pending. Preserve the normal closing reference added by ProjectWeave
publication. Review must not request its removal, keep the source Issue open or
withhold approval solely because those checks are pending; doing so causes the
Review → Fix → Publish → Review loop described in the
[development flow](development-flow.md#merge-and-follow-up).

An explicitly authorized partial integration may proceed under existing
maintainer/workflow authorization when its declared scope is complete and its
applicable mandatory checks pass. Still assess every Issue criterion, identify
remaining implementation and validation, retain unmet requirements, use a
non-closing reference such as `Related to #1`, and leave the source Issue open.
Authorized partial integration does not establish full Issue completion.
Pending post-merge-only verification does not make an otherwise complete
implementation partial. Missing implementation, mandatory pre-merge tests and
genuinely necessary pre-merge human acceptance remain blockers to full resolution.

Merge the reviewed current head once applicable required checks pass and readiness
for the authorized scope holds, following existing repository/workflow merge
authorization and required protections. This guide neither grants merge permission
nor adds a blanket human-approval gate. Do not bypass required checks. If the head
changes, reassess affected review and validation before merging.

## Post-merge verification

After successful merge, close the fully implemented original Issue, then perform
only the post-merge checks the actual Issue genuinely requires. Record each method,
affected revision, actual result and limitations in the merged PR, closed Issue or
a linked validation report, using the
[validation statuses](development-flow.md#implementation-and-validation).
Keep unperformed, pending or environment-blocked checks explicitly **Not run** with
their reason and resume condition. Issue closure does not claim those checks passed,
and an unavailable test environment alone is not evidence of a product defect.

When verification finds an actual defect, first check for an existing equivalent
Issue and use it if present; otherwise create a new Issue. Include reproduction
steps, affected revision, expected and actual behavior, and links to the original
Issue and merged PR. Do not keep or reopen the original Issue solely for this
post-merge follow-up.

Optional later checks stay outside completion criteria. A merge-triggered
deployment cannot be a pre-merge prerequisite, and pre-merge results do not prove
publication or deployment success. This lifecycle supersedes older instructions to
keep an implemented Issue open solely for post-merge verification, without rewriting
historical test outcomes or evidence. It does not waive implementation, mandatory
pre-merge acceptance or required protections. State "None required" when appropriate;
this documentation/template change requires none.
