/**
 * Wayfinder — TikTok Profile Ingester
 * Version: 1.0
 * Date: 2026-05-24
 *
 * USAGE:
 *   Create a new bookmark in Chrome. Set the URL to the contents of
 *   tiktok-profile-v1.0.min.js.
 *   Navigate to any TikTok profile page (e.g. tiktok.com/@username)
 *   and click the bookmark.
 *
 * WHAT IT CAPTURES:
 *   - Username / Handle (without @)
 *   - Nickname / Display Name
 *   - Avatar image URL
 *   - Following, Followers, and Likes metrics
 *   - Bio description text
 *   - Linked external connections (e.g. websites)
 */
(function () {
  try {
    // ── NICKNAME / DISPLAY NAME ───────────────────────────────────────────────
    var displayName = '';
    var titleEl = document.querySelector('[data-e2e="user-title"]');
    if (titleEl) {
      displayName = titleEl.innerText.trim();
    }

    // ── USERNAME / HANDLE ─────────────────────────────────────────────────────
    var username = '';
    var subEl = document.querySelector('[data-e2e="user-subtitle"]');
    if (subEl) {
      username = subEl.innerText.replace(/^@/, '').trim();
    }
    if (!username) {
      var pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && pathParts[0].indexOf('@') === 0) {
        username = pathParts[0].substring(1);
      }
    }
    if (!username) {
      alert('Wayfinder: TikTok username not found. Make sure you are on a profile page.');
      return;
    }
    if (!displayName) displayName = username;

    // ── AVATAR ────────────────────────────────────────────────────────────────
    var avatar = '';
    var avatarEl = document.querySelector('[data-e2e="user-avatar"]');
    if (avatarEl) {
      var img = avatarEl.tagName === 'IMG' ? avatarEl : avatarEl.querySelector('img');
      if (img) {
        avatar = img.src || img.getAttribute('src') || '';
      }
    }
    if (!avatar) {
      var fallbackImg = document.querySelector('img[class*="ImgAvatar"]');
      if (fallbackImg) avatar = fallbackImg.src;
    }

    // ── STATS ─────────────────────────────────────────────────────────────────
    var following = '0';
    var followers = '0';
    var likes = '0';

    var followingEl = document.querySelector('[data-e2e="following-count"]');
    if (followingEl) following = followingEl.innerText.trim();

    var followersEl = document.querySelector('[data-e2e="followers-count"]');
    if (followersEl) followers = followersEl.innerText.trim();

    var likesEl = document.querySelector('[data-e2e="likes-count"]');
    if (likesEl) likes = likesEl.innerText.trim();

    // ── BIO ───────────────────────────────────────────────────────────────────
    var bio = '';
    var bioEl = document.querySelector('[data-e2e="user-bio"]');
    if (bioEl) {
      bio = bioEl.innerText.trim();
    }

    // ── CONNECTIONS (Website / External Links) ────────────────────────────────
    var connections = [];
    var websiteEl = document.querySelector('a[data-e2e="user-link"]');
    if (websiteEl) {
      var href = websiteEl.href || websiteEl.getAttribute('href') || '';
      var txt = websiteEl.innerText.trim();
      if (href) {
        connections.push({
          text: txt || href,
          href: href
        });
      }
    }
    
    // Check if bio contains any links
    if (bioEl) {
      var bioLinks = bioEl.querySelectorAll('a');
      for (var i = 0; i < bioLinks.length; i++) {
        var href = bioLinks[i].href || bioLinks[i].getAttribute('href') || '';
        var txt = bioLinks[i].innerText.trim();
        if (href && !connections.some(function (c) { return c.href === href; })) {
          connections.push({
            text: txt || href,
            href: href
          });
        }
      }
    }

    // ── BUILD PAYLOAD ─────────────────────────────────────────────────────────
    var id = username;
    var pyld = {
      platform:   'tiktok',
      id:         id,
      handle:     username,
      label:      displayName,
      url:        'https://www.tiktok.com/@' + username,
      image:      avatar,
      followers:  followers,
      following:  following,
      likes:      likes,
      bio:        bio,
      connections: connections.length ? connections : undefined,
      isPage:     false
    };

    var pl = JSON.stringify([pyld], null, 2);

    // ── UI PANEL ──────────────────────────────────────────────────────────────
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.15)';
    var sh = host.attachShadow({ mode: 'open' });

    var se = document.createElement('style');
    se.textContent = [
      '*{box-sizing:border-box;font-family:system-ui,sans-serif}',
      '.c{margin:10vh auto;background:#111;color:#eee;width:420px;border:1px solid #333;border-radius:10px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.6)}',
      '.h{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}',
      '.t{font-size:13px;font-weight:700;color:#ff0050}',
      '.btn{border:0;border-radius:6px;cursor:pointer;padding:5px 12px;font-size:12px}',
      '.cb{background:#333;color:#eee}',
      '.cpb{background:#00f2fe;color:#000;padding:6px 14px;font-weight:bold}',
      '.cpb:hover{background:#00d8e4}',
      '.g{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12px;margin-bottom:10px}',
      '.l{opacity:.55;text-transform:uppercase;font-size:10px;letter-spacing:.05em}',
      '.v{word-break:break-all;font-family:monospace}',
      '.av{width:48px;height:48px;border-radius:50%;object-fit:cover;float:right;margin:0 0 4px 10px;border:2px solid #333}',
      '.sep{border:none;border-top:1px solid #222;margin:8px 0}',
      '.chips{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 6px}',
      '.chip{display:inline-flex;flex-direction:column;gap:1px;background:#0d1818;color:#4af2f2;border:1px solid #1a6b6b;padding:3px 9px;border-radius:10px;font-size:11px;text-decoration:none}',
      '.chip:hover{opacity:.8}',
      '.lbl{background:#1a6b6b;color:#a3ffff;padding:1px 5px;border-radius:6px;font-size:10px;font-weight:600;text-transform:uppercase;white-space:nowrap;align-start:flex-start}',
      '.ta{width:100%;height:100px;resize:none;background:#0a0a0a;color:#888;border:1px solid #222;border-radius:6px;padding:8px;font:11px/1.4 monospace}',
      '.row{display:flex;gap:8px;margin-top:10px;align-items:center}',
      '.ok{color:#22c55e;font-size:12px;font-weight:600}',
      '.sl{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.05em;margin:6px 0 3px}'
    ].join('');
    sh.appendChild(se);

    var cd = document.createElement('div');
    cd.className = 'c';

    var cnxHtml = '';
    if (connections.length) {
      cnxHtml = '<div class="sl">Connected To</div><div class="chips">' +
        connections.map(function (c) {
          return '<a class="chip" href="' + c.href + '" target="_blank">' +
            c.text +
            '</a>';
        }).join('') + '</div>';
    }

    cd.innerHTML =
      '<div class="h"><span class="t">Wayfinder \u2014 TikTok Profile v1.0</span><button class="btn cb" id="cl">Close</button></div>' +
      (avatar ? '<img class="av" src="' + avatar + '" onerror="this.style.display=\'none\'">' : '') +
      '<div class="g">' +
        '<span class="l">Username</span><span class="v">'    + username  + '</span>' +
        '<span class="l">Nickname</span><span class="v">'    + displayName  + '</span>' +
        '<span class="l">ID</span><span class="v">'      + id    + '</span>' +
        '<span class="l">Following</span><span class="v">'  + following  + '</span>' +
        '<span class="l">Followers</span><span class="v">'  + followers  + '</span>' +
        '<span class="l">Likes</span><span class="v">'      + likes  + '</span>' +
      '</div>' +
      cnxHtml +
      '<hr class="sep">' +
      '<textarea class="ta" readonly>' + pl + '</textarea>' +
      '<div class="row"><button class="btn cpb" id="cp">Copy JSON</button><span class="ok" id="ok" style="display:none">Copied!</span></div>';

    cd.querySelector('#cl').onclick = function () { host.remove(); };
    cd.querySelector('#cp').onclick = function () {
      navigator.clipboard.writeText(pl).then(function () {
        var o = cd.querySelector('#ok');
        o.style.display = '';
        setTimeout(function () { o.style.display = 'none'; }, 2000);
      });
    };

    sh.appendChild(cd);
    document.body.appendChild(host);

  } catch (e) {
    alert('Wayfinder: ' + e.message);
  }
})();
