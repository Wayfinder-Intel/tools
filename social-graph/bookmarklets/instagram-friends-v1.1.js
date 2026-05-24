/**
 * Wayfinder Connect — Instagram Friends Ingester
 * Version: 1.1
 * Date: 2026-05-24
 *
 * USAGE:
 *   Create a new bookmark in Chrome. Set the URL to the contents of
 *   instagram-friends-v1.1.min.js.
 *   Navigate to any Instagram profile page, click on "followers" or "following"
 *   to open the pop-up modal dialog, and click the bookmark.
 *
 * WHAT IT CAPTURES:
 *   - Profile Owner (Username, Name, Avatar)
 *   - Followers/Following list loaded in modal (Username, Name, URL, Avatar, Order Rank)
 *
 * JSON OUTPUT SHAPE:
 *   {
 *     type: "friends_list",
 *     platform: "instagram",
 *     owner: {
 *       id: "ig_username",
 *       name: "Display Name",
 *       url: "https://www.instagram.com/username",
 *       avatar: "https://..."
 *     },
 *     following: [  // Or "followers" if parsing a follower list modal
 *       {
 *         id: "ig_followed_user",
 *         name: "Followed Name",
 *         url: "https://www.instagram.com/followed_user",
 *         avatar: "https://...",
 *         friendRank: 1,
 *         isPage: false
 *       }
 *     ]
 *   }
 */
(function () {
  try {
    // ── OWNER DETECTION ───────────────────────────────────────────────────────
    var ownerUsername = '';
    var ownerDisplayName = '';
    var ownerAvatar = '';

    var h2 = document.querySelector('header h2');
    if (h2) {
      ownerUsername = h2.innerText.trim();
    }
    if (!ownerUsername) {
      var pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        ownerUsername = pathParts[0];
      }
    }
    if (!ownerUsername || ['explore', 'reels', 'direct', 'developer'].indexOf(ownerUsername.toLowerCase()) !== -1) {
      ownerUsername = 'instagram_user';
    }

    var nameEl = document.querySelector('div.x1e56ztr span') || document.querySelector('header span[class*="x1e56ztr"]');
    if (nameEl) {
      ownerDisplayName = nameEl.innerText.trim();
    }
    if (!ownerDisplayName) {
      ownerDisplayName = ownerUsername;
    }

    var header = document.querySelector('header');
    var imgEl = header ? (header.querySelector('img[alt*="profile picture"]') || header.querySelector('img')) : null;
    if (imgEl) {
      ownerAvatar = imgEl.src;
    }

    // ── MODAL & SCROLL CONTAINER DETECTION ─────────────────────────────────────
    var scrollContainer = null;
    var dialog = document.querySelector('div[role="dialog"]');
    if (dialog) {
      scrollContainer = dialog.querySelector('div[style*="overflow"]');
    }
    if (!scrollContainer) {
      scrollContainer = document.querySelector('div[style*="overflow: hidden auto"]') || 
                        document.querySelector('div[style*="overflow-y: auto"]') ||
                        document.querySelector('div[style*="overflow: auto"]') ||
                        document.querySelector('div.x6nl9eh div[style*="overflow"]') ||
                        document.querySelector('div[class*="x6nl9eh"] div[style*="overflow"]');
    }
    // Fallback: search for any visible scrollable div
    if (!scrollContainer) {
      var divs = document.querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var style = divs[i].getAttribute('style') || '';
        if (style.indexOf('overflow') !== -1 && (style.indexOf('auto') !== -1 || style.indexOf('scroll') !== -1)) {
          if (divs[i].offsetHeight > 0) {
            scrollContainer = divs[i];
            break;
          }
        }
      }
    }

    if (!scrollContainer) {
      alert('Wayfinder: Followers/Following pop-up list not found. Make sure the followers/following list dialog is open.');
      return;
    }

    // ── DETECT LIST TYPE (FOLLOWERS VS FOLLOWING) ─────────────────────────────
    var listType = 'following'; // default
    if (location.pathname.indexOf('/followers') !== -1) {
      listType = 'followers';
    } else if (location.pathname.indexOf('/following') !== -1) {
      listType = 'following';
    } else if (dialog) {
      var textStr = dialog.innerText.substring(0, 1000).toLowerCase();
      if (textStr.indexOf('followers') !== -1) {
        listType = 'followers';
      } else if (textStr.indexOf('following') !== -1) {
        listType = 'following';
      }
    }

    // ── PARSE VISIBLE ROW DATA ────────────────────────────────────────────────
    var friendsList = [];
    var seenHandles = new Set();

    var imgs = Array.from(scrollContainer.querySelectorAll('img'));
    imgs.forEach(function (img) {
      var row = img.parentElement;
      var profileLink = null;
      var handle = '';

      for (var depth = 0; depth < 10; depth++) {
        if (!row || row === scrollContainer) break;

        var links = row.querySelectorAll('a');
        for (var j = 0; j < links.length; j++) {
          var href = links[j].getAttribute('href') || '';
          var match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          if (match) {
            var u = match[1];
            if (!['explore', 'reels', 'direct', 'developer', 'about', 'blog', 'jobs', 'help', 'api', 'privacy', 'terms', 'locations', 'instagram'].includes(u.toLowerCase())) {
              profileLink = links[j];
              handle = u;
              break;
            }
          }
        }
        if (profileLink) break;
        row = row.parentElement;
      }

      if (!profileLink || !handle) return;

      var lowerHandle = handle.toLowerCase();
      if (seenHandles.has(lowerHandle)) return;
      seenHandles.add(lowerHandle);

      var displayName = '';
      var spans = Array.from(row.querySelectorAll('span, div'));
      for (var s = 0; s < spans.length; s++) {
        var txt = spans[s].innerText || '';
        txt = txt.trim();
        if (txt && 
            txt.toLowerCase() !== lowerHandle && 
            !/^(follow|following|remove|requested|cancel|message|verified)$/i.test(txt) && 
            txt.length < 50 &&
            spans[s].querySelectorAll('a, button').length === 0) {
          displayName = txt;
          break;
        }
      }
      if (!displayName) displayName = handle;

      friendsList.push({
        id: 'ig_' + handle,
        name: displayName,
        url: 'https://www.instagram.com/' + handle,
        avatar: img.src || '',
        isPage: false
      });
    });

    // Assemble final JSON payload
    var payload = {
      type: 'friends_list',
      platform: 'instagram',
      owner: {
        id: 'ig_' + ownerUsername,
        name: ownerDisplayName,
        url: 'https://www.instagram.com/' + ownerUsername,
        avatar: ownerAvatar || ''
      }
    };
    payload[listType] = friendsList;

    var pl = JSON.stringify(payload, null, 2);

    // ── RENDERING PANEL ───────────────────────────────────────────────────────
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.35)';
    var sh = host.attachShadow({ mode: 'open' });

    var se = document.createElement('style');
    se.textContent = [
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}',
      '.c{margin:5vh auto;background:rgba(17,17,17,0.96);color:#eee;width:480px;border:1px solid #333;border-radius:12px;padding:20px;box-shadow:0 20px 40px rgba(0,0,0,0.8);backdrop-filter:blur(10px);display:flex;flex-direction:column;max-height:90vh;border:1px solid rgba(255,255,255,0.08)}',
      '.h{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #222;padding-bottom:10px}',
      '.t{font-size:14px;font-weight:700;color:#e1306c}',
      '.btn{border:0;border-radius:6px;cursor:pointer;padding:6px 14px;font-size:12px;font-weight:600;transition:all 0.2s ease}',
      '.cb{background:#333;color:#eee}',
      '.cb:hover{background:#444}',
      '.cpb{background:linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);color:#fff;padding:8px 18px}',
      '.cpb:hover{opacity:.9}',
      '.g{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12px;margin-bottom:10px;background:#161616;padding:10px;border-radius:8px;border:1px solid #222;align-items:center}',
      '.l{opacity:.55;text-transform:uppercase;font-size:10px;letter-spacing:.05em}',
      '.v{word-break:break-all;font-family:monospace}',
      '.av{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #333}',
      '.o-av{width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #e1306c}',
      '.sl{font-size:11px;opacity:.55;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px;font-weight:600}',
      '.flist{display:flex;flex-direction:column;gap:8px;overflow-y:auto;max-height:220px;margin-bottom:14px;padding-right:4px}',
      '.fcard{display:flex;align-items:center;gap:10px;background:#181818;border:1px solid #2a2a2a;padding:8px;border-radius:8px}',
      '.finfo{display:flex;flex-direction:column;flex-grow:1;min-width:0}',
      '.fname{font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.fdesc{font-size:10px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.fbadge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;text-transform:uppercase;letter-spacing:0.02em}',
      '.fbadge-rank{background:#6e1e47;color:#ffa0c4}',
      '.sep{border:none;border-top:1px solid #222;margin:12px 0}',
      '.ta{width:100%;height:100px;resize:none;background:#0a0a0a;color:#888;border:1px solid #222;border-radius:6px;padding:8px;font:10px/1.4 monospace}',
      '.row{display:flex;gap:10px;margin-top:12px;align-items:center}',
      '.ok{color:#22c55e;font-size:12px;font-weight:600}'
    ].join('');
    sh.appendChild(se);

    var cd = document.createElement('div');
    cd.className = 'c';

    var listTitleText = listType.substring(0,1).toUpperCase() + listType.substring(1);
    var friendsHtml = friendsList.length
      ? friendsList.map(function (f) {
          return '<div class="fcard">' +
            '<img class="av" src="' + f.avatar + '" onerror="this.style.display=\'none\'">' +
            '<div class="finfo">' +
              '<div class="fname">' + f.name + '</div>' +
              '<div class="fdesc">' + f.url + '</div>' +
            '</div>' +
          '</div>';
        }).join('')
      : '<div style="font-size:12px;opacity:0.5;text-align:center;padding:20px;">No profiles found.</div>';

    cd.innerHTML =
      '<div class="h"><span class="t">Wayfinder \u2014 Instagram ' + listTitleText + '</span><button class="btn cb" id="cl">Close</button></div>' +
      '<div class="g">' +
        (ownerAvatar ? '<img class="o-av" src="' + ownerAvatar + '" onerror="this.style.display=\'none\'">' : '<div class="o-av" style="display:flex;align-items:center;justify-content:center;background:#e1306c;color:#fff;font-weight:bold;font-size:18px;">' + ownerUsername[0] + '</div>') +
        '<div>' +
          '<div style="font-size:14px;font-weight:bold;color:#fff;margin-bottom:2px;">' + ownerDisplayName + '</div>' +
          '<div class="l" style="font-size:9px;">ig_' + ownerUsername + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="sl">Parsed ' + listTitleText + ' (' + friendsList.length + ' visible)</div>' +
      '<div class="flist">' + friendsHtml + '</div>' +
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
    alert('Wayfinder Error: ' + e.message);
  }
})();
