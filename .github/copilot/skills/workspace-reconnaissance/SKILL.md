---
name: workspace-reconnaissance
description: "Use when: asking questions about your repos, onboarding to a large workspace, or planning cross-project changes. Scans all projects to detect tech stacks, dependencies, and inter-service relationships. Generates a comprehensive markdown landscape report."
argument-hint: "Optional: focus area (e.g., 'tech debt', 'modernization', 'dependencies', or leave blank for full scan)"
user-invocable: true
---

# Workspace Reconnaissance

## What This Skill Does

Performs a comprehensive scan of your entire workspace to generate a **technology landscape report**. Discovers:
- All projects and their locations
- Tech stacks and languages (TypeScript, Python, Java, Dart, Node.js, etc.)
- Key frameworks and libraries
- Project dependencies and inter-service relationships
- Build systems and deployment targets
- Modernization opportunities and tech debt indicators

## When to Use

- **Onboarding**: New to the workspace and need a quick understanding of the project ecosystem
- **Asking project questions**: "What projects use this tech?", "Which projects depend on X?"
- **Planning cross-project changes**: Understand impact radius before refactoring shared concerns
- **Architecture planning**: See the full system landscape before designing new services
- **Modernization assessment**: Identify tech debt and standardization opportunities
- **Technology inventory**: Track what's deployed, what's maintained, what's deprecated

## Procedure

### Step 1: Discover Projects
Scan the workspace root to find all project folders. Identify markers:
- `package.json` → Node.js/TypeScript/JavaScript project
- `pom.xml` or `build.gradle` → Java project
- `pubspec.yaml` → Flutter/Dart project
- `pyproject.toml` or `requirements.txt` → Python project
- `go.mod` → Go project
- `Dockerfile` or `docker-compose.yml` → Containerized/Infrastructure
- `.github/workflows/`, `netlify.toml` → Deployment configuration

### Step 2: Extract Metadata
For each project, collect:
- **Name and path**
- **Primary language(s)** and tech stack
- **Key dependencies** (major frameworks, tools)
- **Build system** (npm, Maven, Poetry, etc.)
- **Deployment target** (web, serverless, container, native, etc.)
- **Health indicators** (README presence, active maintenance, test coverage hints)

### Step 3: Map Dependencies
Identify relationships between projects:
- **Direct imports/references** — does project A import from project B?
- **Shared infrastructure** — databases, APIs, message queues
- **Deployment chains** — which projects deploy together?
- **Team ownership** (if available from docs/CODEOWNERS)

### Step 4: Generate Landscape Report
Create a markdown document with:
- **Executive summary** — project count, language distribution, deployment targets
- **Projects by tech stack** — grouped (Frontend, Backend, Tooling, Infrastructure, etc.)
- **Dependency map** — visual guide of service relationships
- **Modernization opportunities** — tech debt, version gaps, consolidation candidates
- **Quick reference table** — all projects at a glance

### Step 5: Identify Hotspots
Flag:
- **Version drift** — same library at different versions across projects
- **Deprecated tech** — outdated versions or end-of-life platforms
- **Inconsistencies** — project config patterns that could be standardized
- **Optimization candidates** — shared code, common patterns to abstract

## Scope Options

When invoking the skill, you can optionally focus on a specific area:
- **Full scan** (default) — all projects and relationships
- **`tech-debt`** — focus on outdated versions and deprecation warnings
- **`dependencies`** — map inter-project dependencies and shared infrastructure
- **`modernization`** — identify upgrade opportunities and standardization
- **`deployment`** — focus on deployment targets and infrastructure patterns

## Output

A comprehensive markdown report saved to `.github/reports/workspace-landscape-{timestamp}.md` containing:
- Project inventory and tech stack breakdown
- Mermaid diagram of service relationships (if available)
- Modernization recommendations
- Quick reference tables

## Next Steps After the Report

- Use the [architect-outline](../agents/architect-outline.agent.md) agent to design a new service
- Follow up on specific recommendations (e.g., "update Python projects to 3.10+")
- Plan a tech debt sprint based on identified hotspots
- Standardize build configs or deployment approaches across similar projects
