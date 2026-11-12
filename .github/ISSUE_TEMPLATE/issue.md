---
name: Issue
about: Report a problem or propose a focused change in three-nn
title: ""
labels: ""
assignees: ""
---

<!-- Write the title and body in English. Follow the canonical guides linked below. -->

## Problem

Describe the problem and who or what it affects.

## Expected outcome and scope

Describe the result that will resolve this Issue and the focused changes needed.
Identify scope boundaries and known remaining work outside this Issue.

## Context and reproduction

Include examples, logs, related Issues and relevant owner decisions. For a bug,
give reproduction steps, expected results and actual results. Otherwise explain
why reproduction does not apply.

## Mandatory pre-merge acceptance

List concrete requirements and checks verifiable before merge. Give each criterion
a stable identifier (AC1, AC2, ...) and preserve it through revisions so PR evidence
can map to it. Select checks using the canonical validation guidance below.

- [ ] **AC1:** Replace with a concrete, verifiable completion criterion.

## Validation already performed

Record each command or method, actual result, relevant revision and limitations.
Use **Pass**, **Fail**, **Skipped** or **Not run**, with reasons for gaps, following
the development guide. Identify pending CI and its run reference; it is not a pass.
If nothing was checked, state **Not run** and why. Existing evidence must be
reassessed against the eventual PR head.

## Optional validation

List useful additional checks outside completion criteria, or state "None required."

## Required post-merge verification

List only checks this Issue genuinely requires that are possible only after merge.
Explain why they require merge and what evidence is needed, or state "None required."
Keep required checks pending until performed.

## Contributor guidance

- [Development flow](https://github.com/takahirox/three-nn/blob/main/docs/development-flow.md)
- [Review and merge guidelines](https://github.com/takahirox/three-nn/blob/main/docs/review-guidelines.md)
- [UI/UX and layout principles](https://github.com/takahirox/three-nn/blob/main/docs/ui-ux-principles.md)
- [Test and CI performance principles](https://github.com/takahirox/three-nn/blob/main/docs/testing-ci-principles.md)
