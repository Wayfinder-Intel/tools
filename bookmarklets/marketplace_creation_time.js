(function () {
    try {
        var re = /"creation_time"\s*:\s*(\d{10,13})\b/;
        function scanScripts() {
            var s = document.scripts;
            for (var i = 0; i < s.length; i++) {
                var t = s[i].textContent || "";
                var m = re.exec(t);
                if (m) return m[1]
            }
            return null
        }
        var raw = scanScripts();
        if (!raw) {
            var txt = document.documentElement.textContent || "";
            var m = re.exec(txt);
            raw = m ? m[1] : null
        }
        if (!raw) {
            alert("No \"creation_time\" found.");
            return
        }
        var sec = (raw.length > 10) ? Math.floor(parseInt(raw, 10) / 1000) : parseInt(raw, 10);
        if (!isFinite(sec)) {
            alert("Invalid creation_time: " + raw);
            return
        }
        var ms = sec * 1000, dL = new Date(ms), dU = new Date(ms), months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], z = function (n) { return (n < 10 ? "0" : "") + n }, fmtLocal = function (d) { return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear() + ", " + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds()) }, fmtUTC = function (d) { return d.getUTCDate() + " " + months[d.getUTCMonth()] + " " + d.getUTCFullYear() + ", " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()) + ":" + z(d.getUTCSeconds()) }, box = document.createElement("div");
        box.style.cssText = "position:fixed;top:12vh;left:12vw;z-index:2147483647;background:#0f0f10;color:#eaeaea;border:1px solid #2a2a2a;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);min-width:320px;max-width:90vw;font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif";
        var header = document.createElement("div");
        header.style.cssText = "cursor:move;padding:10px 14px;background:#151518;border-bottom:1px solid #2a2a2a;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;gap:.5rem";
        var title = document.createElement("div");
        title.textContent = "Marketplace listing creation time";
        var close = document.createElement("button");
        close.textContent = "×";
        close.style.cssText = "all:unset;cursor:pointer;font-size:18px;line-height:1;background:#2a2a2a;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:2px 8px";
        close.onclick = function () { box.remove() };
        header.appendChild(title);
        header.appendChild(close);
        var body = document.createElement("div");
        body.style.cssText = "padding:12px 14px 14px";
        function row(label, value) {
            var p = document.createElement("div");
            p.style.margin = "6px 0";
            var b = document.createElement("div");
            b.style.opacity = ".85";
            b.textContent = label;
            var v = document.createElement("div");
            v.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;font-weight:600";
            v.textContent = value;
            p.appendChild(b);
            p.appendChild(v);
            return p
        }
        var note = document.createElement("div");
        note.style.cssText = "margin-bottom:10px;font-size:13px;opacity:.8";
        note.textContent = "Note: Refresh the listing with Ctrl+R before using this bookmarklet!";
        body.appendChild(note);
        body.appendChild(row("Epoch (seconds)", String(sec)));
        body.appendChild(row("UTC", fmtUTC(dU)));
        body.appendChild(row("Browser local time", fmtLocal(dL)));
        var actions = document.createElement("div");
        actions.style.cssText = "margin-top:10px;display:flex;gap:8px;justify-content:flex-start;align-items:center";
        var copy = document.createElement("button");
        copy.textContent = "Copy details";
        copy.style.cssText = "all:unset;cursor:pointer;font-size:13px;line-height:1;background:#2d6cdf;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 10px";
        copy.onclick = function () {
            var txt = "Epoch (seconds): " + sec + "\nUTC: " + fmtUTC(dU) + "\nBrowser local time: " + fmtLocal(dL);
            navigator.clipboard.writeText(txt).then(function () {
                copy.textContent = "Copied";
                setTimeout(function () { copy.textContent = "Copy details" }, 1200)
            }).catch(function (e) { alert("Copy failed: " + e) })
        };
        actions.appendChild(copy);
        body.appendChild(actions);
        box.appendChild(header);
        box.appendChild(body);
        document.body.appendChild(box);
        (function () {
            var ox = 0, oy = 0, dx = 0, dy = 0, drag = false;
            header.addEventListener("mousedown", function (e) {
                drag = true; dx = e.clientX; dy = e.clientY;
                var r = box.getBoundingClientRect();
                ox = r.left; oy = r.top;
                e.preventDefault()
            });
            document.addEventListener("mousemove", function (e) {
                if (!drag) return;
                var nx = ox + (e.clientX - dx), ny = oy + (e.clientY - dy);
                box.style.left = Math.max(0, Math.min(innerWidth - 60, nx)) + "px";
                box.style.top = Math.max(0, Math.min(innerHeight - 40, ny)) + "px"
            });
            document.addEventListener("mouseup", function () { drag = false })
        })();
    } catch (e) {
        alert("Bookmarklet error: " + (e && e.message ? e.message : e))
    }
})();
