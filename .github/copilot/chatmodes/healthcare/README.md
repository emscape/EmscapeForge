# Healthcare Chatmodes (Digital Care Navigator)

Original chatmodes from the Digital Care Navigator project. These are domain-specific versions with FHIR, HIPAA, EHR, and clinical workflow content intact.

Use these as the starting point for healthcare/clinical projects. For general projects, use the parent `chatmodes/` folder instead.

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## Files

| File | Domain Specialization |
|------|-----------------------|
| `ask.chatmode.md` | Healthcare software consultant, FHIR/HL7/HIPAA awareness |
| `architect.chatmode.md` | FHIR architecture, EHR integration, HIPAA-compliant design |
| `developer.chatmode.md` | FHIR implementation, PHI handling, clinical workflow development |
| `orchestrator.chatmode.md` | Digital Care Navigator project orchestrator |
| `debug.chatmode.md` | FHIR/EHR/clinical workflow debugging |
| `security.chatmode.md` | HIPAA security rule, PHI protection, healthcare cybersecurity |
| `clinical.chatmode.md` | Clinical domain expert — workflows, regulatory, SNOMED/LOINC/ICD-10 |

## Usage

Copy the chatmodes you want into your project's `.github/chatmodes/` directory (or symlink from `agents-master` via `_setup/init.sh`), then activate them in VS Code's Copilot Chat panel.
