<#
.SYNOPSIS
Interactively configures MCP servers defined in .roo/mcp-config.json.
.DESCRIPTION
This script reads the MCP configuration file, iterates through each defined server,
and prompts the user to enable/disable the server and select allowed tools for enabled servers.
It then updates the configuration file with the user's choices and provides reminders
for necessary environment variables.
.NOTES
Author: Roo
Date: 2025-03-30
Requires: PowerShell 5.1 or later. Assumes script is run from the project root.
Ensure .roo/mcp-config.json exists before running.
#>
param()

# --- Configuration ---
$configPath = Join-Path -Path $PWD -ChildPath ".roo/mcp-config.json"
$ErrorActionPreference = 'Stop' # Exit script on terminating errors

# --- Helper Functions ---

# Parses a .env file into a hashtable
function Parse-DotEnv {
    param([string]$FilePath)
    $envVars = @{}
    if (Test-Path -Path $FilePath -PathType Leaf) {
        try {
            Get-Content -Path $FilePath | ForEach-Object {
                $line = $_.Trim()
                # Ignore comments and empty lines
                if ($line -like '#*' -or [string]::IsNullOrWhiteSpace($line)) {
                    return
                }
                # Split on the first '='
                $parts = $line.Split('=', 2)
                if ($parts.Length -eq 2) {
                    $key = $parts[0].Trim()
                    $value = $parts[1].Trim()
                    # Optional: Remove surrounding quotes from value
                    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                        $value = $value.Substring(1, $value.Length - 2)
                    }
                    if (-not [string]::IsNullOrWhiteSpace($key)) {
                        $envVars[$key] = $value
                    }
                }
            }
        } catch {
            Write-Warning "Error parsing .env file '$FilePath': $($_.Exception.Message)"
        }
    } else {
        Write-Verbose ".env file not found at '$FilePath'."
    }
    return $envVars
}


function Get-ServerTypeTools {
    param([string]$ServerType)
    switch -Wildcard ($ServerType) {
        'filesystem' { return @('readFile', 'writeFile', 'listFiles', 'createDirectory', 'deleteItem', 'itemExists') }
        'git'        { return @('gitStatus', 'gitAdd', 'gitCommit', 'gitPush', 'gitPull', 'gitLog', 'gitDiff', 'gitClone') }
        'brave_search'{ return @('search') } # Match name from config
        default      {
            Write-Warning "Unknown server type '$ServerType'. Cannot determine available tools."
            return @()
        }
    }
}

function Read-YesNo {
    param([string]$Prompt)
    while ($true) {
        $response = Read-Host -Prompt "$Prompt (y/n)"
        if ($response -eq 'y' -or $response -eq 'n') {
            return ($response -eq 'y')
        }
        Write-Warning "Please enter 'y' or 'n'."
    }
}

# --- Main Logic ---
try {
    # Parse .env file first (if it exists)
    $dotEnvPath = Join-Path -Path $PWD -ChildPath ".env"
    $dotEnvVars = Parse-DotEnv -FilePath $dotEnvPath

    # 1. Load Configuration
    Write-Host "Loading MCP configuration from '$configPath'..."
    if (-not (Test-Path -Path $configPath -PathType Leaf)) {
        throw "Configuration file not found at '$configPath'. Please ensure it exists."
    }
    $configJson = Get-Content -Path $configPath -Raw
    $configObject = $configJson | ConvertFrom-Json

    if ($null -eq $configObject -or $null -eq $configObject.mcpServers) {
        throw "Configuration file is invalid or does not contain 'mcpServers'."
    }

    $mcpServers = $configObject.mcpServers
    # $serverNames = $mcpServers.PSObject.Properties | ForEach-Object { $_.Name } # Incorrect: mcpServers is an array
    $updated = $false # Flag to track if any changes were made

    # 2. Server Iteration & Configuration
    Write-Host "`n--- MCP Server Configuration ---"
    foreach ($server in $mcpServers) { # Iterate through server objects in the array
        # $server = $mcpServers.$serverName # No longer needed
        $serverName = $server.name # Get name from the server object
        $currentStatus = if ($server.enabled -eq $true) { "Enabled" } else { "Disabled" }
        Write-Host "`nServer: '$serverName' (Currently: $currentStatus)"

        # 2a. Interactive Enablement
        $enableServer = Read-YesNo -Prompt "Enable this server?"

        if ($enableServer) {
            if ($server.enabled -ne $true) {
                 $server.enabled = $true
                 $updated = $true
                 Write-Verbose "Set '$serverName' enabled status to true."
            }

            # 2b. Tool Permission Configuration
            Write-Host "Configuring allowed tools for '$serverName'..."
            $serverType = $server.name # Use the name property from the server object
            # TODO: Consider adding an explicit 'type' property in the config schema later?
            $availableTools = Get-ServerTypeTools -ServerType $serverType
            $allowedTools = @()

            if ($availableTools.Count -eq 0) {
                Write-Warning "No tools defined for server type '$serverType'. Skipping tool configuration."
            } else {
                foreach ($tool in $availableTools) {
                    if (Read-YesNo -Prompt "  Allow tool '$tool'?") {
                        $allowedTools += $tool
                    }
                }
            }

            # Update allowedTools only if it changed or didn't exist
            $existingAllowedTools = $server.allowedTools
            if ($null -eq $existingAllowedTools -or -not ($allowedTools -eq $existingAllowedTools)) {
                 # Check if arrays are actually different (simple equality might fail)
                 $areDifferent = $true # Assume different unless proven same
                 if ($null -ne $existingAllowedTools -and $allowedTools.Count -eq $existingAllowedTools.Count) {
                     $diff = Compare-Object -ReferenceObject $existingAllowedTools -DifferenceObject $allowedTools
                     if ($null -eq $diff) { $areDifferent = $false }
                 }

                 if ($areDifferent) {
                    $server | Add-Member -MemberType NoteProperty -Name 'allowedTools' -Value $allowedTools -Force
                    $updated = $true
                    Write-Verbose "Updated allowedTools for '$serverName'."
                 }
            }

        } else { # Disable server
            if ($server.enabled -ne $false) {
                $server.enabled = $false
                # Optionally remove allowedTools when disabling? For now, keep it simple.
                # if ($server.PSObject.Properties['allowedTools']) {
                #     $server.PSObject.Properties.Remove('allowedTools')
                # }
                $updated = $true
                Write-Verbose "Set '$serverName' enabled status to false."
            }
        }
    }

    # 3. Save Configuration (if changed)
    if ($updated) {
        Write-Host "`nSaving updated configuration to '$configPath'..."
        $updatedJson = $configObject | ConvertTo-Json -Depth 5 # Adjust depth as needed
        Set-Content -Path $configPath -Value $updatedJson -Encoding UTF8 -Force
        Write-Host "Configuration saved successfully."
    } else {
        Write-Host "`nNo changes made to the configuration."
    }

    # 4. Environment Variable Checks (.env)
    Write-Host "`n--- Environment Variable Checks (.env) ---"
    if ($dotEnvVars.Count -eq 0 -and (Test-Path -Path $dotEnvPath -PathType Leaf)) {
         Write-Host "Checked '.env' file, but it appears empty or could not be parsed."
    } elseif ($dotEnvVars.Count -eq 0) {
         Write-Host "No '.env' file found in project root. Checks below assume variables are set directly in the environment."
    } else {
         Write-Host "Checking required environment variables against '.env' file..."
    }

    $warningsIssued = $false
    foreach ($server in $mcpServers) { # Iterate through server objects
        $serverName = $server.name # Get name from the server object
        if ($server.enabled -eq $true) {
            $envVarToCheck = $null
            $serverTypeForMsg = $serverName

            # Determine which env var key to check based on server config
            # Use $server.authentication.envVar directly if available and needed
            $auth = $server.authentication
            if ($auth -and $auth.type -eq 'env' -and $auth.PSObject.Properties['envVar'] -and -not [string]::IsNullOrWhiteSpace($auth.envVar) -and $auth.envVar -notlike '<*') {
                 $envVarToCheck = $auth.envVar
                 $serverTypeForMsg = "$serverName (using '$envVarToCheck')"
            } elseif ($auth -and $auth.type -eq 'header' -and $auth.PSObject.Properties['envVar'] -and -not [string]::IsNullOrWhiteSpace($auth.envVar) -and $auth.envVar -notlike '<*') {
                 $envVarToCheck = $auth.envVar
                 $serverTypeForMsg = "$serverName (using '$envVarToCheck')"
            }
            # Add checks for other servers requiring env vars here

            if ($null -ne $envVarToCheck) {
                if ($dotEnvVars.ContainsKey($envVarToCheck)) {
                    Write-Host "  [OK] Found '$envVarToCheck' for '$serverTypeForMsg' server in .env file."
                } else {
                    Write-Warning "  [Action Needed] Required environment variable '$envVarToCheck' for '$serverTypeForMsg' server was NOT found in the .env file. Ensure it's set in your environment or add it to '.env'."
                    $warningsIssued = $true
                }
            }
        }
    }

    if (-not $warningsIssued) {
        Write-Host "All required environment variables for enabled servers were found in '.env' or no checks were needed."
    }

    Write-Host "`nConfiguration complete."

} catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
    # Exit with a non-zero code to indicate failure
    exit 1
}