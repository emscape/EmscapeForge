<#
.SYNOPSIS
Manages the Roo Memory Bank, including optimization, archiving, and project status updates.

.DESCRIPTION
Provides a set of functions to interact with the Roo Memory Bank system. Allows users to
archive projects, mark projects as complete or active, retrieve archived information, and
trigger optimization processes.

.PARAMETER Command
The management command to execute (e.g., ArchiveProject, SetProjectStatus, RetrieveArchive, OptimizeBank).

.PARAMETER ProjectName
The name of the project to target for commands like ArchiveProject, SetProjectStatus, RetrieveArchive.

.PARAMETER Status
The status to set for a project ('active' or 'completed') when using SetProjectStatus.

.PARAMETER MemoryBankPath
The path to the root of the memory bank directory structure. Defaults to '.\memory-bank'.

.EXAMPLE
.\memory-manager.ps1 -Command ArchiveProject -ProjectName "OldProject" -MemoryBankPath "C:\my-project\mem-bank"

.EXAMPLE
.\memory-manager.ps1 -Command SetProjectStatus -ProjectName "NewFeature" -Status active

.NOTES
Author: Roo
Date: 2025-03-29
This script provides centralized management for Roo Memory Banks.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true, ParameterSetName='ArchiveProject')]
    [Parameter(Mandatory=$true, ParameterSetName='SetProjectStatus')]
    [Parameter(Mandatory=$true, ParameterSetName='RetrieveArchive')]
    [Parameter(Mandatory=$true, ParameterSetName='OptimizeBank')]
    [ValidateSet('ArchiveProject', 'SetProjectStatus', 'RetrieveArchive', 'OptimizeBank')]
    [string]$Command,

    [Parameter(ParameterSetName='ArchiveProject', Mandatory=$true, Position=1)]
    [Parameter(ParameterSetName='SetProjectStatus', Mandatory=$true, Position=1)]
    [Parameter(ParameterSetName='RetrieveArchive', Mandatory=$true, Position=1)]
    [string]$ProjectName,

    [Parameter(ParameterSetName='SetProjectStatus', Mandatory=$true, Position=2)]
    [ValidateSet('active', 'completed')]
    [string]$Status,

    [Parameter(Mandatory=$false, ParameterSetName='ArchiveProject')]
    [Parameter(Mandatory=$false, ParameterSetName='SetProjectStatus')]
    [Parameter(Mandatory=$false, ParameterSetName='RetrieveArchive')]
    [Parameter(Mandatory=$false, ParameterSetName='OptimizeBank')]
    [string]$MemoryBankPath = (Resolve-Path (Join-Path $PWD "memory-bank")).Path, # Default to memory-bank relative to PWD (project root)

    [Parameter(Mandatory=$true, ParameterSetName='ArchiveProject')]
    [switch]$Confirm
)

# --- Helper Functions ---
# Ensure MemoryBankPath exists before proceeding
if (-not (Test-Path -Path $MemoryBankPath -PathType Container)) {
    Write-Error "Memory Bank Path not found or is not a directory: $MemoryBankPath"
    exit 1 # Exit script if the base path is invalid
}
$Global:MemoryArchivesPath = (Resolve-Path (Join-Path $MemoryBankPath "..\memory-archives")).Path # Archives relative to parent of memory-bank
$Global:MemoryBankConfigPath = Join-Path $MemoryBankPath "memory-config.json"
$Global:MemoryBankArchivesIndexPath = Join-Path $MemoryBankPath "archives/archive-index.md" # Index inside memory-bank/archives

# Ensure the base archives directory exists
if (-not (Test-Path -Path $Global:MemoryArchivesPath -PathType Container)) {
    Write-Warning "Base memory archives directory not found at $($Global:MemoryArchivesPath). Creating it."
    try {
        New-Item -Path $Global:MemoryArchivesPath -ItemType Directory -Force -ErrorAction Stop | Out-Null
    } catch {
        Write-Error "Failed to create base archives directory '$($Global:MemoryArchivesPath)': $($_.Exception.Message)"
        exit 1
    }
}
# Ensure the memory-bank archives directory exists (for index)
$mbArchivesDir = Split-Path $Global:MemoryBankArchivesIndexPath -Parent
if (-not (Test-Path -Path $mbArchivesDir -PathType Container)) {
    Write-Warning "Memory bank archives directory not found at $($mbArchivesDir). Creating it."
    try {
        New-Item -Path $mbArchivesDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
    } catch {
        Write-Error "Failed to create memory bank archives directory '$($mbArchivesDir)': $($_.Exception.Message)"
        exit 1
    }
}


function Get-MemoryConfig {
    # Uses the globally resolved $Global:MemoryBankConfigPath
    if (Test-Path $Global:MemoryBankConfigPath) {
        try {
            return Get-Content $Global:MemoryBankConfigPath | ConvertFrom-Json
        } catch {
            Write-Error "Error reading or parsing memory-config.json: $($_.Exception.Message)"
            return $null
        }
    } else {
        Write-Error "memory-config.json not found at $($Global:MemoryBankConfigPath)"
        return $null
    }
}

function Set-MemoryConfig {
    param(
        [Parameter(Mandatory=$true)]
        $ConfigObject
    )
    # Uses the globally resolved $Global:MemoryBankConfigPath
    try {
        $ConfigObject | ConvertTo-Json -Depth 5 | Set-Content -Path $Global:MemoryBankConfigPath
    } catch {
        Write-Error "Error writing memory-config.json: $($_.Exception.Message)"
    }
}

# --- Core Management Functions ---

function Archive-RooProject {
    <#
    .SYNOPSIS
    Moves completed project information from the active memory bank to the archives.
    Uses the globally defined paths derived from the -MemoryBankPath parameter.
    .PARAMETER ProjectName
    The name of the project to archive.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectName
    )
    Write-Host "Attempting to archive project '$ProjectName' using Memory Bank at '$MemoryBankPath'..."
    $config = Get-MemoryConfig
    if (-not $config) { return }

    # 1. Verify project exists and is marked as completed
    if (-not ($config.projectMetadata.PSObject.Properties.Name -contains $ProjectName)) {
        Write-Error "Project '$ProjectName' not found in memory-config.json metadata. Cannot archive."
        return
    }
    $projectMeta = $config.projectMetadata.$ProjectName
    if ($projectMeta.status -ne 'completed') {
        Write-Error "Project '$ProjectName' is not marked as 'completed'. Mark it as completed first using Set-RooProjectStatus."
        return
    }
    if ($projectMeta.archived -eq $true) {
        Write-Warning "Project '$ProjectName' is already marked as archived."
        # Optionally, could add logic here to re-archive or update existing archive
        return
    }

    # 2. Define archive path (using global path)
    $projectArchivePath = Join-Path $Global:MemoryArchivesPath $ProjectName

    # 3. Create project-specific archive directory if it doesn't exist
    if (-not (Test-Path -Path $projectArchivePath -PathType Container)) {
        Write-Host "Creating project archive directory: $projectArchivePath"
        try {
            New-Item -Path $projectArchivePath -ItemType Directory -Force -ErrorAction Stop | Out-Null
        } catch {
            Write-Error "Failed to create archive directory '$projectArchivePath': $($_.Exception.Message)"
            return
        }
    } else {
        Write-Host "Project archive directory already exists: $projectArchivePath"
    }

    # 4. Scan memory bank files for project entries &amp; 5. Prepare timestamped archive files
    Write-Host "Scanning active memory bank files in '$MemoryBankPath' for '$ProjectName' entries..."
    # $memoryBankPath is the script parameter
    $sourceFiles = @{
        "activeContext.md" = "archived-context"
        "decisionLog.md" = "archived-decisions"
        "productContext.md" = "archived-product"
        "progress.md" = "archived-progress"
        "systemPatterns.md" = "archived-patterns"
    }
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $projectEntriesFound = $false
    $archiveFilePaths = @{} # Store paths of archive files to be created/updated

    foreach ($sourceFileEntry in $sourceFiles.GetEnumerator()) {
        $sourceFileName = $sourceFileEntry.Name
        $archiveFileBaseName = $sourceFileEntry.Value
        $sourceFilePath = Join-Path $MemoryBankPath $sourceFileName # Use the passed MemoryBankPath

        if (Test-Path $sourceFilePath) {
            $content = Get-Content $sourceFilePath -Raw
            # Regex to find blocks associated with the project. Uses Singleline for multi-line blocks.
            # Escapes the project name in case it contains regex special characters.
            $escapedProjectName = [System.Text.RegularExpressions.Regex]::Escape($ProjectName)
            $regex = "(?s)<!--\s*@project:$escapedProjectName\s*-->(.*?)<!--\s*@end\s*-->"
            $matches = [System.Text.RegularExpressions.Regex]::Matches($content, $regex)

            if ($matches.Count -gt 0) {
                $projectEntriesFound = $true
                Write-Host "Found $($matches.Count) entries for '$ProjectName' in '$sourceFileName'."
                # Define the target archive file path
                $archiveFileName = "$($archiveFileBaseName)-$($timestamp).md"
                $archiveFilePath = Join-Path $projectArchivePath $archiveFileName
                $archiveFilePaths[$sourceFileName] = $archiveFilePath # Store for later use

                # Step 6: Extract matches, write to archive, and remove from source
                $archiveContent = [System.Text.StringBuilder]::new()
                $modifiedContent = $content

                # Iterate matches in reverse order to avoid index issues if removing directly
                # However, using -replace on the whole string is safer for this approach
                foreach ($match in $matches) {
                    # Append the full matched block to the archive content
                    [void]$archiveContent.AppendLine($match.Value)
                    # Remove the matched block from the modified content string
                    # Use [regex]::Escape to handle special characters in the matched value itself
                    $modifiedContent = $modifiedContent -replace [System.Text.RegularExpressions.Regex]::Escape($match.Value), ''
                }

                # Clean up potential extra whitespace/newlines left after removal
                # Replace multiple blank lines with a single one
                $modifiedContent = $modifiedContent -replace '(?m)(^\s*[\r\n]){2,}', "`r`n"
                # Trim leading/trailing whitespace from the whole content
                $modifiedContent = $modifiedContent.Trim()

                try {
                    # Write collected content to the archive file
                    Add-Content -Path $archiveFilePath -Value $archiveContent.ToString() -ErrorAction Stop
                    Write-Host "  - Appended entries to archive file: $archiveFilePath"

                    # Write the modified content back to the source file
                    Set-Content -Path $sourceFilePath -Value $modifiedContent -ErrorAction Stop
                    Write-Host "  - Removed archived entries from source file: $sourceFilePath"
                } catch {
                    Write-Error "Error processing file '$sourceFileName' for archiving: $($_.Exception.Message)"
                    # Consider adding rollback logic here if needed
                }

            } else {
                Write-Host "No entries found for '$ProjectName' in '$sourceFileName'."
            }
        } else {
            Write-Warning "Source memory bank file not found: $sourceFilePath"
        }
    }

    if (-not $projectEntriesFound) {
        Write-Warning "No entries tagged for project '$ProjectName' were found in the active memory bank files. Nothing to archive."
        # Consider if the project should still be marked archived in config if no entries found. For now, we stop.
        return
    }

    # Step 7: Update memory-config.json if entries were found and processed
    if ($projectEntriesFound) {
        Write-Host "Updating memory-config.json for project '$ProjectName'..."
        $config.projectMetadata.$ProjectName.archived = $true
        # Calculate relative path from MemoryBankPath to the archive dir
        $relativeArchivePath = (Resolve-Path $projectArchivePath -RelativeBase $MemoryBankPath).TrimStart(".\")
        $config.projectMetadata.$ProjectName.archivePath = $relativeArchivePath # Store the relative path

        Set-MemoryConfig -ConfigObject $config
        Write-Host "Project '$ProjectName' marked as archived in memory-config.json."

        # Step 8: Update the main archive-index.md (using global path)
        Write-Host "Updating archive index: $Global:MemoryBankArchivesIndexPath"
        try {
            # Construct the index entry
            $indexEntry = [System.Text.StringBuilder]::new()
            [void]$indexEntry.AppendLine("## Archive Event: $($ProjectName) - $timestamp")
            [void]$indexEntry.AppendLine("Archived project '$($ProjectName)' on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss').")
            [void]$indexEntry.AppendLine("Memory Bank Path: $MemoryBankPath") # Add context
            [void]$indexEntry.AppendLine("Created Archive Files (relative to $Global:MemoryArchivesPath):")
            foreach ($fileEntry in $archiveFilePaths.GetEnumerator()) {
                # Get relative path for the index entry (relative to base archives path)
                $relativeArchiveFilePathToIndex = (Resolve-Path $fileEntry.Value -RelativeBase $Global:MemoryArchivesPath).TrimStart(".\")
                [void]$indexEntry.AppendLine("- $($fileEntry.Key) -> $($relativeArchiveFilePathToIndex)")
            }
            [void]$indexEntry.AppendLine("---") # Separator

            # Append the entry to the index file
            Add-Content -Path $Global:MemoryBankArchivesIndexPath -Value $indexEntry.ToString() -ErrorAction Stop
            Write-Host "Successfully updated archive index."
        } catch {
            Write-Error "Failed to update archive index '$($Global:MemoryBankArchivesIndexPath)': $($_.Exception.Message)"
        }

    }
    # else: If no entries were found, we already returned, but config and index are not updated.

    Write-Host "Archiving process for '$ProjectName' completed."

}

function Set-RooProjectStatus {
    <#
    .SYNOPSIS
    Marks a project as complete or active in the memory configuration.
    Uses the globally defined paths derived from the -MemoryBankPath parameter.
    .PARAMETER ProjectName
    The name of the project.
    .PARAMETER Status
    The status to set ('active' or 'completed').
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectName,
        [Parameter(Mandatory=$true)]
        [ValidateSet('active', 'completed')]
        [string]$Status
    )
    Write-Host "Setting status of project '$ProjectName' to '$Status' in Memory Bank at '$MemoryBankPath'..."
    $config = Get-MemoryConfig
    if (-not $config) { return }

    if ($config.projectMetadata.PSObject.Properties.Name -contains $ProjectName) {
        $config.projectMetadata.$ProjectName.status = $Status
        if ($Status -eq 'completed') {
            $config.projectMetadata.$ProjectName.completionDate = (Get-Date).ToString("o") # ISO 8601 format
            # Add to completedProjects list if not already there
            # Ensure completedProjects is an array before adding
            if ($null -eq $config.completedProjects -or $config.completedProjects -isnot [array]) {
                $config.completedProjects = @()
            }
             if ($config.completedProjects -notcontains $ProjectName) {
                 $config.completedProjects += $ProjectName
             }
             # Remove from activeProjects list if there
             if ($null -ne $config.activeProjects -and $config.activeProjects -contains $ProjectName) {
                 $config.activeProjects = $config.activeProjects | Where-Object { $_ -ne $ProjectName }
             }
        } else { # active
             $config.projectMetadata.$ProjectName.lastActivity = (Get-Date).ToString("o")
             # Add to activeProjects list if not already there
             # Ensure activeProjects is an array before adding
             if ($null -eq $config.activeProjects -or $config.activeProjects -isnot [array]) {
                 $config.activeProjects = @()
             }
             if ($config.activeProjects -notcontains $ProjectName) {
                 $config.activeProjects += $ProjectName
             }
             # Remove from completedProjects list if there
             if ($null -ne $config.completedProjects -and $config.completedProjects -contains $ProjectName) {
                 $config.completedProjects = $config.completedProjects | Where-Object { $_ -ne $ProjectName }
             }
             # Ensure completionDate is removed or nullified if reactivating
             if ($config.projectMetadata.$ProjectName.PSObject.Properties.Name -contains 'completionDate') {
                 $config.projectMetadata.$ProjectName.completionDate = $null
             }
             # Ensure archived status is false if reactivating
             if ($config.projectMetadata.$ProjectName.PSObject.Properties.Name -contains 'archived') {
                 $config.projectMetadata.$ProjectName.archived = $false
                 $config.projectMetadata.$ProjectName.archivePath = $null
             }
        }
        Set-MemoryConfig -ConfigObject $config
        Write-Host "Project '$ProjectName' status updated to '$Status'."
    } else {
        # Project not found, create a new entry
        Write-Host "Project '$ProjectName' not found in metadata. Creating new entry..."
        $newProjectMetadata = @{
            status = $Status
        }
        if ($Status -eq 'completed') {
            $newProjectMetadata.completionDate = (Get-Date).ToString("o")
            # Add to completedProjects list
            # Ensure completedProjects is an array before adding
            if ($null -eq $config.completedProjects -or $config.completedProjects -isnot [array]) {
                $config.completedProjects = @()
            }
            if ($config.completedProjects -notcontains $ProjectName) {
                $config.completedProjects += $ProjectName
            }
            # Ensure not in activeProjects list
            if ($null -ne $config.activeProjects -and $config.activeProjects -contains $ProjectName) {
                $config.activeProjects = $config.activeProjects | Where-Object { $_ -ne $ProjectName }
            }
        } else { # active
            $newProjectMetadata.lastActivity = (Get-Date).ToString("o")
            # Add to activeProjects list
            # Ensure activeProjects is an array before adding
            if ($null -eq $config.activeProjects -or $config.activeProjects -isnot [array]) {
                $config.activeProjects = @()
            }
            if ($config.activeProjects -notcontains $ProjectName) {
                $config.activeProjects += $ProjectName
            }
            # Ensure not in completedProjects list
            if ($null -ne $config.completedProjects -and $config.completedProjects -contains $ProjectName) {
                $config.completedProjects = $config.completedProjects | Where-Object { $_ -ne $ProjectName }
            }
        }
        # Add the new project metadata entry
        # Ensure projectMetadata exists and is a hashtable/PSCustomObject
        if (-not $config.projectMetadata) {
            $config.projectMetadata = @{}
        } elseif ($config.projectMetadata -isnot [System.Collections.IDictionary] -and $config.projectMetadata -isnot [PSCustomObject]) {
             Write-Warning "projectMetadata is not a compatible type. Reinitializing as empty."
             $config.projectMetadata = @{}
        }

        # Add using appropriate method depending on type
        if ($config.projectMetadata -is [System.Collections.IDictionary]) {
             $config.projectMetadata.Add($ProjectName, $newProjectMetadata)
        } elseif ($config.projectMetadata -is [PSCustomObject]) {
             $config.projectMetadata | Add-Member -MemberType NoteProperty -Name $ProjectName -Value $newProjectMetadata -Force
        }

        Set-MemoryConfig -ConfigObject $config
        Write-Host "New project '$ProjectName' added with status '$Status'."
    }
}

function Retrieve-RooArchive {
    <#
    .SYNOPSIS
    Loads archived information for a specific project temporarily into context (simulated).
    Uses the globally defined paths derived from the -MemoryBankPath parameter.
    .PARAMETER ProjectName
    The name of the project whose archive should be retrieved.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectName
    )
    Write-Host "Attempting to retrieve archive for project '$ProjectName' from Memory Bank at '$MemoryBankPath'..."
    $config = Get-MemoryConfig
    if (-not $config) { return }

    # 1. Check memory-config.json for the project's archive path.
    if (-not ($config.projectMetadata.PSObject.Properties.Name -contains $ProjectName)) {
        Write-Error "Project '$ProjectName' not found in memory-config.json metadata."
        return
    }
    $projectMeta = $config.projectMetadata.$ProjectName
    if ($projectMeta.archived -ne $true -or -not $projectMeta.archivePath) {
        Write-Warning "Project '$ProjectName' is not marked as archived or has no archive path defined in memory-config.json."
        return
    }

    # Construct full archive path (archivePath is relative to MemoryBankPath)
    $projectArchivePath = Join-Path $MemoryBankPath $projectMeta.archivePath
    # Resolve it to be sure
    try {
         $projectArchivePath = Resolve-Path $projectArchivePath -ErrorAction Stop
    } catch {
         Write-Error "Could not resolve archive path '$($projectMeta.archivePath)' relative to '$MemoryBankPath'. Error: $($_.Exception.Message)"
         return
    }


    if (-not (Test-Path -Path $projectArchivePath -PathType Container)) {
        Write-Error "Archive path '$projectArchivePath' for project '$ProjectName' does not exist."
        return
    }

    Write-Host "Archive found for project '$ProjectName' at '$projectArchivePath'."
    Write-Host "Listing archive files:"
    try {
        Get-ChildItem -Path $projectArchivePath -File | ForEach-Object { Write-Host "- $($_.Name)" }
    } catch {
        Write-Error "Error listing files in archive path '$projectArchivePath': $($_.Exception.Message)"
    }

    # TODO: 2. Read the content from the specified archive files.
    # TODO: 3. Present the information to the user or load it into a temporary context.
    Write-Warning "Reading and presenting/loading archive content for '$ProjectName' not yet implemented."
}

function Optimize-RooMemoryBank {
    <#
    .SYNOPSIS
    Performs cleanup and optimization tasks on the active memory bank.
    Uses the globally defined paths derived from the -MemoryBankPath parameter.
    #>
    Write-Host "Running memory bank optimization check for Memory Bank at '$MemoryBankPath'..."
    $config = Get-MemoryConfig
    if (-not $config) { return }

    # $memoryBankPath is the script parameter
    $optimizationCandidates = @()
    $obsoleteTagsFound = $false

    # 1. Check completed projects older than keepCompletedDays
    if ($config.PSObject.Properties.Name -contains 'archiveSettings' -and $config.archiveSettings.PSObject.Properties.Name -contains 'keepCompletedDays' -and $config.PSObject.Properties.Name -contains 'completedProjects') {
        $keepDays = $config.archiveSettings.keepCompletedDays
        $thresholdDate = (Get-Date).AddDays(-$keepDays)
        Write-Host "Checking for completed projects older than $keepDays days (before $($thresholdDate.ToString('yyyy-MM-dd')))..."

        foreach ($projectName in $config.completedProjects) {
            if ($config.projectMetadata.PSObject.Properties.Name -contains $projectName) {
                $projectMeta = $config.projectMetadata.$projectName
                if ($projectMeta.PSObject.Properties.Name -contains 'completionDate' -and $projectMeta.completionDate) {
                    try {
                        $completionDate = [datetime]::Parse($projectMeta.completionDate)
                        if ($completionDate -lt $thresholdDate) {
                            Write-Host " - Project '$projectName' completed on $($completionDate.ToString('yyyy-MM-dd')) is older than threshold. Potential candidate for archiving."
                            $optimizationCandidates += $projectName
                        }
                    } catch {
                        Write-Warning "Could not parse completion date '$($projectMeta.completionDate)' for project '$projectName'."
                    }
                }
            } else {
                Write-Warning "Project '$projectName' listed in completedProjects but not found in projectMetadata."
            }
        }
    } else {
        Write-Host "Archive settings (keepCompletedDays) or completedProjects list not found in config. Skipping age-based check."
    }

    # 2. Check for obsolete tags (scan files)
    Write-Host "Checking for obsolete tags (<!-- @obsolete -->)..."
    $sourceFileNames = @(
        "activeContext.md",
        "decisionLog.md",
        "productContext.md",
        "progress.md",
        "systemPatterns.md"
    )
    $obsoleteRegex = "(?s)<!--\s*@obsolete\s*-->"
    foreach ($fileName in $sourceFileNames) {
        $filePath = Join-Path $MemoryBankPath $fileName # Use the passed MemoryBankPath
        if (Test-Path $filePath) {
            $content = Get-Content $filePath -Raw
            if ([System.Text.RegularExpressions.Regex]::IsMatch($content, $obsoleteRegex)) {
                Write-Host " - Found obsolete tags in '$fileName'."
                $obsoleteTagsFound = $true
            }
        }
    }

    # 3. Output summary / Suggest next steps
    if ($optimizationCandidates.Count -gt 0 -or $obsoleteTagsFound) {
        Write-Host "Optimization candidates found:"
        if ($optimizationCandidates.Count -gt 0) {
            Write-Host " - Completed projects older than threshold: $($optimizationCandidates -join ', ')"
            Write-Host "   Consider running '.\memory-manager.ps1 -Command ArchiveProject -ProjectName <Project> -MemoryBankPath $MemoryBankPath' for these projects."
        }
        if ($obsoleteTagsFound) {
            Write-Host " - Obsolete tags found in memory bank files."
            Write-Host "   Further implementation needed to handle/archive obsolete entries specifically."
        }
        # TODO: Implement suggestion logic (e.g., prompt user, link to Archive-RooProject)
    } else {
        Write-Host "No immediate optimization candidates found based on current checks."
    }

    # TODO: 4. Could also include file formatting cleanup, removing duplicate entries etc.
    Write-Warning "Further optimization steps (handling obsolete tags, cleanup) not yet implemented."
}


# --- Command Dispatcher ---
Write-Host "Executing Command: $Command"

switch ($Command) {
    'ArchiveProject' {
        if (-not $ProjectName) { Write-Error "ProjectName is required for ArchiveProject command."; exit 1 }
        Archive-RooProject -ProjectName $ProjectName
    }
    'SetProjectStatus' {
        if (-not $ProjectName) { Write-Error "ProjectName is required for SetProjectStatus command."; exit 1 }
        if (-not $Status) { Write-Error "Status is required for SetProjectStatus command."; exit 1 }
        Set-RooProjectStatus -ProjectName $ProjectName -Status $Status
    }
    'RetrieveArchive' {
        if (-not $ProjectName) { Write-Error "ProjectName is required for RetrieveArchive command."; exit 1 }
        Retrieve-RooArchive -ProjectName $ProjectName
    }
    'OptimizeBank' {
        Optimize-RooMemoryBank
    }
    default {
        Write-Error "Unknown command: $Command"
        exit 1
    }
}

Write-Host "Memory Manager script finished."