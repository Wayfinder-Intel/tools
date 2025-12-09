$files = @(
    "bookmarklets\facebook_id_finder.js",
    "bookmarklets\facebook_comment_expander.js",
    "bookmarklets\image_scraper.js",
    "bookmarklets\page_links_list.js",
    "bookmarklets\marketplace_creation_time.js"
)

foreach ($file in $files) {
    $path = Join-Path $PSScriptRoot $file
    if (Test-Path $path) {
        # Force UTF-8 encoding when reading
        $content = Get-Content $path -Raw -Encoding UTF8
        
        # [Uri]::EscapeDataString encodes everything, which is safer for bookmarklets than EscapeUriString
        # We need to ensure the string passed to EscapeDataString is correctly interpreted as Unicode strings in PowerShell
        $encoded = [Uri]::EscapeDataString($content)
        
        # Output strictly in ASCII/UTF-8 compatible way for the text file
        Write-Output "---START $file---"
        Write-Output "javascript:$encoded"
        Write-Output "---END $file---"
    }
    else {
        Write-Output "File not found: $path"
    }
}
