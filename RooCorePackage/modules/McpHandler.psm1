# Module to handle Model Context Protocol (MCP) interactions

function Get-McpConfiguration {
    <#
    .SYNOPSIS
    Reads and parses the mcp-config.json file.
    .DESCRIPTION
    Locates the mcp-config.json file expected in the .roo directory
    at the project root, reads its content, and parses it as JSON.
    Includes basic error handling for missing file or invalid JSON.
    .OUTPUTS
    PSCustomObject - The parsed configuration object.
    $null - If the file is not found or contains invalid JSON.
    .EXAMPLE
    $mcpConfig = Get-McpConfiguration
    if ($mcpConfig) {
        Write-Host "MCP Server Count: $($mcpConfig.mcpServers.Count)"
    }
    else {
        Write-Warning "MCP configuration could not be loaded."
    }
    #>
    param()

    # Assume the script/function is called from the project root
    $configPath = Join-Path -Path $PWD -ChildPath ".roo/mcp-config.json"
    $configObject = $null

    try {
        if (Test-Path -Path $configPath -PathType Leaf) {
            $jsonContent = Get-Content -Path $configPath -Raw
            $configObject = $jsonContent | ConvertFrom-Json -ErrorAction Stop
        }
        else {
            Write-Warning "MCP configuration file not found at: $configPath"
        }
    }
    catch [System.Management.Automation.ItemNotFoundException] {
        # This catch might be redundant due to Test-Path, but included for safety
        Write-Warning "MCP configuration file not found at: $configPath"
    }
    catch [System.Text.Json.JsonException] {
        Write-Warning "Error parsing MCP configuration file at: $configPath. Invalid JSON. Error: $($_.Exception.Message)"
    }
    catch {
        Write-Warning "An unexpected error occurred while reading or parsing MCP configuration: $($_.Exception.Message)"
    }

    return $configObject
}


function Get-McpServerCredentials {
    <#
    .SYNOPSIS
    Retrieves credentials for a specific MCP server from an environment variable.
    .DESCRIPTION
    Takes a single MCP server configuration object as input. It checks if the
    object contains a 'credentialEnvVar' property specifying the name of an
    environment variable. If found, it attempts to retrieve the value of that
    environment variable.
    .PARAMETER ServerConfig
    A PSCustomObject representing the configuration for a single MCP server,
    expected to have a 'credentialEnvVar' property. Can be $null.
    .OUTPUTS
    String - The credential value retrieved from the environment variable.
    $null - If the input object is invalid, missing the 'credentialEnvVar' property,
            or the specified environment variable is not set or empty.
    .EXAMPLE
    # Assuming $server is one server object from Get-McpConfiguration
    $credential = Get-McpServerCredentials -ServerConfig $server
    if ($credential) {
        Write-Host "Credentials retrieved successfully."
    }
    else {
        Write-Warning "Could not retrieve credentials for server $($server.name)."
    }
    #>
    param(
        [Parameter(Mandatory=$true)]
        [AllowNull()] # Allow null to prevent binding error, handle null internally
        [PSCustomObject]$ServerConfig
    )

    $credential = $null
    $envVarName = $null
    $serverName = "[Unknown Server]" # Default name

    # Check if ServerConfig is null first
    if ($ServerConfig -eq $null) {
         Write-Warning "Input ServerConfig object is null."
         return $null
    }

    # Try to get server name for warnings
    if ($ServerConfig.PSObject.Properties['name']) {
        $serverName = $ServerConfig.name
    }

    # Check if the credentialEnvVar property exists and is not empty
    if ($ServerConfig.PSObject.Properties['credentialEnvVar']) {
        $envVarName = $ServerConfig.credentialEnvVar
        if (-not [string]::IsNullOrWhiteSpace($envVarName)) {
            # Check if the environment variable exists and is not empty
            if (Test-Path "env:$envVarName") {
                 $credentialValue = Get-Content "env:$envVarName" -ErrorAction SilentlyContinue
                 if (-not [string]::IsNullOrWhiteSpace($credentialValue)) {
                     $credential = $credentialValue
                 } else {
                     Write-Warning "Environment variable '$envVarName' specified for server '$serverName' is set but empty."
                 }
            }
            else {
                Write-Warning "Environment variable '$envVarName' specified for server '$serverName' is not set."
            }
        }
        else {
            Write-Warning "The 'credentialEnvVar' property for server '$serverName' is empty."
        }
    }
    else {
         Write-Warning "Input ServerConfig object for server '$serverName' is missing the 'credentialEnvVar' property."
    }

    return $credential
}


function Test-McpAccess {
    <#
    .SYNOPSIS
    Checks if a requested tool or resource is allowed for a specific MCP server based on its configuration.
    .DESCRIPTION
    Takes a single MCP server configuration object and the name of a tool or resource.
    It checks the 'allowedTools' array within the server configuration.
    Access is granted only if 'allowedTools' exists, is not empty, and contains the requested tool name (case-insensitive).
    Follows a secure default principle: if 'allowedTools' is missing or empty, access is denied.
    .PARAMETER ServerConfig
    A PSCustomObject representing the configuration for a single MCP server.
    Expected to potentially have an 'allowedTools' array property. Can be $null.
    .PARAMETER RequestedItem
    The name of the tool or resource being requested (e.g., "read_file", "execute_command"). Can be $null or empty string.
    .OUTPUTS
    Boolean - $true if access is permitted, $false otherwise.
    .EXAMPLE
    # Assuming $server is one server object from Get-McpConfiguration
    $isAllowed = Test-McpAccess -ServerConfig $server -RequestedItem "read_file"
    if ($isAllowed) {
        Write-Host "Access to 'read_file' is allowed for server $($server.name)."
    } else {
        Write-Warning "Access to 'read_file' is denied for server $($server.name)."
    }
    .EXAMPLE
    # Example where allowedTools might be missing or empty
    $isAllowed = Test-McpAccess -ServerConfig $anotherServer -RequestedItem "execute_command"
    if (-not $isAllowed) {
        Write-Warning "Access denied for 'execute_command' on server $($anotherServer.name) (secure default)."
    }
    #>
    param(
        [Parameter(Mandatory=$true)]
        [AllowNull()] # Allow null to prevent binding error, handle null internally
        [PSCustomObject]$ServerConfig,

        [Parameter(Mandatory=$true)]
        [AllowNull()] # Allow null
        [AllowEmptyString()] # Allow empty string
        [string]$RequestedItem
    )

    # Input validation
    if ($ServerConfig -eq $null) {
        Write-Warning "Test-McpAccess: Input ServerConfig object is null."
        return $false
    }
    if ([string]::IsNullOrWhiteSpace($RequestedItem)) {
        Write-Warning "Test-McpAccess: RequestedItem parameter cannot be null or empty."
        return $false
    }

    $serverName = "[Unknown Server]" # Default name
    if ($ServerConfig.PSObject.Properties['name']) {
        $serverName = $ServerConfig.name
    }

    # Check for allowedTools property
    if ($ServerConfig.PSObject.Properties['allowedTools']) {
        $allowedTools = $ServerConfig.allowedTools

        # Check if allowedTools is an array and not empty
        if ($allowedTools -is [array] -and $allowedTools.Count -gt 0) {
            # Perform case-insensitive check
            # Note: Simple -contains is case-sensitive by default
            foreach ($tool in $allowedTools) {
                if ($tool -is [string] -and $tool.Equals($RequestedItem, [System.StringComparison]::OrdinalIgnoreCase)) {
                    return $true
                }
            }
            # If no match found after checking
            Write-Verbose "Test-McpAccess: Requested item '$RequestedItem' not found in allowedTools for server '$serverName'."
            return $false
        }
        else {
            # allowedTools exists but is empty or not an array
            Write-Warning "Test-McpAccess: 'allowedTools' for server '$serverName' exists but is empty or not a valid array. Denying access (secure default)."
            return $false
        }
    }
    else {
        # allowedTools property does not exist
        Write-Warning "Test-McpAccess: Server configuration for '$serverName' does not contain an 'allowedTools' property. Denying access (secure default)."
        return $false
    }
}


# Helper function for local filesystem operations
function Invoke-LocalFilesystemTool {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ToolName,

        [Parameter(Mandatory=$true)]
        $Parameters # PSCustomObject or Hashtable
    )

    Write-Verbose "Executing local filesystem tool: $ToolName"
    $result = [PSCustomObject]@{
        success = $false
        data = $null
        error = $null
    }

    # Basic path validation helper
    function Resolve-RelativePathSafely {
        param(
            [string]$InputPath,
            [switch]$AllowNonExistent # For operations like writeFile or createDirectory
        )
        try {
            # Resolve path relative to PWD
            $resolvedPath = Join-Path -Path $PWD -ChildPath $InputPath

            # Check if the path exists unless allowed not to
            if (-not $AllowNonExistent -and -not (Test-Path -LiteralPath $resolvedPath)) {
                 throw "Path does not exist: '$InputPath' (Resolved: '$resolvedPath')"
            }

            # Basic check for attempted traversal (simplistic, might need refinement)
            # Get full path to compare against PWD's full path
            $fullInputPath = (Resolve-Path -LiteralPath $resolvedPath -ErrorAction SilentlyContinue).Path
            $fullPwdPath = (Resolve-Path -LiteralPath $PWD).Path

            if ($null -eq $fullInputPath -and -not $AllowNonExistent) {
                 throw "Could not resolve path: '$InputPath'" # Should be caught by Test-Path earlier, but safety check
            }

            # If path resolves and exists (or allowed not to), check if it's within PWD
            if ($fullInputPath -ne $null -and -not $fullInputPath.StartsWith($fullPwdPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                 throw "Path is outside the current working directory: '$InputPath'"
            }

            # Return the full, validated path
            return $fullInputPath
        } catch {
            throw "Invalid or unsafe path specified: '$InputPath'. Error: $($_.Exception.Message)"
        }
    }

    try {
        # Ensure Parameters is usable like a hashtable - Direct use assuming PSCustomObject or Hashtable input
        $params = $Parameters # Assume input is PSCustomObject or Hashtable

        switch -Exact ($ToolName) { # Use -Exact for tool names
            'readFile' {
                if (-not $params.ContainsKey('path')) { throw "Parameter 'path' is mandatory for readFile." }
                $filePath = Resolve-RelativePathSafely -InputPath $params.path

                $encoding = [System.Text.Encoding]::UTF8 # Default
                if ($params.ContainsKey('encoding')) {
                    try { $encoding = [System.Text.Encoding]::GetEncoding($params.encoding) } catch { throw "Invalid encoding specified: $($params.encoding)" }
                }

                $result.data = Get-Content -LiteralPath $filePath -Raw -Encoding $encoding -ErrorAction Stop
                $result.success = $true
            }
            'writeFile' {
                if (-not $params.ContainsKey('path')) { throw "Parameter 'path' is mandatory for writeFile." }
                if (-not $params.ContainsKey('content')) { throw "Parameter 'content' is mandatory for writeFile." }
                $filePath = Resolve-RelativePathSafely -InputPath $params.path -AllowNonExistent

                $content = $params.content
                $encoding = 'utf8' # Default for Set-Content parameter
                if ($params.ContainsKey('encoding')) {
                    # Validate encoding name for Set-Content (simpler validation than GetEncoding)
                    $validEncodings = @('ascii', 'bigendianunicode', 'bigendianutf32', 'oem', 'unicode', 'utf7', 'utf8', 'utf8bom', 'utf8nobom', 'utf32')
                    if ($params.encoding -notin $validEncodings) {
                        throw "Invalid encoding specified for Set-Content: '$($params.encoding)'. Valid options: $($validEncodings -join ', ')"
                    }
                    $encoding = $params.encoding
                }
                $append = $false
                if ($params.ContainsKey('append') -and $params.append -is [bool]) {
                    $append = $params.append
                }
                $force = $true # Overwrite by default if not appending

                # Ensure directory exists
                $parentDir = Split-Path -Path $filePath -Parent
                if (-not (Test-Path -LiteralPath $parentDir)) {
                    New-Item -Path $parentDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
                }

                if ($append) {
                    Add-Content -LiteralPath $filePath -Value $content -Encoding $encoding -ErrorAction Stop
                } else {
                    Set-Content -LiteralPath $filePath -Value $content -Encoding $encoding -Force:$force -ErrorAction Stop
                }
                $result.success = $true
            }
            'listFiles' {
                if (-not $params.ContainsKey('path')) { throw "Parameter 'path' is mandatory for listFiles." }
                $dirPath = Resolve-RelativePathSafely -InputPath $params.path

                if (-not (Test-Path -LiteralPath $dirPath -PathType Container)) { throw "Path is not a valid directory: '$($params.path)'" }

                $recursive = $false
                if ($params.ContainsKey('recursive') -and $params.recursive -is [bool]) {
                    $recursive = $params.recursive
                }
                $depth = if ($recursive) { [int]::MaxValue } else { 0 } # Default depth based on recursive flag
                if ($params.ContainsKey('depth') -and $params.depth -is [int] -and $params.depth -ge 0) {
                    $depth = $params.depth
                    if ($depth -gt 0) { $recursive = $true } # If depth > 0, recursive must be true
                }

                # Explicitly build the array using a loop to avoid pipeline issues
                $items = @()
                $childItems = Get-ChildItem -LiteralPath $dirPath -Recurse:$recursive -Depth $depth -ErrorAction Stop
                foreach ($item in $childItems) {
                    $items += [PSCustomObject]@{
                        Name = $item.Name
                        FullName = $item.FullName # Consider if relative path is better? For now, full.
                        IsDirectory = $item.PSIsContainer
                        Length = if ($item.PSIsContainer) { $null } else { $item.Length }
                        LastWriteTime = $item.LastWriteTimeUtc # Use UTC for consistency
                    }
                }
                $result.data = $items # Assign the constructed array
                $result.success = $true
            }
            'createDirectory' {
                if (-not $params.ContainsKey('path')) { throw "Parameter 'path' is mandatory for createDirectory." }
                $dirPath = Resolve-RelativePathSafely -InputPath $params.path -AllowNonExistent

                if (Test-Path -LiteralPath $dirPath) { throw "Directory already exists: '$($params.path)'" }

                New-Item -Path $dirPath -ItemType Directory -Force -ErrorAction Stop | Out-Null
                $result.success = $true
            }
            'deleteItem' {
                if (-not $params.ContainsKey('path')) { throw "Parameter 'path' is mandatory for deleteItem." }
                $itemPath = Resolve-RelativePathSafely -InputPath $params.path

                $recursive = $false
                if ($params.ContainsKey('recursive') -and $params.recursive -is [bool]) {
                    $recursive = $params.recursive
                }

                if (-not (Test-Path -LiteralPath $itemPath)) { throw "Item does not exist: '$($params.path)'" }

                Remove-Item -LiteralPath $itemPath -Recurse:$recursive -Force -ErrorAction Stop
                $result.success = $true
            }
            'itemExists' {
                 if (-not $params.ContainsKey('path')) { throw "Parameter 'path' is mandatory for itemExists." }
                 # For exists check, don't throw if path is invalid/unsafe, just return false
                 $itemPath = $null
                 try { $itemPath = Resolve-RelativePathSafely -InputPath $params.path -AllowNonExistent } catch {}

                 $result.data = if ($itemPath) { Test-Path -LiteralPath $itemPath } else { $false }
                 $result.success = $true # The operation succeeded, even if the item doesn't exist
            }
            default {
                throw "Unsupported local filesystem tool: '$ToolName'"
            }
        }
    } catch {
        $result.error = "Failed to execute local filesystem tool '$ToolName'. Error: $($_.Exception.Message)"
        Write-Warning $result.error
    }

    return $result
}



# Helper function for local Git operations
function Invoke-LocalGitTool {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ToolName,

        [Parameter(Mandatory=$true)]
        $Parameters # PSCustomObject or Hashtable
    )

    Write-Verbose "Executing local Git tool: $ToolName"
    $result = [PSCustomObject]@{
        success = $false
        data = $null
        error = $null
    }

    # Check if git.exe is available
    $gitPath = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $gitPath) {
        $result.error = "git.exe not found in PATH. Please ensure Git is installed and accessible."
        Write-Warning $result.error
        return $result
    }

    try {
        # Ensure Parameters is usable like a hashtable
        $params = $Parameters | ConvertTo-Hashtable -ErrorAction Stop

        # Most git commands should run from the project root ($PWD)
        # gitClone is an exception where the target directory might be specified.

        $gitArgs = @() # Array to hold arguments for git command

        switch -Exact ($ToolName) {
            'gitStatus' {
                $gitArgs = @('status', '--porcelain') # Use porcelain for easier parsing if needed later
                if ($params.ContainsKey('path')) {
                    # Validate path is relative and within PWD? For now, pass directly.
                    $gitArgs += $params.path
                }
            }
            'gitAdd' {
                 $gitArgs = @('add')
                 if ($params.ContainsKey('all') -and $params.all -eq $true) {
                     $gitArgs += '--all'
                 } elseif ($params.ContainsKey('path')) {
                     # Validate path? For now, pass directly.
                     $gitArgs += $params.path
                 } else {
                     throw "Parameter 'path' or 'all=$true' is mandatory for gitAdd."
                 }
            }
            'gitCommit' {
                if (-not $params.ContainsKey('message')) { throw "Parameter 'message' is mandatory for gitCommit." }
                $gitArgs = @('commit', '-m', $params.message)
                if ($params.ContainsKey('amend') -and $params.amend -eq $true) {
                    $gitArgs += '--amend'
                }
            }
            'gitPush' {
                $gitArgs = @('push')
                if ($params.ContainsKey('remote')) { $gitArgs += $params.remote }
                if ($params.ContainsKey('branch')) { $gitArgs += $params.branch }
                # Add --force? Maybe too dangerous for default. Could add as optional param.
            }
            'gitPull' {
                $gitArgs = @('pull')
                if ($params.ContainsKey('remote')) { $gitArgs += $params.remote }
                if ($params.ContainsKey('branch')) { $gitArgs += $params.branch }
                # Add --rebase? Optional param.
            }
            'gitLog' {
                $gitArgs = @('log', '--pretty=format:%H%x09%an%x09%ad%x09%s') # Example format: Hash Author Date Subject
                 if ($params.ContainsKey('count') -and $params.count -is [int] -and $params.count -gt 0) {
                     $gitArgs += "-n", $params.count
                 } else {
                     $gitArgs += "-n", 10 # Default to 10 entries
                 }
                 if ($params.ContainsKey('branch')) { $gitArgs += $params.branch }
            }
            'gitDiff' {
                $gitArgs = @('diff')
                if ($params.ContainsKey('cached') -and $params.cached -eq $true) {
                    $gitArgs += '--cached'
                }
                if ($params.ContainsKey('path')) {
                    # Validate path?
                    $gitArgs += '--', $params.path # Use -- to separate path from options
                }
            }
            'gitClone' {
                 if (-not $params.ContainsKey('repositoryUrl')) { throw "Parameter 'repositoryUrl' is mandatory for gitClone." }
                 $gitArgs = @('clone', $params.repositoryUrl)
                 if ($params.ContainsKey('directory')) {
                     # Validate directory path? Should be relative to PWD or absolute?
                     # For now, assume relative to PWD.
                     $cloneDir = Join-Path -Path $PWD -ChildPath $params.directory
                     # Basic safety: Check if it tries to go outside PWD? Resolve-RelativePathSafely might be useful here.
                     # For simplicity now, just append.
                     $gitArgs += $params.directory # Git handles the target directory argument
                 }
                 # Note: git clone doesn't run *within* PWD in the same way other commands do.
                 # It creates a new directory. We execute it *from* PWD.
            }
            # Add other commands here as needed: fetch, branch, checkout, merge, rebase, tag etc.
            default {
                throw "Unsupported local Git tool: '$ToolName'"
            }
        }

        # Execute the git command
        Write-Verbose "Executing: git $($gitArgs -join ' ')"
        # Using & operator with splatting (@gitArgs) is safer than Invoke-Expression
        $stdOut = (& git @gitArgs 2>&1) # Redirect stderr (2) to stdout (1) to capture all output

        if ($LASTEXITCODE -eq 0) {
            $result.data = $stdOut -join [Environment]::NewLine
            $result.success = $true
            Write-Verbose "Git command '$ToolName' executed successfully."
        } else {
            $result.error = "Git command '$ToolName' failed (Exit Code: $LASTEXITCODE). Output: $($stdOut -join [Environment]::NewLine)"
            Write-Warning $result.error
        }

    } catch {
        $result.error = "Failed to execute local Git tool '$ToolName'. Error: $($_.Exception.Message)"
        Write-Warning $result.error
    }

    return $result
}


# Helper function for Brave Search API interactions
# NOTE: This function is intended for internal use within the module and is NOT exported.
function Invoke-BraveSearchTool {
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject]$ServerConfig, # Contains apiUrl, etc.

        [Parameter(Mandatory=$true)]
        [string]$ToolName,

        [Parameter(Mandatory=$true)]
        $Parameters, # PSCustomObject or Hashtable

        [Parameter(Mandatory=$false)] # Credentials (API Key) are mandatory for Brave
        [AllowNull()]
        [AllowEmptyString()]
        [string]$Credentials
    )

    Write-Verbose "Executing Brave Search tool: $ToolName"
    $result = [PSCustomObject]@{
        success = $false
        data = $null
        error = $null
    }

    try {
        # Ensure Parameters is usable like a hashtable
        $params = $Parameters | ConvertTo-Hashtable -ErrorAction Stop

        # Get API URL from server config (prefer apiUrl, fallback to url)
        $apiUrl = $null
        if ($ServerConfig.PSObject.Properties['apiUrl']) {
            $apiUrl = $ServerConfig.apiUrl
        } elseif ($ServerConfig.PSObject.Properties['url']) {
            $apiUrl = $ServerConfig.url
        }

        if ([string]::IsNullOrWhiteSpace($apiUrl)) {
            throw "Configuration for server '$($ServerConfig.name)' is missing the 'apiUrl' or 'url' property."
        }
        if ([string]::IsNullOrWhiteSpace($Credentials)) {
            # This should have been caught in Execute-McpTool, but double-check
            throw "Credentials (API Key) are required for Brave Search but were not provided."
        }

        # --- Tool Specific Logic ---
        switch -Exact ($ToolName) {
            'search' {
                if (-not $params.ContainsKey('query') -or [string]::IsNullOrWhiteSpace($params.query)) {
                    throw "Parameter 'query' is mandatory and cannot be empty for the 'search' tool."
                }

                # Base URI for the search endpoint
                $baseUri = ($apiUrl.TrimEnd('/')) + "/web/search" # Assuming this endpoint path

                # Build query parameters dynamically
                $queryParams = @{
                    q = [System.Web.HttpUtility]::UrlEncode($params.query)
                }

                # Add optional parameters if they exist in $params
                $optionalParamsMap = @{
                    count = 'count'
                    offset = 'offset'
                    country = 'country'
                    search_lang = 'search_lang'
                    ui_lang = 'ui_lang'
                    safesearch = 'safesearch'
                    # Add more mappings here if needed
                }

                foreach ($key in $params.Keys) {
                    if ($optionalParamsMap.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($params[$key])) {
                        # URL Encode optional parameter values as well? Assume yes for safety.
                        $queryParams[$optionalParamsMap[$key]] = [System.Web.HttpUtility]::UrlEncode($params[$key])
                    }
                }

                # Construct the final URI
                $queryString = $queryParams.GetEnumerator() | ForEach-Object { "$($_.Name)=$($_.Value)" } | Join-String -Separator '&'
                $requestUri = "$baseUri?$queryString"

                # Prepare headers
                $headers = @{
                    "Accept"                 = "application/json"
                    "X-Subscription-Token" = $Credentials
                }

                # Make the API Call
                Write-Verbose "Sending Brave Search API request to $requestUri"
                $apiResponse = Invoke-RestMethod -Uri $requestUri -Method Get -Headers $headers -ErrorAction Stop
                Write-Verbose "Brave Search API request successful."

                # Process the response - Adjust based on actual Brave API response structure
                # Assuming results are in response.web.results
                if ($apiResponse -ne $null -and $apiResponse.PSObject.Properties['web'] -ne $null -and $apiResponse.web.PSObject.Properties['results'] -ne $null) {
                    $result.data = $apiResponse.web.results
                    $result.success = $true
                } else {
                    # Successful call but unexpected response structure
                    $result.data = $apiResponse # Return the full response for debugging
                    $result.success = $true # Mark as success=true because the API call itself worked (2xx)
                    Write-Warning "Brave Search API call succeeded but response structure was unexpected. Full response returned in 'data'."
                }
            }
            default {
                throw "Unsupported Brave Search tool: '$ToolName'. Only 'search' is currently implemented."
            }
        }

    } catch [System.Net.WebException] {
        $statusCode = 0
        $errorMessage = $_.Exception.Message
        $errorBody = $null
        if ($_.Exception.Response -ne $null) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                $errorStream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorStream)
                $errorBody = $reader.ReadToEnd()
                $reader.Close()
                $errorStream.Close()
                $errorMessage += " Server Response ($statusCode): $errorBody"
            } catch {
                $errorMessage += " (Could not read error response body)."
            }
        }
        $result.error = "Error calling Brave Search API for tool '$ToolName'. Status Code: $statusCode. Error: $errorMessage"
        Write-Warning $result.error
    } catch {
        # Catch other errors (parameter validation, JSON conversion, etc.)
        $result.error = "Failed to execute Brave Search tool '$ToolName'. Error: $($_.Exception.Message)"
        Write-Warning $result.error
    }

    return $result
}


function Invoke-McpRequest {
    <#
    .SYNOPSIS
    Sends a request to an MCP server tool endpoint using Invoke-RestMethod.
    .DESCRIPTION
    Constructs and sends a POST request to a specified MCP server tool endpoint.
    It includes parameters converted to JSON in the body and handles authorization
    via a Bearer token in the headers. Includes basic error handling for the web request.
    .PARAMETER ServerUrl
    The base URL of the MCP server (e.g., "https://mcp.example.com").
    .PARAMETER ToolName
    The name of the tool being invoked on the server (e.g., "execute_command").
    .PARAMETER Parameters
    A PSCustomObject or Hashtable containing the parameters for the tool.
    .PARAMETER Credentials
    The credential string (e.g., API token) to be used for authorization. Can be null or empty if no auth needed.
    .OUTPUTS
    PSCustomObject - The parsed response object from the server on success.
    $null - If an error occurs during the request.
    .EXAMPLE
    $params = @{ command = "echo 'Hello MCP!'" }
    $result = Invoke-McpRequest -ServerUrl "https://mcp.example.com" -ToolName "execute_command" -Parameters $params -Credentials "YOUR_API_TOKEN"
    if ($result) {
        Write-Host "MCP Response: $($result | ConvertTo-Json -Depth 5)"
    } else {
        Write-Warning "MCP request failed."
    }
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ServerUrl,

        [Parameter(Mandatory=$true)]
        [string]$ToolName,

        [Parameter(Mandatory=$true)]
        [PSCustomObject]$Parameters, # Or [Hashtable]

        # TODO: Implement input parameter sanitization here based on tool requirements
        # Ensure $Parameters don't contain malicious content before sending

        [Parameter(Mandatory=$false)] # Credentials might be optional
        [AllowNull()]
        [AllowEmptyString()]
        [string]$Credentials
    )

    # Construct the full URI - Assuming a '/tools/' path convention
    # Ensure no double slashes if ServerUrl already ends with /
    $trimmedUrl = $ServerUrl.TrimEnd('/')
    $requestUri = "$trimmedUrl/tools/$ToolName" # Assuming no /execute suffix needed based on previous tests

    # Prepare the request body
    try {
        $jsonBody = $Parameters | ConvertTo-Json -Depth 5 -ErrorAction Stop # Adjust Depth as needed
    } catch {
        Write-Warning "Failed to convert parameters to JSON for tool '$ToolName'. Error: $($_.Exception.Message)"
        return $null
    }


    # Prepare headers
    $headers = @{
        "Content-Type"  = "application/json"
        "Accept"        = "application/json" # Good practice to specify accepted response type
    }
    if (-not [string]::IsNullOrWhiteSpace($Credentials)) {
        $headers["Authorization"] = "Bearer $Credentials"
    }


    $response = $null
    try {
        Write-Verbose "Sending MCP request to $requestUri"
        $response = Invoke-RestMethod -Uri $requestUri -Method Post -Headers $headers -Body $jsonBody -ContentType 'application/json' -ErrorAction Stop
        Write-Verbose "MCP request successful."

        # TODO: Implement output response sanitization here
        # Ensure $response doesn't contain unexpected or malicious content before returning
}
catch [System.Net.WebException] {
    $statusCode = 0
        $errorMessage = $_.Exception.Message
        if ($_.Exception.Response -ne $null) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                # Try to read the response body for more details
                $errorStream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorStream)
                $errorBody = $reader.ReadToEnd()
                $reader.Close()
                $errorStream.Close()
                $errorMessage += " Server Response: $errorBody"
            } catch {
                $errorMessage += " (Could not read error response body)."
            }
        }
        Write-Warning "Error sending MCP request to '$requestUri'. Status Code: $statusCode. Error: $errorMessage"
    }
    catch {
        # Catch other potential errors (e.g., JSON conversion, unexpected issues)
        Write-Warning "An unexpected error occurred during MCP request to '$requestUri': $($_.Exception.Message)"
    }

    return $response
}


function Execute-McpTool {
    <#
    .SYNOPSIS
    Orchestrates the execution of an MCP tool request by finding a suitable server,
    checking permissions, retrieving credentials, and invoking the request.
    .DESCRIPTION
    This function acts as the main entry point for executing MCP tool requests.
    It loads the MCP configuration, iterates through configured servers, and attempts
    to find the first enabled server that supports the requested tool and grants access.
    It retrieves necessary credentials and then calls Invoke-McpRequest.
    The function returns the result from the first successful server interaction.
    .PARAMETER ToolName
    The name of the MCP tool to execute (e.g., "execute_command").
    .PARAMETER Parameters
    A PSCustomObject or Hashtable containing the parameters required by the tool.
    .OUTPUTS
    PSCustomObject - The result returned by the successful MCP tool execution.
    $null - If no suitable server is found, access is denied, credentials are missing,
            or the request fails on all eligible servers.
    .EXAMPLE
    $toolParams = @{ path = "./src/myfile.txt"; content = "New content" }
    $result = Execute-McpTool -ToolName "write_to_file" -Parameters $toolParams
    if ($result) {
        Write-Host "MCP tool execution successful."
        # Process $result
    } else {
        Write-Warning "Failed to execute MCP tool 'write_to_file'."
    }
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ToolName,

        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()] # Ensure parameters are provided, even if empty object/hashtable
        $Parameters # Allow PSCustomObject or Hashtable
    )

    Write-Verbose "Attempting to execute MCP tool: $ToolName"

    # 1. Load MCP Configuration
    $mcpConfig = Get-McpConfiguration
    if ($null -eq $mcpConfig -or $null -eq $mcpConfig.mcpServers -or $mcpConfig.mcpServers.Count -eq 0) {
        Write-Warning "MCP configuration is missing, invalid, or contains no servers. Cannot execute tool '$ToolName'."
        return $null
    }

    # 2. Iterate through configured servers
    foreach ($server in $mcpConfig.mcpServers) {
        $serverName = "[Unnamed Server]" # Default name
        if ($server.PSObject.Properties['name']) { $serverName = $server.name }

        Write-Verbose "Checking server: $serverName"

        # 3a. Check if server is enabled
        if ($server.PSObject.Properties['enabled'] -eq $null -or $server.enabled -ne $true) {
            Write-Verbose "Server '$serverName' is not enabled. Skipping."
            continue
        }

        # 3b. Check if server supports the tool (using Test-McpAccess logic implicitly)
        # Test-McpAccess already checks for allowedTools existence and the specific tool.
        # We call it directly for the access check.

        # 3c. Check access permission for the tool
        if (-not (Test-McpAccess -ServerConfig $server -RequestedItem $ToolName)) {
            Write-Verbose "Access to tool '$ToolName' denied on server '$serverName'. Skipping."
            continue
        }
        Write-Verbose "Access granted for tool '$ToolName' on server '$serverName'."

        # 3d. Get Credentials if required
        $credentials = $null
        # Check if credentialEnvVar property exists before trying to access it
        if ($server.PSObject.Properties['credentialEnvVar'] -ne $null -and -not [string]::IsNullOrWhiteSpace($server.credentialEnvVar)) {
            $credentials = Get-McpServerCredentials -ServerConfig $server
            if ($null -eq $credentials) {
                Write-Warning "Required credentials not found or empty for server '$serverName' (EnvVar: $($server.credentialEnvVar)). Skipping."
                continue # Cannot proceed without credentials if they are specified as required
            }
             Write-Verbose "Credentials obtained for server '$serverName'."
        } else {
             Write-Verbose "No credentials required or specified for server '$serverName'."
             # Pass null if no credentials needed/specified
             $credentials = $null
        }

        # 3e. Determine if local or remote execution
        $serverType = $null
        if ($server.PSObject.Properties['type']) { $serverType = $server.type }

        $serverUrl = $null # Define outside the blocks for potential use in Brave Search or generic remote
        if ($server.PSObject.Properties['url']) { $serverUrl = $server.url } # Get URL for remote types

        $result = $null
        if ($serverType -eq 'filesystem') {
            # Execute locally for filesystem type
            Write-Verbose "Server '$serverName' is type 'filesystem'. Executing locally."
            $result = Invoke-LocalFilesystemTool -ToolName $ToolName -Parameters $Parameters
            if ($result.success) {
                Write-Verbose "Successfully executed local filesystem tool '$ToolName'."
                return $result # Return the structured result object
            } else {
                Write-Warning "Local execution of filesystem tool '$ToolName' failed. Error: $($result.error). Trying next server if available."
                # Continue to the next server
            }
        } elseif ($serverType -eq 'git') {
            # Execute locally for git type
            Write-Verbose "Server '$serverName' is type 'git'. Executing locally."
            $result = Invoke-LocalGitTool -ToolName $ToolName -Parameters $Parameters
            if ($result.success) {
                Write-Verbose "Successfully executed local git tool '$ToolName'."
                return $result # Return the structured result object
            } else {
                Write-Warning "Local execution of git tool '$ToolName' failed. Error: $($result.error). Trying next server if available."
                # Continue to the next server
            }
        } elseif ($serverType -eq 'braveSearch') {
            # Execute Brave Search API call
            Write-Verbose "Server '$serverName' is type 'braveSearch'. Executing via Brave Search API."

            # Use $serverUrl which should contain the apiUrl from config
            if ([string]::IsNullOrWhiteSpace($serverUrl)) {
                 Write-Warning "Server '$serverName' (type 'braveSearch') configuration is missing the 'apiUrl' (or 'url') property. Skipping."
                 continue
            }
            if ([string]::IsNullOrWhiteSpace($Credentials)) {
                 Write-Warning "Server '$serverName' (type 'braveSearch') requires credentials (API Key), but none were found or provided via 'credentialEnvVar'. Skipping."
                 continue
            }

            # Pass the full server config object to the helper
            $result = Invoke-BraveSearchTool -ServerConfig $server -ToolName $ToolName -Parameters $Parameters -Credentials $credentials
            # The helper function returns a structured object {success, data, error}
            if ($result.success) {
                Write-Verbose "Successfully executed Brave Search tool '$ToolName'."
                return $result # Return the structured result object
            } else {
                Write-Warning "Execution of Brave Search tool '$ToolName' failed. Error: $($result.error). Trying next server if available."
                # Continue to the next server
            }
        } else { # Default to generic remote execution
            # Execute remotely for other types (or if type is not specified)
            Write-Verbose "Server '$serverName' type is '$($serverType | Out-String -NoNewline)' or unspecified. Attempting generic remote execution."

            # Ensure $serverUrl is checked here as well
            if ([string]::IsNullOrWhiteSpace($serverUrl)) {
                 Write-Warning "Server '$serverName' (type '$($serverType | Out-String -NoNewline)') configuration is missing the 'url' property. Skipping."
                 continue
            }

            Write-Verbose "Attempting to invoke remote tool '$ToolName' on server '$serverName' at URL '$serverUrl'."
            $result = Invoke-McpRequest -ServerUrl $serverUrl -ToolName $ToolName -Parameters $Parameters -Credentials $credentials
            # Check result and return on success for remote calls
            if ($null -ne $result) {
                Write-Verbose "Successfully executed remote tool '$ToolName' on server '$serverName'."
                return $result
            } else {
                Write-Warning "Remote execution of tool '$ToolName' failed on server '$serverName'. Trying next server if available."
                # Continue to the next server in the loop
            }
        }
    }

    # 4. If loop completes without success
    Write-Warning "Failed to execute MCP tool '$ToolName' on any configured and eligible server."
    return $null
}


Export-ModuleMember -Function Get-McpConfiguration, Get-McpServerCredentials, Test-McpAccess, Invoke-LocalFilesystemTool, Invoke-LocalGitTool, Invoke-McpRequest, Execute-McpTool