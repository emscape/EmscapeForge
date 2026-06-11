# Augment Agents

Augment Code subagents live here. These use Augment's agent format, which differs from Claude Code's `.claude/agents/` format.

## Status

This directory is a placeholder. Augment agent files (`.md` with Augment-specific frontmatter) should be added here when the project needs Augment-specific subagent definitions.

## Relationship to Claude Code Agents

The Claude Code agents in `../../../claude/agents/` contain the canonical role definitions, constraints, and behavioral rules. When writing Augment agents, adapt those definitions to Augment's format rather than starting from scratch.

## Note on Shared Capabilities

Skills and commands are shared between Claude Code and Augment via `.claude/skills/` and `.claude/commands/`. You do not need Augment-specific versions of those.
