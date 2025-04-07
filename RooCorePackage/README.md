# Roo Core: Memory System &amp; MCP Integration

This package provides the core scripts and modules for integrating the Roo Memory System and Model Context Protocol (MCP) capabilities into your project.

## Purpose

*   **Memory System:** Helps maintain project context (decisions, progress, patterns, etc.) across development sessions.
*   **MCP Integration:** Allows Roo to interact with external tools and services (like local filesystem, Git, web search) via configured MCP servers, enabling more powerful actions directly within the development workflow.

## Prerequisites

*   **PowerShell:** Version 5.1 or later.
*   **Git:** Required for Git MCP server functionality. Ensure `git.exe` is accessible in your system's PATH.
*   **(Optional) API Keys/Tokens:** For specific MCP servers (e.g., Brave Search API Key, Git PAT).

## Setup Steps (Windows)

1.  **Copy Files:** Copy all files and folders from this "Roo Core" package into the root directory of your project. Your project root should now contain `scripts/`, `modules/`, `.roo/` (if included), and `memory-manager.ps1`.
2.  **Open PowerShell:** Open a PowerShell terminal in your project's root directory.
3.  **Run Setup Script:** Execute the setup script by running the following command:
    ```powershell
    .\scripts\Setup-RooProject.ps1
    ```
4.  **Outcome:** This script will create the necessary directory structure (`memory-bank/`, `memory-bank/archives/`, `memory-archives/`, `.roo/`) and default configuration files (`memory-bank/memory-config.json`, `.roo/mcp-config.json`, archive placeholders) if they don't already exist. It will not overwrite existing memory bank files (`*.md`).

## Configuration

1.  **Environment Variables:** Many MCP servers require credentials (like API keys or tokens) which should **never** be stored directly in configuration files. The recommended way to manage these is using environment variables.
    *   **Recommendation:** Create a file named `.env` in your project root. Add your secrets to this file in the format `VARIABLE_NAME=your_secret_value`.
    *   **Example `.env` content:**
        ```dotenv
        # .env - Example Environment Variables (Use your own keys!)
        BRAVE_SEARCH_API_KEY=YOUR_ACTUAL_BRAVE_API_KEY
        GIT_PAT=YOUR_ACTUAL_GIT_PERSONAL_ACCESS_TOKEN
        ```
    *   **Security:** Ensure your `.env` file is added to your `.gitignore` file to prevent accidentally committing secrets.
    *   **Note:** The `Configure-McpServers.ps1` script will check this `.env` file for required variables when you enable servers.

2.  **Configure MCP Servers:** The `.roo/mcp-config.json` file defines available MCP servers, but they are disabled by default. To enable and configure them:
    *   Run the interactive configuration script:
        ```powershell
        .\scripts\Configure-McpServers.ps1
        ```
    *   Follow the prompts to enable the servers you want Roo to use (e.g., `filesystem`, `git`, `braveSearch`).
    *   For each enabled server, select the specific tools you want to allow Roo to use (e.g., allow `readFile` but not `writeFile` for the `filesystem` server).
    *   The script will remind you if any necessary environment variables (based on the server's configuration in `mcp-config.json` and expected keys in your `.env` file) are missing for the servers you enabled.

## Usage

Once set up and configured:

*   Roo will automatically detect and use the `memory-bank/` to maintain context during your chat sessions.
*   When you ask Roo to perform actions that require external tools (e.g., "read the contents of `src/app.js`", "commit the current changes", "search the web for 'PowerShell best practices'"), Roo will attempt to use the enabled and authorized MCP servers via the `Execute-McpTool` function in `modules/McpHandler.psm1`.

---

*This README provides basic setup instructions. Refer to the individual script comments and module functions for more detailed information.*