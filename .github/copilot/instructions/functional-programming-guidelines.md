---
applyTo: "**"

---
'# Copilot Prompt File: Implementation Guidelines

## Development Guidelines

If the best approach is unclear or you are unsure, ask Emily before proceeding.

### Functional Programming Guidelines
For all code implementation, follow the functional programming practices outlined in [functional-programming-guidelines.md](./functional-programming-guidelines.md). These guidelines ensure code quality, maintainability, and consistency across all AI-generated implementations.

### TDD/BDD and DRY Programming Guidelines
**MANDATORY**: Follow the Test-Driven Development and DRY principles outlined in [tdd-bdd-dry-guidelines.md](./tdd-bdd-dry-guidelines.md). Tests MUST be written BEFORE implementation code. Tests are documentation and should NOT be changed to fit implementation - implementation code must be adjusted to make assertions true.

## Implementation Planning Framework
When creating an implementation plan for any feature, system, or integration, ensure the plan covers the following 10 key areas for robustness and enterprise readiness:

1. **Current State Analysis**
   - Assess existing architecture, strengths, and gaps.
   - Identify missing features, limitations, and improvement opportunities.

2. **Comprehensive Requirements**
   - Define core and advanced user stories (CRUD, batch, lifecycle, integrations).
   - Include both functional and non-functional requirements.

3. **Performance & Scalability**
   - Plan for connection pooling, caching, async support, and throughput.
   - Address rate limiting and resource management.

4. **Security & Compliance**
   - Specify input validation, permission checks, audit logging, and secure defaults.
   - Consider compliance, monitoring, and alerting.

5. **API & Interface Design**
   - Detail REST, RPC, or other API endpoints and method mapping.
   - Include error handling, batch support, and extensibility.

6. **CLI & User Interface Integration**
   - Provide command-line or UI integration patterns and examples.
   - Ensure usability, output formatting, and help documentation.

7. **Phased Implementation & Success Criteria**
   - Break work into logical phases with objectives, tasks, and measurable criteria.
   - Enable incremental delivery and validation.

8. **Testing Strategy**
   - Cover unit, integration, performance, and security testing.
   - Include example test code and KPIs.

9. **Deployment, Monitoring & Operations**
   - Plan for deployment scripts, containerization, health checks, and monitoring.
   - Address operational runbooks and support.
   - Never commit to main directly. Create a feature branch and create a pull request for review.
   - Never commit without user approval of the content and commit messages.

10. **Documentation, Metrics & Risk Mitigation**
    - Ensure thorough documentation, KPIs, and risk management strategies.
    - Address backward compatibility, user adoption, and maintenance.

11. **MCP Usage**
    - Utilize the AI Panel (ai-panel) MCP Server frequently to check in on your decision-making and code quality. 


---

**Usage:**
Whenever you request an implementation plan, Copilot will use these guidelines to ensure the plan is robust, scalable, secure, and ready for enterprise deployment.'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

---
## Development Practices:
**Code Quality**
Use descriptive, verbose variable names to avoid shadowing
Keep files under 500 lines - refactor into logical components if longer
Write meaningful tests with realistic expectations, not just passing values
Use fixtures for test data - don't hardcode test values
**File Organization**
Test scripts: Save to /scripts folder
Python tools: Save to /python/src/tools directory
Log files: Save to /logs folder
Use shell scripts with zsh (not bash)
**Import Management**
Check the YAML file when adding imports
Don't introduce duplicate imports
Clean up imports when removing module dependencies
Follow existing import patterns in the codebase