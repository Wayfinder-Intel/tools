const htmlString1 = `<a href="https://www.tiktok.com/@some_user">User</a>`;
const htmlString2 = `<a href="/@some_user">User</a>`;

const parser = new DOMParser();
const doc1 = parser.parseFromString(htmlString1, 'text/html');
const anchors1 = doc1.querySelectorAll('a[href^="/@"]');
console.log("Test 1 (full URL):", anchors1.length);

const doc2 = parser.parseFromString(htmlString2, 'text/html');
const anchors2 = doc2.querySelectorAll('a[href^="/@"]');
console.log("Test 2 (relative URL):", anchors2.length);

const allAnchors = doc1.querySelectorAll('a');
allAnchors.forEach(a => {
    console.log("All anchors href:", a.getAttribute('href'));
});
