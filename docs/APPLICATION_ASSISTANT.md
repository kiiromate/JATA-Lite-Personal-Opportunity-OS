# Application Assistant

The v0.4 application assistant is a local copy-ready workflow. It helps Kaze assemble final application material faster, but it does not submit forms.

## Current Capabilities

- Reads a selected opportunity from local storage.
- Uses generated pack files when available.
- Registers a selected resume version by local file path reference.
- Creates a final application kit folder under `outputs/application-kits/`.
- Writes copy-ready application fields to `copy-fields.json`, including candidate summary, motivation paragraph, relevant experience paragraph, cover email, referral message, and form answer cheat sheet.
- Writes a form-answer cheat sheet.
- Writes selected resume reference notes.
- Writes application notes.
- Writes claims-to-verify material from the generated checklist or local evidence analysis.
- Writes a final submission checklist.
- Records the generated kit directory back onto the local opportunity record.

## Kit Files

Each kit can include:

- `selected-resume.md`
- `cover-letter-draft.md`
- `application-notes.md`
- `form-answer-cheat-sheet.md`
- `claims-to-verify.md`
- `final-application-checklist.md`
- `copy-fields.json`

## Copy-Ready Fields

The kit builder prepares:

- role
- company
- candidate summary
- motivation paragraph
- relevant experience paragraph
- cover email
- referral message
- form answer cheat sheet
- salary expectation placeholder
- availability placeholder
- referral/contact notes

These fields use local profile data and opportunity metadata. They do not invent employers, degrees, certifications, years of experience, or outcomes.

## Human Approval Gate

Before applying, Kaze must manually:

- confirm the resume version
- review the cover letter or cover email
- verify every claim and resolve evidence-needed items
- edit form answers
- open the real application URL
- confirm salary and availability
- submit through the employer's actual channel outside JATA Lite
- return to Pipeline and update the status after submission

## Manual Boundaries

JATA Lite v0.4.1 is a manual-assist tool:

- It does not parse PDFs.
- It does not upload resumes.
- It does not open or fill third-party forms automatically.
- It does not send email, submit applications, or apply in the background.
- It keeps generated kits under ignored local output paths unless Kaze explicitly chooses to share them elsewhere.

## Future Browser Assistant Adapter

The future adapter can be shaped around:

- opening an approved application URL
- showing field suggestions beside the browser
- copying values into form fields only after explicit user action
- logging suggested fields and manual approvals
- never pressing final submit automatically

This adapter is intentionally not implemented in v0.4.
