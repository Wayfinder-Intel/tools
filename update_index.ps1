$indexFile = "index.html"
$encodedFile = "encoded_bookmarklets.txt"

$html = Get-Content $indexFile -Raw
$encodedContent = Get-Content $encodedFile -Raw

# Parse encoded bookmarklets
$bookmarklets = @{}
$pattern = "(?ms)---START (.*?)---[\r\n]+(.*?)[\r\n]+---END \1---"
[regex]::Matches($encodedContent, $pattern) | ForEach-Object {
    $path = $_.Groups[1].Value
    $code = $_.Groups[2].Value.Trim()
    $bookmarklets[$path] = $code
}

# Define mappings
$mappings = @{
    "bookmarklets\facebook_id_finder.js"        = "Facebook ID Finder"
    "bookmarklets\facebook_comment_expander.js" = "Comment Expander"
    "bookmarklets\image_scraper.js"             = "Image Scraper"
    "bookmarklets\page_links_list.js"           = "Link Extractor"
    "bookmarklets\marketplace_creation_time.js" = "Marketplace Time"
}

# Replace in HTML
foreach ($key in $mappings.Keys) {
    if ($bookmarklets.ContainsKey($key)) {
        $name = $mappings[$key]
        $code = $bookmarklets[$key]
        # Escape special regex characters in the name if necessary (none here really)
        
        # Target string to replace
        $target = "<a class=""btn primary"" href=""javascript:alert\('Please run the build script to populate this!'\)"">$name</a>"
        $replacement = "<a class=""btn primary"" href=""$code"">$name</a>"
        
        $html = $html -replace $target, $replacement
        Write-Host "Updated $name"
    }
    else {
        Write-Warning "Code for $key not found in encoded file."
    }
}

Set-Content -Path $indexFile -Value $html -Encoding UTF8
Write-Host "index.html updated successfully."
