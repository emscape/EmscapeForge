<#
.SYNOPSIS
Initializes or updates a project directory with the Roo Memory System and MCP configuration structure.

.DESCRIPTION
This script sets up the necessary directories and default configuration files for the Roo Memory System.
It can be run on a new project to initialize the structure or on an existing project to add missing components.
It checks for the existence of the 'memory-bank' directory to determine whether to perform a full initialization
or just apply missing parts.

.PARAMETER ProjectPath
The root path of the project where the Roo structure should be set up. Defaults to the current directory.

.EXAMPLE
.\Setup-RooProject.ps1
Sets up the Roo structure in the current directory.

.EXAMPLE
.\Setup-RooProject.ps1 -ProjectPath "C:\MyProject"
Sets up the Roo structure in the specified project directory.
#>
param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectPath = "."
)

# --- Helper Functions ---

# Function to create a directory if it doesn't exist
function Ensure-DirectoryExists {
    param(
        [string]$Path
    )
    if (-not (Test-Path -Path $Path -PathType Container)) {
        try {
            New-Item -Path $Path -ItemType Directory -Force -ErrorAction Stop | Out-Null
            Write-Host "Created directory: $Path"
        } catch {
            Write-Error "Failed to create directory: $Path. Error: $($_.Exception.Message)"
            exit 1
        }
    } else {
        # Write-Host "Directory already exists: $Path" # Optional: uncomment for verbose output
    }
}

# Function to create a file with default content if it doesn't exist
function Ensure-FileExists {
    param(
        [string]$Path,
        [string]$DefaultContent = ""
    )
    if (-not (Test-Path -Path $Path -PathType Leaf)) {
        try {
            # Ensure parent directory exists
            $ParentDir = Split-Path -Path $Path -Parent
            Ensure-DirectoryExists -Path $ParentDir

            # Create the file
            Set-Content -Path $Path -Value $DefaultContent -Encoding UTF8 -ErrorAction Stop
            Write-Host "Created file: $Path"
        } catch {
            Write-Error "Failed to create file: $Path. Error: $($_.Exception.Message)"
            # Consider if script should exit here depending on file importance
        }
    } else {
         # Write-Host "File already exists: $Path" # Optional: uncomment for verbose output
    }
}


# --- Main Script Logic ---

try {
    $ResolvedPath = Resolve-Path -Path $ProjectPath -ErrorAction Stop
    Write-Host "Setting up Roo structure in: $ResolvedPath"

    # Define core paths relative to the resolved project path
    $MemoryBankPath = Join-Path -Path $ResolvedPath -ChildPath "memory-bank"
    $MemoryBankArchivesPath = Join-Path -Path $MemoryBankPath -ChildPath "archives"
    $MemoryArchivesPath = Join-Path -Path $ResolvedPath -ChildPath "memory-archives"
    $RooConfigPath = Join-Path -Path $ResolvedPath -ChildPath ".roo"

    # Determine mode: Initialize (memory-bank doesn't exist) or Apply (memory-bank exists)
    $InitializeMode = -not (Test-Path -Path $MemoryBankPath -PathType Container)

    if ($InitializeMode) {
        Write-Host "Initialize Mode: 'memory-bank' directory not found. Creating full structure."
    } else {
        Write-Host "Apply Mode: 'memory-bank' directory found. Ensuring structure and creating missing files."
    }

    # 1. Ensure Core Directories Exist
    Ensure-DirectoryExists -Path $MemoryBankPath
    Ensure-DirectoryExists -Path $MemoryBankArchivesPath
    Ensure-DirectoryExists -Path $MemoryArchivesPath
    Ensure-DirectoryExists -Path $RooConfigPath

    # 2. Ensure Memory Bank Config File Exists
    $MemoryConfigFilePath = Join-Path -Path $MemoryBankPath -ChildPath "memory-config.json"
    $DefaultMemoryConfigContent = @"
{
  "projectName": "DefaultProject",
  "status": "active",
  "archival": {
    "strategy": "manual",
    "retentionDays": null
  },
  "tags": [
    "<!-- @active -->",
    "<!-- @completed -->",
    "<!-- @project:ProjectName -->"
  ]
}
"@
    Ensure-FileExists -Path $MemoryConfigFilePath -DefaultContent $DefaultMemoryConfigContent

    # 3. Ensure MCP Config File Exists (Correct Path: .roo/)
    $McpConfigFilePath = Join-Path -Path $RooConfigPath -ChildPath "mcp-config.json"
    # Default content with placeholders and servers disabled
    $DefaultMcpConfigContent = @"
{
  "mcpServers": [
    {
      "name": "filesystem",
      "description": "Access local filesystem.",
      "enabled": false,
      "protocol": "http",
      "host": "localhost",
      "port": 3000,
      "basePath": "/",
      "authentication": {
        "type": "none"
      },
      "allowedTools": [],
      "rateLimit": {
        "requests": 100,
        "perSeconds": 60
      },
      "timeoutSeconds": 30
    },
    {
      "name": "git",
      "description": "Interact with Git repositories.",
      "enabled": false,
      "protocol": "http",
      "host": "localhost",
      "port": 3001,
      "basePath": "/",
      "authentication": {
        "type": "env",
        "envVar": "<Optional: Environment variable name for PAT, e.g., GIT_PAT>"
      },
      "allowedTools": [],
       "rateLimit": {
        "requests": 60,
        "perSeconds": 60
      },
      "timeoutSeconds": 60
    },
    {
        "name": "brave_search",
        "description": "Perform web searches using Brave Search API.",
        "enabled": false,
        "protocol": "https",
        "host": "api.search.brave.com",
        "port": 443,
        "basePath": "/res",
        "authentication": {
            "type": "header",
            "headerName": "X-Subscription-Token",
            "envVar": "<Specify Environment variable name for Brave API Key>"
        },
        "allowedTools": ["search"],
        "rateLimit": {
            "requests": 5,
            "perSeconds": 1
        },
        "timeoutSeconds": 15
    }
    // Add other server configurations here following the schema
  ]
}
"@
    Ensure-FileExists -Path $McpConfigFilePath -DefaultContent $DefaultMcpConfigContent

    # 4. Ensure Memory Bank Archive Placeholders Exist
    $ArchiveIndexContent = "# Archive Index"
    Ensure-FileExists -Path (Join-Path -Path $MemoryBankArchivesPath -ChildPath "archive-index.md") -DefaultContent $ArchiveIndexContent
    Ensure-FileExists -Path (Join-Path -Path $MemoryBankArchivesPath -ChildPath "activeContext-archive.md") -DefaultContent "# Active Context Archive"
    Ensure-FileExists -Path (Join-Path -Path $MemoryBankArchivesPath -ChildPath "decisionLog-archive.md") -DefaultContent "# Decision Log Archive"
    Ensure-FileExists -Path (Join-Path -Path $MemoryBankArchivesPath -ChildPath "productContext-archive.md") -DefaultContent "# Product Context Archive"
    Ensure-FileExists -Path (Join-Path -Path $MemoryBankArchivesPath -ChildPath "progress-archive.md") -DefaultContent "# Progress Archive"
    Ensure-FileExists -Path (Join-Path -Path $MemoryBankArchivesPath -ChildPath "systemPatterns-archive.md") -DefaultContent "# System Patterns Archive"

    # 5. Ensure Core Memory Bank Files Exist (Only create if missing, never overwrite existing data)
    if ($InitializeMode) {
        # Only create these default files if we are initializing fully
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "activeContext.md") -DefaultContent @"
# Active Context

This file contains active context information for ongoing projects.

## Usage Guidelines

- Use `<!-- @active -->` tags for currently active information
- Use `<!-- @project:ProjectName -->` tags to associate entries with specific projects
- Use `<!-- @completed -->` tags for completed tasks or information

## Active Entries

<!-- Add initial active context here -->
"@
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "decisionLog.md") -DefaultContent @"
# Decision Log

This file tracks important decisions made during project development.

## Usage Guidelines

- Use `<!-- @active -->` tags for currently relevant decisions
- Use `<!-- @project:ProjectName -->` tags to associate decisions with specific projects
- Use `<!-- @completed -->` tags for decisions that have been fully implemented or are no longer relevant

## Decision Entries

<!-- Log initial decisions here -->
"@
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "productContext.md") -DefaultContent @"
# Product Context

This file contains information about products, features, and requirements.

## Usage Guidelines

- Use `<!-- @active -->` tags for currently relevant product information
- Use `<!-- @project:ProjectName -->` tags to associate information with specific projects
- Use `<!-- @completed -->` tags for completed features or outdated requirements

## Product Information

<!-- Add initial product context here -->
"@
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "progress.md") -DefaultContent @"
# Progress Log

This file tracks progress on various projects and tasks.

## Usage Guidelines

- Use `<!-- @active -->` tags for ongoing tasks and progress updates
- Use `<!-- @project:ProjectName -->` tags to associate progress with specific projects
- Use `<!-- @completed -->` tags for completed tasks and milestones

## Progress Entries

<!-- Log initial progress here -->
"@
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "systemPatterns.md") -DefaultContent @"
# System Patterns

This file documents system patterns, conventions, and best practices.

## Usage Guidelines

- Use `<!-- @active -->` tags for currently relevant patterns and practices
- Use `<!-- @project:ProjectName -->` tags to associate patterns with specific projects
- Use `<!-- @completed -->` tags for deprecated or replaced patterns

## Pattern Entries

<!-- Document initial system patterns here -->
"@
    } else {
        # In Apply mode, we might still want to ensure the files exist, but with empty content if missing,
        # to avoid overwriting user data accidentally. Let's just ensure they exist without content.
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "activeContext.md")
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "decisionLog.md")
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "productContext.md")
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "progress.md")
        Ensure-FileExists -Path (Join-Path -Path $MemoryBankPath -ChildPath "systemPatterns.md")
    }

    # 6. Optional: Ensure default .roo files exist (e.g., .roomodes, system prompts)
    # Add Ensure-FileExists calls here if needed for default prompts or .roomodes
    # Example: Ensure-FileExists -Path (Join-Path -Path $RooConfigPath -ChildPath ".roomodes") -DefaultContent "{...}"

    Write-Host "Roo structure setup complete in: $ResolvedPath"

} catch {
    Write-Error "An error occurred during Roo setup: $($_.Exception.Message)"
    exit 1
}