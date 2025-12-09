(function () {
    try {
        var add = function (set, u) {
            if (!u) return;
            try {
                var x = new URL(u, location.href);
                x.hash = '';
                set.add(x.toString());
            } catch (e) { }
        };

        var found = new Set();
        document.querySelectorAll('img').forEach(function (img) {
            add(found, img.getAttribute('src') || img.src);
            (img.getAttribute('srcset') || '').split(',').forEach(function (v) {
                var a = v.trim().split(' ')[0];
                if (a) add(found, a);
            });
            ['data-src', 'data-original', 'data-lazy', 'data-echo', 'data-iesrc'].forEach(function (k) {
                add(found, img.getAttribute(k));
            });
        });

        Array.prototype.forEach.call(document.querySelectorAll('*'), function (el) {
            var bg = getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') {
                var re = /url\((['"]?)(.*?)\1\)/g, m;
                while ((m = re.exec(bg))) {
                    add(found, m[2]);
                }
            }
        });

        var list = Array.from(found);
        var host = document.createElement('div');
        host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;overflow:auto;background:rgba(0,0,0,0.02)';
        var sh = host.attachShadow({ mode: 'open' });
        var style = document.createElement('style');
        style.textContent = ':host{all:initial;font-family:system-ui,Segoe UI,Arial,sans-serif}*{box-sizing:border-box}.wrap{min-height:100%;background:#0f0f10;color:#eaeaea;display:flex;flex-direction:column}.top{position:sticky;top:0;z-index:1;padding:.6rem .9rem;background:#0f0f10;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;justify-content:space-between;gap:.5rem}.btn{background:#2a2a2a;border:0;color:#eee;padding:.35rem .6rem;border-radius:6px;cursor:pointer}.grid{padding:.7rem .9rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.9rem}.card{position:relative;background:#151518;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;display:flex;flex-direction:column}.thumb{display:block;width:100%;height:180px;object-fit:cover;background:#0b0b0c}.meta{padding:.45rem .5rem}.url{word-break:break-all;opacity:.85;font-size:12px;line-height:1.2;max-height:3.4em;overflow:hidden}.dims{opacity:.65;font-size:11px;margin-top:.2rem}.bar{position:absolute;left:8px;right:8px;bottom:8px;display:flex;gap:.4rem;justify-content:flex-end}.chip{background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.15);padding:.25rem .45rem;border-radius:6px;font-size:12px;cursor:pointer}.toast{position:fixed;right:12px;bottom:12px;background:#2d6cdf;color:#fff;padding:.4rem .6rem;border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.3);font:12px/1 system-ui}';
        var wrap = document.createElement('div');
        wrap.className = 'wrap';
        var topDiv = document.createElement('div');
        topDiv.className = 'top';
        var left = document.createElement('div');
        var title = document.createElement('strong');
        title.textContent = 'Image Scraper';
        var count = document.createElement('span');
        count.id = 'count';
        count.style.opacity = '0.75';
        count.style.marginLeft = '.4rem';
        left.appendChild(title);
        left.appendChild(count);
        var right = document.createElement('div');
        var closeBtn = document.createElement('button');
        closeBtn.className = 'btn';
        closeBtn.id = 'close';
        closeBtn.textContent = 'Close';
        right.appendChild(closeBtn);
        topDiv.appendChild(left);
        topDiv.appendChild(right);
        var grid = document.createElement('div');
        grid.className = 'grid';
        grid.id = 'grid';
        wrap.appendChild(topDiv);
        wrap.appendChild(grid);
        sh.appendChild(style);
        sh.appendChild(wrap);
        document.body.appendChild(host);
        count.textContent = ' (' + list.length + ' found)';
        var toast = function (msg) {
            var n = document.createElement('div');
            n.className = 'toast';
            n.textContent = msg;
            sh.appendChild(n);
            setTimeout(function () { n.remove(); }, 1200);
        };
        var makeCard = function (u) {
            var card = document.createElement('div');
            card.className = 'card';
            var img = document.createElement('img');
            img.className = 'thumb';
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';
            img.src = u;
            var meta = document.createElement('div');
            meta.className = 'meta';
            var urlDiv = document.createElement('div');
            urlDiv.className = 'url';
            urlDiv.textContent = u;
            var dims = document.createElement('div');
            dims.className = 'dims';
            dims.textContent = '...';
            img.addEventListener('load', function () {
                dims.textContent = (img.naturalWidth || '?') + 'x' + (img.naturalHeight || '?');
            }, { once: true });
            var bar = document.createElement('div');
            bar.className = 'bar';
            var copyBtn = document.createElement('button');
            copyBtn.className = 'chip';
            copyBtn.textContent = 'Copy';
            copyBtn.onclick = function () {
                navigator.clipboard.writeText(u).then(function () {
                    toast('Copied');
                }).catch(function (e) {
                    alert('Copy failed: ' + e);
                });
            };
            var openBtn = document.createElement('button');
            openBtn.className = 'chip';
            openBtn.textContent = 'Open';
            openBtn.onclick = function () {
                window.open(u, '_blank', 'noopener');
            };
            bar.appendChild(copyBtn);
            bar.appendChild(openBtn);
            meta.appendChild(urlDiv);
            meta.appendChild(dims);
            card.appendChild(img);
            card.appendChild(meta);
            card.appendChild(bar);
            return card;
        };
        var i = 0;
        (function batch() {
            var end = Math.min(i + 60, list.length);
            for (; i < end; i++) {
                grid.appendChild(makeCard(list[i]));
            }
            if (i < list.length) requestAnimationFrame(batch);
        })();
        closeBtn.onclick = function () {
            host.remove();
        };
    } catch (e) {
        alert('Image scraper error: ' + (e && e.message ? e.message : e));
    }
})();
