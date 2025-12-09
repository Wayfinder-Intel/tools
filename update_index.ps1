$indexFile = "index.html"
$encodedFile = "encoded_bookmarklets.txt"

# Force UTF-8 reading for both files
$html = Get-Content $indexFile -Raw -Encoding UTF8
$encodedContent = Get-Content $encodedFile -Raw -Encoding UTF8

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
        
        # Target regex to replace - matching the anchor tag for this specific bookmarklet
        # We look for <a ...>$name</a> and replace the whole tag
        # Escape special regex characters in $name just in case
        $escapedName = [regex]::Escape($name)
        $pattern = "<a class=""btn primary"" href=""[^""]*"">$escapedName</a>"
        $replacement = "<a class=""btn primary"" href=""$code"">$name</a>"
        
        if ($html -match $pattern) {
            $html = [regex]::Replace($html, $pattern, $replacement)
            Write-Host "Updated $name"
        }
        else {
            Write-Warning "Placeholder/Link for $name not found in index.html"
        }
    }
    else {
        Write-Warning "Code for $key not found in encoded file."
    }
}

# Save with UTF-8 encoding (No BOM is often better for web, but PowerShell 5.1 'UTF8' adds BOM. 
# 'Default' is usually ANSI. We want UTF-8. 
# To be safe and avoid BOM issues if possible, we can use [System.IO.File]::WriteAllText)

[System.IO.File]::WriteAllText($indexFile, $html, [System.Text.Encoding]::UTF8)
Write-Host "index.html updated successfully."
