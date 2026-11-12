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
Pending CI is not a pass; skipped or missing mandatory checks remain unmet.
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
`Closes #1` only for complete resolution.

An explicitly authorized partial integration may proceed under existing
maintainer/workflow authorization when its declared scope is complete and its
applicable mandatory checks pass. Still assess every Issue criterion, identify
remaining implementation and validation, retain unmet requirements, use a
non-closing reference such as `Related to #1`, and leave the source Issue open.
Authorized partial integration does not establish full Issue completion.

Merge the reviewed current head once applicable required checks pass and readiness
for the authorized scope holds, following existing repository/workflow merge
authorization and required protections. This guide neither grants merge permission
nor adds a blanket human-approval gate. Do not bypass required checks. If the head
changes, reassess affected review and validation before merging.

## Post-merge verification

Post-merge-only checks are completion requirements only when the actual Issue
explicitly requires them. Keep them pending until performed, then record actual
results and follow-up. Optional later checks stay outside completion criteria.
A merge-triggered deployment cannot be a pre-merge prerequisite, and pre-merge
results do not prove publication or deployment success. Required post-merge-only
checks do not make an otherwise complete implementation partial, but full Issue
completion must retain those pending requirements. They do not waive pre-merge
checks or implementation. State "None required" when appropriate; this
documentation/template baseline requires none.
