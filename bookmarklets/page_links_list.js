(function () {
    try {
        var raw = Array.prototype.slice.call(document.links).map(function (a) { return a.getAttribute('href') || a.href; }).filter(Boolean);
        var links = raw.map(function (h) {
            try {
                var u = new URL(h, location.href);
                u.hash = '';
                ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(function (p) { u.searchParams.delete(p); });
                return u.toString();
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
        var uniq = Array.from(new Set(links));
        var hostCounts = uniq.reduce(function (a, u) {
            try {
                var d = new URL(u).hostname;
                a[d] = (a[d] || 0) + 1;
            } catch (e) { }
            return a;
        }, {});
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:10% 10%;z-index:2147483647;background:#111;color:#eee;border:1px solid #444;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);display:flex;flex-direction:column';
        wrap.innerHTML = '<div style="padding:.6rem .9rem;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center"><strong>Extracted links (' + uniq.length + ')</strong><button id="x" style="background:#333;border:0;color:#eee;padding:.3rem .6rem;border-radius:6px;cursor:pointer">Close</button></div>' +
            '<div style="padding:.6rem .9rem;display:grid;grid-template-columns:1fr;gap:.5rem;flex:1;min-height:0">' +
            '<div style="font:12px/1.4 monospace;white-space:pre;overflow:auto;border:1px solid #333;border-radius:6px;padding:.5rem" id="domains"></div>' +
            '<textarea id="out" style="flex:1;min-height:0;width:100%;resize:none;font:12px/1.4 monospace;background:#0b0b0b;color:#eee;border:1px solid #333;border-radius:6px;padding:.5rem"></textarea>' +
            '</div>' +
            '<div style="padding:.6rem .9rem;border-top:1px solid #333;display:flex;gap:.5rem">' +
            '<button id="copy" style="background:#2d6cdf;border:0;color:white;padding:.4rem .7rem;border-radius:6px;cursor:pointer">Copy</button>' +
            '<button id="csv" style="background:#444;border:0;color:#eee;padding:.4rem .7rem;border-radius:6px;cursor:pointer">Download CSV</button>' +
            '</div>';
        document.body.appendChild(wrap);
        var txt = uniq.join('\n');
        wrap.querySelector('#out').value = txt;
        wrap.querySelector('#domains').textContent = Object.keys(hostCounts).map(function (d) { return d + ': ' + hostCounts[d]; }).join('\n');
        wrap.querySelector('#x').onclick = function () { wrap.remove(); };
        wrap.querySelector('#copy').onclick = function () {
            try {
                navigator.clipboard.writeText(txt).then(function () { alert('Copied'); }).catch(function (e) { alert('Copy failed: ' + e); });
            } catch (e) {
                alert('Copy failed: ' + e);
            }
        };
        wrap.querySelector('#csv').onclick = function () {
            var csv = 'URL\n' + uniq.map(function (u) { return '"' + u.replace(/"/g, '""') + '"'; }).join('\n');
            var a = document.createElement('a');
            a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
            a.download = 'links.csv';
            a.click();
        };
    } catch (e) {
        console.error(e);
        alert('Extractor error: ' + e);
    }
})();
