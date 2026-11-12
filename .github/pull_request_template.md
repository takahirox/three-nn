<!-- Write the title and body in English. Follow the canonical guides linked below. -->

## Problem and outcome

Link the source Issue and explain the problem and resulting behavior. Include
context, reproduction or a before/after example when useful.

## Focused changes

Describe what changed and why each change is needed for the outcome.

## Related Issues and remaining scope

Use `Closes #<number>` for complete resolution or `Related to #<number>` for partial
work, following the review guide. List remaining implementation and validation by
criterion, or state "None." For an authorized partial integration, identify its
declared scope and existing maintainer/workflow authorization, retain unmet
criteria and leave the source Issue open.

## Mandatory pre-merge acceptance and validation

Identify the actual current PR head assessed below. Add a row for every required
Issue criterion, including criteria outside a partial PR's scope. Preserve stable
identifiers such as AC1; quote the requirement when no identifier exists.

PR head: <!-- commit SHA -->

| Issue criterion | Implementation or document location | Actual check and evidence | Status and reason |
| --- | --- | --- | --- |
| AC1 | Relevant location | Command or method and actual result | Pass / Fail / Skipped / Not run; explain gaps |

Record the commands or methods actually used, results and limitations. Use the
statuses defined in the development guide. Identify pending CI as **Not run**
with its run reference and pending state. Include blockers and resume conditions
for missing required evidence; a skipped or unperformed mandatory check remains
unmet. Reassess evidence when the head changes.

## Optional validation

Report additional checks with the same statuses and evidence, or state
"None required." Keep these outside completion criteria.

## Required post-merge verification

List only checks the actual Issue explicitly requires that are possible only after
merge, why they require merge and the expected evidence, or state "None required."
Keep these **Pending** until performed, then record actual results and follow-up.

## Contributor guidance

- [Development flow](https://github.com/takahirox/three-nn/blob/main/docs/development-flow.md)
- [Review and merge guidelines](https://github.com/takahirox/three-nn/blob/main/docs/review-guidelines.md)
- [UI/UX and layout principles](https://github.com/takahirox/three-nn/blob/main/docs/ui-ux-principles.md)
- [Test and CI performance principles](https://github.com/takahirox/three-nn/blob/main/docs/testing-ci-principles.md)
