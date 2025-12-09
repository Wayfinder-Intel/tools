(function () {
    const min = 300, max = 800; // adjust delay between clicks in milliseconds
    let running = true;
    function rand() {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function clickNext() {
        if (!running) return;
        var btn = Array.prototype.slice.call(document.querySelectorAll('a,button,div[role="button"]')).find(function (el) { return /view/i.test(el.textContent) && el.offsetParent !== null; });
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            btn.click();
            console.log('Clicked:', btn.textContent.trim());
            window.scrollBy(0, 200);
            setTimeout(clickNext, rand());
        } else {
            alert('No more "view" buttons found.');
            panel.remove();
        }
    }
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;bottom:15px;right:15px;z-index:999999;padding:6px 10px;background:#111;color:#eee;border:1px solid #333;border-radius:8px;font:13px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.4);display:flex;gap:6px;align-items:center';
    var btnPause = document.createElement('button');
    btnPause.textContent = 'Pause';
    var btnStop = document.createElement('button');
    btnStop.textContent = 'Stop';
    [btnPause, btnStop].forEach(function (b) {
        b.style.cssText = 'background:#2a2a2a;border:0;color:#eee;padding:4px 8px;border-radius:6px;cursor:pointer;font:13px system-ui';
    });
    btnPause.onclick = function () {
        running = !running;
        if (running) {
            btnPause.textContent = 'Pause';
            clickNext();
        } else {
            btnPause.textContent = 'Resume';
        }
    };
    btnStop.onclick = function () {
        running = false;
        panel.remove();
        alert('Stopped.');
    };
    panel.append('Auto-View:', btnPause, btnStop);
    document.body.appendChild(panel);
    clickNext();
})();
