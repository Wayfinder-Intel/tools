(function () {
    try {
        var html = document.documentElement.innerHTML || '';
        var ids = [];
        var m;
        var r = /"userID"\s*:\s*"(\d{5,20})"/g;
        while ((m = r.exec(html))) {
            ids.push(m[1]);
            if (ids.length > 4) break;
        }
        if (ids.length < 2) {
            alert('Did not find a second "userID" on this page.');
            return;
        }
        var id = ids[1];
        var b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,0.08)';
        var s = b.attachShadow({ mode: 'open' });
        var st = document.createElement('style');
        st.textContent =
            ':host{all:initial;font-family:system-ui,Segoe UI,Arial,sans-serif}' +
            '*{box-sizing:border-box}' +
            '.c{margin:12vh 0;background:#111;color:#eee;min-width:320px;max-width:560px;border:1px solid #333;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);padding:14px}' +
            '.t{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}' +
            '.x{background:#333;border:0;color:#eee;padding:.35rem .6rem;border-radius:8px;cursor:pointer}' +
            '.l{opacity:.8;font-size:12px;margin:.25rem 0}' +
            '.r{display:flex;gap:8px;align-items:center}' +
            '.i{flex:1;padding:.5rem .6rem;border:1px solid #333;border-radius:8px;background:#0b0b0b;color:#eee;font:14px/1.2 monospace}' +
            '.b{background:#2a2a2a;border:0;color:#eee;padding:.45rem .7rem;border-radius:8px;cursor:pointer}' +
            '.p{background:#2d6cdf;color:#fff}';
        var c = document.createElement('div');
        c.className = 'c';
        var top = document.createElement('div');
        top.className = 't';
        var ttl = document.createElement('div');
        ttl.textContent = 'Facebook userID';
        var cls = document.createElement('button');
        cls.className = 'x';
        cls.textContent = 'Close';
        cls.onclick = function () { b.remove(); };
        top.appendChild(ttl);
        top.appendChild(cls);
        c.appendChild(top);
        var lbl = document.createElement('div');
        lbl.className = 'l';
        lbl.textContent = '2nd "userID" found:';
        c.appendChild(lbl);
        var row = document.createElement('div');
        row.className = 'r';
        var inp = document.createElement('input');
        inp.className = 'i';
        inp.readOnly = true;
        inp.value = id;
        var cp = document.createElement('button');
        cp.className = 'b';
        cp.textContent = 'Copy';
        cp.onclick = function () {
            navigator.clipboard.writeText(id).then(function () {
                cp.textContent = 'Copied';
                setTimeout(function () { cp.textContent = 'Copy'; }, 900);
            }).catch(function (e) {
                alert('Copy failed:' + e);
            });
        };
        var go = document.createElement('button');
        go.className = 'b p';
        go.textContent = 'Marketplace';
        go.onclick = function () {
            window.open('https://www.facebook.com/marketplace/profile/' + id, '_blank', 'noopener');
        };
        row.appendChild(inp);
        row.appendChild(cp);
        row.appendChild(go);
        c.appendChild(row);
        var lbl2 = document.createElement('div');
        lbl2.className = 'l';
        lbl2.textContent = 'Search this profile:';
        c.appendChild(lbl2);
        var row2 = document.createElement('div');
        row2.className = 'r';
        var kw = document.createElement('input');
        kw.className = 'i';
        kw.placeholder = 'Enter keyword';
        kw.addEventListener('keydown', function (e) { e.stopPropagation(); e.stopImmediatePropagation(); });
        kw.addEventListener('keyup', function (e) { e.stopPropagation(); e.stopImmediatePropagation(); });
        kw.addEventListener('keypress', function (e) { e.stopPropagation(); e.stopImmediatePropagation(); });
        var sowBtn = document.createElement('button');
        sowBtn.className = 'b p';
        sowBtn.textContent = 'Sowsearch';
        sowBtn.onclick = function () {
            var innerObj = { name: 'author', args: id };
            var filterObj = { rp_author: JSON.stringify(innerObj) };
            var filterStr = btoa(JSON.stringify(filterObj));
            var url = 'https://www.facebook.com/search/top/?q=' + encodeURIComponent(kw.value) + '&filters=' + filterStr + '&epa=FILTERS&_rdr';
            window.open(url, '_blank');
        };
        var profileBtn = document.createElement('button');
        profileBtn.className = 'b p';
        profileBtn.textContent = 'Profile Search';
        profileBtn.onclick = function () {
            var url = 'https://www.facebook.com/profile/' + id + '/search/?q=' + encodeURIComponent(kw.value);
            window.open(url, '_blank');
        };
        row2.appendChild(kw);
        row2.appendChild(sowBtn);
        row2.appendChild(profileBtn);
        c.appendChild(row2);
        s.appendChild(st);
        s.appendChild(c);
        document.body.appendChild(b);
    } catch (e) {
        alert('userID finder error:' + e.message);
    }
})();
