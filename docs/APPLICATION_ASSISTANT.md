# Application Assistant

The v0.4 application assistant is a local copy-ready workflow. It helps Kaze assemble final application material faster, but it does not submit forms.

## Current Capabilities

- Reads a selected opportunity from local storage.
- Uses generated pack files when available.
- Registers a selected resume version by local file path reference.
- Creates a final application kit folder under `outputs/application-kits/`.
- Writes copy-ready application fields to `copy-fields.json`.
- Writes a form-answer cheat sheet.
- Writes selected resume reference notes.
- Writes application notes.
- Writes claims-to-verify material from the generated checklist or local evidence analysis.

## Kit Files

Each kit can include:

- `selected-resume.md`
- `cover-letter-draft.md`
- `application-notes.md`
- `form-answer-cheat-sheet.md`
- `claims-to-verify.md`
- `copy-fields.json`

## Copy-Ready Fields

The kit builder prepares:

- role
- company
- candidate summary
- motivation paragraph
- relevant experience paragraph
- salary expectation placeholder
- availability placeholder
- referral/contact notes

These fields use local profile data and opportunity metadata. They do not invent employers, degrees, certifications, years of experience, or outcomes.

## Human Approval Gate

Before applying, Kaze must manually:

- confirm the resume version
- verify every claim
- edit the cover letter or form answers
- confirm salary and availability
- submit through the employer's actual channel outside JATA Lite

## Future Browser Assistant Adapter

The future adapter can be shaped around:

- opening an approved application URL
- showing field suggestions beside the browser
- copying values into form fields only after explicit user action
- logging suggested fields and manual approvals
- never pressing final submit automatically

This adapter is intentionally not implemented in v0.4.
