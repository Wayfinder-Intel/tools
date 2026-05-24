/**
 * Wayfinder Connect — Facebook Friends Ingester
 * Version: 1.1
 * Date: 2026-05-22
 *
 * USAGE:
 *   Create a new bookmark in Chrome. Set the URL to the contents of
 *   facebook-friends-v1.1.min.js (the single-line minified version).
 *   Navigate to any Facebook Friends list page (e.g. facebook.com/profile/friends)
 *   and click the bookmark.
 *
 * WHAT IT CAPTURES:
 *   - Profile Owner (Name, ID, Vanity, Avatar)
 *   - Top Friends list loaded in viewport (Name, Avatar, URL, Mutual Friends, description/location, rank order)
 *
 * JSON OUTPUT SHAPE:
 *   {
 *     type: "friends_list",
 *     platform: "facebook",
 *     owner: {
 *       id: "fb_12345",
 *       name: "Don Mackay",
 *       url: "https://www.facebook.com/don.mackay",
 *       avatar: "https://..."
 *     },
 *     friends: [
 *       {
 *         id: "fb_61585093925193",
 *         name: "Lee Lee",
 *         url: "https://www.facebook.com/profile.php?id=61585093925193",
 *         avatar: "https://...",
 *         description: "Works at ...",
 *         friendRank: 1,
 *         mutualCount: 3,
 *         isPage: false
 *       }
 *     ]
 *   }
 */
(function () {
  try {
    // ── URL NORMALIZER ────────────────────────────────────────────────────────
    function normalizeUrl(u) {
      if (!u) return '';
      var clean = u.split('#')[0]; // Remove hash
      if (clean.indexOf('profile.php') !== -1) {
        var m = clean.match(/profile\.php\?id=\d+/);
        return m ? m[0] : clean;
      }
      return clean.split('?')[0]; // Remove query params for vanity URLs
    }

    function extractSlug(u) {
      if (!u) return '';
      var clean = normalizeUrl(u);
      var vanityMatch = clean.match(/facebook\.com\/([a-zA-Z0-9._-]+)/);
      if (vanityMatch) {
        var slug = vanityMatch[1];
        if (!['profile.php', 'home', 'groups', 'pages', 'events', 'marketplace', 'watch', 'gaming', 'friends'].includes(slug)) {
          return slug;
        }
      }
      return '';
    }

    // ── OWNER DETECTION ───────────────────────────────────────────────────────
    var ownerName = '';

    // Try DOM first (robust method from profile bookmarklet)
    var h1 = Array.from(document.querySelectorAll('h1.html-h1')).find(function (e) {
      return e.querySelector('[role="button"]');
    });
    if (!h1) {
      var fl = document.querySelector('a[href*="friends_all"]');
      if (fl) {
        var sc = fl;
        for (var i = 0; i < 15; i++) {
          sc = sc.parentElement;
          if (!sc) break;
          var f = sc.querySelector('h1.html-h1');
          if (f) { h1 = f; break; }
        }
      }
    }
    if (h1) {
      var nb = h1.querySelector('[role="button"]');
      if (nb) {
        var ns = nb.childNodes;
        for (var i = 0; i < ns.length; i++) {
          if (ns[i].nodeType === 3 && ns[i].textContent.trim()) {
            ownerName = ns[i].textContent.trim();
            break;
          }
        }
      }
      if (!ownerName) {
        ownerName = h1.innerText.replace(/\xa0/g, ' ').trim().split('\n')[0].trim();
      }
    }

    // Fallback to title if DOM extraction failed
    if (!ownerName || ownerName.toLowerCase() === 'facebook') {
      var title = document.title || '';
      if (title) {
        ownerName = title.split(/[|•-]/)[0].trim();
      }
    }

    // Clean up any unread notification badges (e.g. "(1) ") from the name
    if (ownerName) {
      ownerName = ownerName.replace(/^\(\d+\+?\)\s*/, '');
    }
    if (!ownerName) ownerName = 'Unknown Owner';

    var ownerUrl = location.href.split(/[?#]/)[0].replace(/\/friends(_all|_mutual)?$/, '').replace(/\/$/, '');
    var ownerId = '';
    var numMatch = location.href.match(/profile\.php\?id=(\d+)/);
    if (numMatch) {
      ownerId = 'fb_' + numMatch[1];
      ownerUrl = 'https://www.facebook.com/profile.php?id=' + numMatch[1];
    } else {
      var slug = extractSlug(location.href);
      if (slug) {
        ownerId = 'fb_' + slug;
        ownerUrl = 'https://www.facebook.com/' + slug;
      }
    }
    if (!ownerId) {
      var nm = (document.documentElement.innerHTML.match(/"userID":"(\d{5,20})"/) || [])[1];
      if (nm) {
        ownerId = 'fb_' + nm;
        ownerUrl = 'https://www.facebook.com/profile.php?id=' + nm;
      } else {
        ownerId = 'fb_unknown_owner';
        ownerUrl = location.href;
      }
    }

    var ownerAvatar = '';
    var psvg = Array.from(document.querySelectorAll('svg[aria-label]')).find(function (s) {
      return s.getAttribute('aria-label') === ownerName;
    });
    if (psvg) {
      var pi = psvg.querySelector('image');
      if (pi) ownerAvatar = pi.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || pi.getAttribute('href') || '';
    }
    if (!ownerAvatar) {
      var img = document.querySelector('img[alt="' + ownerName + '"]') || document.querySelector('img[aria-label="' + ownerName + '"]');
      if (img) ownerAvatar = img.src;
    }

    // ── FRIENDS LIST PARSING ──────────────────────────────────────────────────
    var friendsList = [];
    var seenIds = new Set();
    
    // Find all images of width or height 80 (standard avatar size in Facebook list view)
    var imgs = Array.from(document.querySelectorAll('img')).filter(function (i) {
      return i.getAttribute('width') === '80' || i.getAttribute('height') === '80';
    });

    var rankIndex = 1;
    imgs.forEach(function (img) {
      var aLink = img.parentElement;
      while (aLink && aLink.tagName !== 'A') {
        aLink = aLink.parentElement;
      }
      if (!aLink) return;
      var href = aLink.href;
      if (!href) return;
      
      var normHref = normalizeUrl(href);
      
      // Determine the card container and find the sibling text anchor with the name
      var card = img.parentElement;
      while (card && card.tagName !== 'DIV') {
        card = card.parentElement;
      }
      
      var parent = card;
      var nameAnchor = null;
      while (parent && parent.tagName !== 'BODY') {
        var anchors = Array.from(parent.querySelectorAll('a'));
        nameAnchor = anchors.find(function (a) {
          return normalizeUrl(a.href) === normHref && a.innerText && a.innerText.trim();
        });
        if (nameAnchor) {
          card = parent;
          break;
        }
        parent = parent.parentElement;
      }

      if (!nameAnchor || !card) return;

      var name = nameAnchor.innerText.trim();
      
      // Extract friendId
      var friendId = '';
      var numericMatch = href.match(/profile\.php\?id=(\d+)/);
      if (numericMatch) {
        friendId = 'fb_' + numericMatch[1];
      } else {
        var slug = extractSlug(href);
        if (slug) {
          friendId = 'fb_' + slug;
        }
      }
      if (!friendId) {
        friendId = 'fb_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
      }

      if (seenIds.has(friendId)) return;
      seenIds.add(friendId);

      // Mutual Count
      var mutualCount = null;
      var mutualMatch = card.innerText.match(/(\d+)\s+mutual/i);
      if (mutualMatch) {
        mutualCount = parseInt(mutualMatch[1], 10);
      }

      // Description/Subtext (lives in, works at, etc.)
      var nameIdx = card.innerText.indexOf(name);
      var description = '';
      if (nameIdx !== -1) {
        var afterText = card.innerText.substring(nameIdx + name.length).trim();
        var lines = afterText.split('\n')
          .map(function (l) { return l.trim(); })
          .filter(function (l) {
            return l && !/add friend|message|remove friend|friends|mutual/i.test(l);
          });
        description = lines.join(' - ');
      }

      // Classify page vs profile
      var isPage = true;

      // 1. If we are on a tab that only lists friends (not followers/following), all items are profiles
      var path = window.location.pathname;
      var isFriendsTab = /\/friends(_all|_mutual|_with)?\/?$/.test(path) || window.location.search.indexOf('tab=friends') > -1;
      if (isFriendsTab) {
        isPage = false;
      } else {
        // 2. Try to inspect React internal properties for hovercard information
        var foundHoverType = null;
        try {
          var el = nameAnchor || aLink;
          var depthLimit = 5;
          while (el && el !== document.body && depthLimit > 0) {
            var keys = Object.keys(el);
            var reactKey = keys.find(function (k) {
              return k.startsWith('__reactProps') || k.startsWith('__reactFiber');
            });
            if (reactKey) {
              var val = el[reactKey];
              var seen = new Set();
              
              var search = function (o, d) {
                if (d > 4 || !o || seen.has(o)) return null;
                seen.add(o);
                
                var oKeys = Object.keys(o);
                for (var i = 0; i < oKeys.length; i++) {
                  var k = oKeys[i];
                  if (k === 'stateNode' || k === 'return' || k === 'child' || k === 'sibling' || k === 'alternate') {
                    continue;
                  }
                  var propVal = o[k];
                  if (typeof propVal === 'string') {
                    if (propVal.indexOf('hovercard') !== -1 || propVal.indexOf('user.php') !== -1 || propVal.indexOf('page.php') !== -1) {
                      return propVal;
                    }
                  } else if (propVal && typeof propVal === 'object') {
                    var res = search(propVal, d + 1);
                    if (res) return res;
                  }
                }
                return null;
              };

              var hovercardStr = search(val, 0);
              if (hovercardStr) {
                if (hovercardStr.indexOf('user.php') !== -1 || hovercardStr.indexOf('user') !== -1) {
                  foundHoverType = 'user';
                  break;
                } else if (hovercardStr.indexOf('page.php') !== -1 || hovercardStr.indexOf('page') !== -1) {
                  foundHoverType = 'page';
                  break;
                }
              }
            }
            el = el.parentElement;
            depthLimit--;
          }
        } catch (e) {
          console.warn('Wayfinder: React props search error:', e);
        }

        if (foundHoverType === 'user') {
          isPage = false;
        } else if (foundHoverType === 'page') {
          isPage = true;
        } else {
          // Fallback to DOM button / text checks
          if (card.querySelector('[aria-label*="Add Friend" i]') || card.querySelector('[aria-label*="Message" i]') || mutualCount !== null) {
            isPage = false;
          }
          if (/add friend|message|remove friend|friends/i.test(card.innerText)) {
            isPage = false;
          }
        }
      }

      friendsList.push({
        id: friendId,
        name: name,
        url: normHref,
        avatar: img.src || '',
        description: description,
        friendRank: rankIndex++,
        mutualCount: mutualCount,
        isPage: isPage
      });
    });

    // ── BUILD PAYLOAD ─────────────────────────────────────────────────────────
    var payload = {
      type: "friends_list",
      platform: "facebook",
      owner: {
        id: ownerId,
        name: ownerName,
        url: ownerUrl,
        avatar: ownerAvatar || ''
      },
      friends: friendsList
    };

    var pl = JSON.stringify(payload, null, 2);

    // ── UI PANEL ──────────────────────────────────────────────────────────────
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.35)';
    var sh = host.attachShadow({ mode: 'open' });

    var se = document.createElement('style');
    se.textContent = [
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}',
      '.c{margin:5vh auto;background:rgba(17,17,17,0.95);color:#eee;width:480px;border:1px solid #333;border-radius:12px;padding:20px;box-shadow:0 20px 40px rgba(0,0,0,0.8);backdrop-filter:blur(10px);display:flex;flex-direction:column;max-height:90vh}',
      '.h{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #222;padding-bottom:10px}',
      '.t{font-size:14px;font-weight:700;color:#2ea8ff}',
      '.btn{border:0;border-radius:6px;cursor:pointer;padding:6px 14px;font-size:12px;font-weight:600;transition:all 0.2s ease}',
      '.cb{background:#333;color:#eee}',
      '.cb:hover{background:#444}',
      '.cpb{background:#2d6cdf;color:#fff;padding:8px 18px}',
      '.cpb:hover{background:#3b7ced}',
      '.g{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12px;margin-bottom:10px;background:#161616;padding:10px;border-radius:8px;border:1px solid #222;align-items:center}',
      '.l{opacity:.55;text-transform:uppercase;font-size:10px;letter-spacing:.05em}',
      '.v{word-break:break-all;font-family:monospace}',
      '.av{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #333}',
      '.o-av{width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #2ea8ff}',
      '.sl{font-size:11px;opacity:.55;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px;font-weight:600}',
      '.flist{display:flex;flex-direction:column;gap:8px;overflow-y:auto;max-height:220px;margin-bottom:14px;padding-right:4px}',
      '.fcard{display:flex;align-items:center;gap:10px;background:#181818;border:1px solid #2a2a2a;padding:8px;border-radius:8px}',
      '.finfo{display:flex;flex-direction:column;flex-grow:1;min-width:0}',
      '.fname{font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.fdesc{font-size:10px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.fbadge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;text-transform:uppercase;letter-spacing:0.02em}',
      '.fbadge-rank{background:#1e3a8a;color:#93c5fd}',
      '.fbadge-page{background:#581c87;color:#d8b4fe}',
      '.sep{border:none;border-top:1px solid #222;margin:12px 0}',
      '.ta{width:100%;height:100px;resize:none;background:#0a0a0a;color:#888;border:1px solid #222;border-radius:6px;padding:8px;font:10px/1.4 monospace}',
      '.row{display:flex;gap:10px;margin-top:12px;align-items:center}',
      '.ok{color:#22c55e;font-size:12px;font-weight:600}'
    ].join('');
    sh.appendChild(se);

    var cd = document.createElement('div');
    cd.className = 'c';

    var friendsHtml = friendsList.length
      ? friendsList.map(function (f) {
          var badgeClass = f.isPage ? 'fbadge-page' : 'fbadge-rank';
          var badgeText = f.isPage ? 'Page' : 'Rank ' + f.friendRank;
          var descParts = [];
          if (f.mutualCount) descParts.push(f.mutualCount + ' mutual friends');
          if (f.description) descParts.push(f.description);
          var descText = descParts.join(' - ') || f.url;

          return '<div class="fcard">' +
            '<img class="av" src="' + f.avatar + '" onerror="this.style.display=\'none\'">' +
            '<div class="finfo">' +
              '<div class="fname">' + f.name + '</div>' +
              '<div class="fdesc" title="' + descText + '">' + descText + '</div>' +
            '</div>' +
            '<span class="fbadge ' + badgeClass + '">' + badgeText + '</span>' +
          '</div>';
        }).join('')
      : '<div style="font-size:12px;opacity:0.5;text-align:center;padding:20px;">No visible friends found. Try scrolling the friends list section to load them first!</div>';

    cd.innerHTML =
      '<div class="h"><span class="t">Wayfinder Connect \u2014 Facebook Friends Ingester v1.1</span><button class="btn cb" id="cl">Close</button></div>' +
      '<div class="g">' +
        (ownerAvatar ? '<img class="o-av" src="' + ownerAvatar + '" onerror="this.style.display=\'none\'">' : '<div class="o-av" style="display:flex;align-items:center;justify-content:center;background:#2ea8ff;color:#fff;font-weight:bold;font-size:18px;">' + ownerName[0] + '</div>') +
        '<div>' +
          '<div style="font-size:14px;font-weight:bold;color:#fff;margin-bottom:2px;">' + ownerName + '</div>' +
          '<div class="l" style="font-size:9px;">' + ownerId + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="sl">Parsed Friends (' + friendsList.length + ' visible)</div>' +
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
    alert('Wayfinder: ' + e.message);
  }
})();
