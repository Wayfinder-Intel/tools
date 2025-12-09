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
        $content = Get-Content $path -Raw
        # [Uri]::EscapeDataString encodes everything, which is safer for bookmarklets than EscapeUriString
        $encoded = [Uri]::EscapeDataString($content)
        Write-Output "---START $file---"
        Write-Output "javascript:$encoded"
        Write-Output "---END $file---"
    } else {
        Write-Output "File not found: $path"
    }
}
