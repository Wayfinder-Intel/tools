/**
 * Wayfinder — TikTok Friends Ingester
 * Version: 1.0
 * Date: 2026-05-24
 *
 * USAGE:
 *   Create a new bookmark in Chrome. Set the URL to the contents of
 *   tiktok-friends-v1.0.min.js.
 *   Navigate to a TikTok profile page, click on "Following" or "Followers"
 *   to open the pop-up modal dialog, and click the bookmark.
 *
 * WHAT IT CAPTURES:
 *   - Profile Owner (Username, Name, Avatar)
 *   - Followers/Following list loaded in modal (Username, Name, URL, Avatar)
 *
 * JSON OUTPUT SHAPE:
 *   {
 *     type: "friends_list",
 *     platform: "tiktok",
 *     owner: {
 *       id: "owner_username",
 *       name: "Display Name",
 *       url: "https://www.tiktok.com/@owner_username",
 *       avatar: "https://..."
 *     },
 *     following: [  // Or "followers" if parsing a follower list modal
 *       {
 *         id: "followed_user",
 *         name: "Followed Name",
 *         url: "https://www.tiktok.com/@followed_user",
 *         avatar: "https://...",
 *         isPage: false
 *       }
 *     ]
 *   }
 */
(function () {
  try {
    function parseTikTokCount(str) {
      if (!str) return 0;
      str = str.trim().toUpperCase().replace(/,/g, '');
      var match = str.match(/^([\d.]+)\s*([KMB])?$/);
      if (!match) {
        var val = parseInt(str, 10);
        return isNaN(val) ? 0 : val;
      }
      var num = parseFloat(match[1]);
      var suffix = match[2];
      if (suffix === 'K') num *= 1000;
      if (suffix === 'M') num *= 1000000;
      if (suffix === 'B') num *= 1000000000;
      return Math.round(num);
    }

    var ownerUsername = '';
    var ownerDisplayName = '';
    var ownerAvatar = '';

    var h2 = document.querySelector('[data-e2e="user-subtitle"]');
    if (h2) {
      ownerUsername = h2.innerText.replace(/^@/, '').trim();
    }
    if (!ownerUsername) {
      var pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && pathParts[0].indexOf('@') === 0) {
        ownerUsername = pathParts[0].substring(1);
      }
    }
    if (!ownerUsername || ['explore', 'reels', 'direct', 'developer'].indexOf(ownerUsername.toLowerCase()) !== -1) {
      ownerUsername = 'tiktok_user';
    }
    if (ownerUsername === 'tiktok_user') {
      var modalHeader = document.querySelector('[class*="DivHeaderContainer"] h1') || 
                        document.querySelector('[data-e2e="follow-info-popup"] h1');
      if (modalHeader) {
        var headerTxt = modalHeader.innerText.replace(/^@/, '').trim();
        if (headerTxt) {
          ownerUsername = headerTxt;
        }
      }
    }

    var nameEl = document.querySelector('[data-e2e="user-title"]');
    if (nameEl) {
      ownerDisplayName = nameEl.innerText.trim();
    }
    if (!ownerDisplayName) {
      ownerDisplayName = ownerUsername;
    }

    var avatarEl = document.querySelector('[data-e2e="user-avatar"]');
    if (avatarEl) {
      var img = avatarEl.tagName === 'IMG' ? avatarEl : avatarEl.querySelector('img');
      if (img) {
        ownerAvatar = img.src || img.getAttribute('src') || '';
      }
    }
    if (!ownerAvatar) {
      var fallbackImg = document.querySelector('img[class*="ImgAvatar"]');
      if (fallbackImg) ownerAvatar = fallbackImg.src;
    }

    // ── DETECT CONTAINER & LIST TYPE (FOLLOWERS VS FOLLOWING) ──────────────────
    var container = document.querySelector('[data-e2e="follow-info-popup"]') || 
                    document.querySelector('[class*="DivUserListContainer"]') || 
                    document.body;

    var listType = 'following'; // default
    if (location.pathname.indexOf('/followers') !== -1) {
      listType = 'followers';
    } else if (location.pathname.indexOf('/following') !== -1) {
      listType = 'following';
    } else {
      var tabs = container.querySelectorAll('[class*="DivTabItem"]');
      var detectedActiveText = '';
      if (tabs.length >= 2) {
        var classCount = {};
        var classList = [];
        for (var i = 0; i < tabs.length; i++) {
          var cls = '';
          var parts = tabs[i].className.split(' ');
          for (var j = 0; j < parts.length; j++) {
            if (parts[j].indexOf('DivTabItem') !== -1) {
              cls = parts[j];
              break;
            }
          }
          classList.push(cls);
          if (cls) {
            classCount[cls] = (classCount[cls] || 0) + 1;
          }
        }
        var activeClass = '';
        for (var key in classCount) {
          if (classCount[key] === 1) {
            activeClass = key;
            break;
          }
        }
        if (activeClass) {
          for (var i = 0; i < tabs.length; i++) {
            if (classList[i] === activeClass) {
              detectedActiveText = tabs[i].innerText.toLowerCase();
              break;
            }
          }
        }
      }
      
      if (detectedActiveText) {
        if (detectedActiveText.indexOf('followers') !== -1) {
          listType = 'followers';
        } else if (detectedActiveText.indexOf('following') !== -1) {
          listType = 'following';
        }
      } else {
        var textStr = container.innerText.substring(0, 1500).toLowerCase();
        if (textStr.indexOf('followers') !== -1) {
          listType = 'followers';
        } else if (textStr.indexOf('following') !== -1) {
          listType = 'following';
        }
      }
    }

    var totalCount = 0;
    if (container) {
      var tabs = container.querySelectorAll('[class*="DivTabItem"]');
      for (var i = 0; i < tabs.length; i++) {
        var tabText = tabs[i].innerText || '';
        if (tabText.toLowerCase().indexOf(listType) !== -1) {
          var strongEl = tabs[i].querySelector('strong');
          var countStr = '';
          if (strongEl) {
            countStr = strongEl.getAttribute('title') || strongEl.innerText;
          }
          if (!countStr) {
            var numMatch = tabText.match(/[\d.,]+\s*[KMB]?/i);
            if (numMatch) {
              countStr = numMatch[0];
            }
          }
          if (countStr) {
            totalCount = parseTikTokCount(countStr);
          }
          break;
        }
      }
    }
    if (!totalCount) {
      var pageCountEl = document.querySelector('[data-e2e="' + listType + '-count"]');
      if (pageCountEl) {
        totalCount = parseTikTokCount(pageCountEl.innerText || '');
      }
    }

    // ── PARSE VISIBLE LIST ROW DATA ───────────────────────────────────────────
    var friendsList = [];
    var seenHandles = new Set();

    // Find all profile links inside our list container
    var allLinks = Array.from(container.querySelectorAll('a'));
    allLinks.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var match = href.match(/(?:tiktok\.com)?\/@([a-zA-Z0-9._-]+)/);
      if (!match) return;
      var handle = match[1];
      var lowerHandle = handle.toLowerCase();

      if (lowerHandle === ownerUsername.toLowerCase()) return;
      if (seenHandles.has(lowerHandle)) return;

      var row = link;
      var img = link.querySelector('img');
      if (!img) {
        row = link.parentElement;
        for (var depth = 0; depth < 8; depth++) {
          if (!row || row === container) break;
          var imgs = row.querySelectorAll('img');
          if (imgs.length > 0) {
            img = imgs[0];
            break;
          }
          row = row.parentElement;
        }
      }

      if (!img || !row) return;

      // Climb up to get the entire row container for text filtering
      var rowContainer = link;
      for (var d = 0; d < 5; d++) {
        if (!rowContainer.parentElement || rowContainer.parentElement === container || rowContainer.parentElement === document.body) {
          break;
        }
        rowContainer = rowContainer.parentElement;
      }

      var displayName = '';
      var nicknameEl = row.querySelector('[class*="Nickname"]');
      if (nicknameEl) {
        displayName = nicknameEl.innerText.trim();
      }

      var uniqueIdEl = row.querySelector('[class*="UniqueId"]');
      if (uniqueIdEl) {
        handle = uniqueIdEl.innerText.trim().replace(/^@/, '');
      }

      if (!displayName) displayName = handle;

      // Clean up newlines if present
      if (displayName) displayName = displayName.split('\n')[0].trim();
      if (handle) handle = handle.split('\n')[0].trim().replace(/^@/, '');

      // Filter out notifications, suggested sections, comments and UI junk
      var rowText = (rowContainer.innerText || '').toLowerCase();
      if (/\b(liked your|started following|followed you|commented|mentioned|replied|shared|people you may|suggested|friend request|recommended|profile)\b/i.test(rowText)) {
        return;
      }
      if (/(?:·|\u00b7)\s*(?:\d+|yesterday|just now)/i.test(rowText)) {
        return;
      }
      if (displayName.toLowerCase() === 'profile' || displayName.toLowerCase() === 'people you may know') {
        return;
      }
      if (/^[0-9]{15,}$/.test(handle)) {
        // Discard raw numeric internal IDs (typically found in notification links/placeholders)
        return;
      }

      seenHandles.add(lowerHandle);

      friendsList.push({
        id: handle,
        name: displayName,
        url: 'https://www.tiktok.com/@' + handle,
        avatar: img.src || img.getAttribute('src') || '',
        isPage: false
      });
    });

    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.35)';
    var sh = host.attachShadow({ mode: 'open' });

    var se = document.createElement('style');
    se.textContent = [
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}',
      '.c{margin:5vh auto;background:rgba(17,17,17,0.96);color:#eee;width:480px;border:1px solid #333;border-radius:12px;padding:20px;box-shadow:0 20px 40px rgba(0,0,0,0.8);backdrop-filter:blur(10px);display:flex;flex-direction:column;max-height:90vh;border:1px solid rgba(255,255,255,0.08)}',
      '.h{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #222;padding-bottom:10px}',
      '.t{font-size:14px;font-weight:700;color:#ff0050}',
      '.btn{border:0;border-radius:6px;cursor:pointer;padding:6px 14px;font-size:12px;font-weight:600;transition:all 0.2s ease}',
      '.cb{background:#333;color:#eee}',
      '.cb:hover{background:#444}',
      '.cpb{background:linear-gradient(45deg,#00f2fe 0%,#ff0050 100%);color:#000;padding:8px 18px;font-weight:bold}',
      '.cpb:hover{opacity:.9}',
      '.g{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12px;margin-bottom:10px;background:#161616;padding:10px;border-radius:8px;border:1px solid #222;align-items:center}',
      '.l{opacity:.55;text-transform:uppercase;font-size:10px;letter-spacing:.05em}',
      '.v{word-break:break-all;font-family:monospace}',
      '.av{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #333}',
      '.o-av{width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #ff0050}',
      '.sl{font-size:11px;opacity:.55;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px;font-weight:600}',
      '.flist{display:flex;flex-direction:column;gap:8px;overflow-y:auto;max-height:220px;margin-bottom:14px;padding-right:4px}',
      '.fcard{display:flex;align-items:center;gap:10px;background:#181818;border:1px solid #2a2a2a;padding:8px;border-radius:8px}',
      '.finfo{display:flex;flex-direction:column;flex-grow:1;min-width:0}',
      '.fname{font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.fdesc{font-size:10px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.sep{border:none;border-top:1px solid #222;margin:12px 0}',
      '.ta{width:100%;height:100px;resize:none;background:#0a0a0a;color:#888;border:1px solid #222;border-radius:6px;padding:8px;font:10px/1.4 monospace}',
      '.row{display:flex;gap:10px;margin-top:12px;align-items:center}',
      '.ok{color:#22c55e;font-size:12px;font-weight:600}',
      '.ctrl-row{display:flex;gap:10px;align-items:center;margin-bottom:12px;background:#161616;padding:8px 12px;border-radius:8px;border:1px solid #222}',
      '.ctrl-select,.ctrl-input{background:#222;color:#fff;border:1px solid #333;border-radius:4px;padding:4px 8px;font-size:12px;outline:none}',
      '.ctrl-select:focus,.ctrl-input:focus{border-color:#ff0050}',
      '.ctrl-label{font-size:11px;color:#aaa;font-weight:600}',
      '.fbadge{font-size:10px;font-weight:bold;border-radius:4px;padding:2px 6px;white-space:nowrap;margin-left:auto}',
      '.fbadge-newest{color:#00f2fe;background:rgba(0,242,254,0.1);border:1px solid rgba(0,242,254,0.3)}',
      '.fbadge-oldest{color:#ff0050;background:rgba(255,0,80,0.1);border:1px solid rgba(255,0,80,0.3)}'
    ].join('');
    sh.appendChild(se);

    var cd = document.createElement('div');
    cd.className = 'c';

    var listTitleText = listType.substring(0,1).toUpperCase() + listType.substring(1);
    var defaultLimit = Math.min(20, friendsList.length);

    var detectScrollBottom = false;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      var el = container;
      while (el && el !== document.body) {
        var overflow = window.getComputedStyle(el).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
            detectScrollBottom = true;
          }
          break;
        }
        el = el.parentElement;
      }
    }
    var defaultAlignBottom = detectScrollBottom || (friendsList.length >= totalCount - 25);

    cd.innerHTML =
      '<div class="h"><span class="t">Wayfinder \u2014 TikTok ' + listTitleText + '</span><button class="btn cb" id="cl">Close</button></div>' +
      '<div class="g">' +
        (ownerAvatar ? '<img class="o-av" src="' + ownerAvatar + '" onerror="this.style.display=\'none\'">' : '<div class="o-av" style="display:flex;align-items:center;justify-content:center;background:#ff0050;color:#fff;font-weight:bold;font-size:18px;">' + ownerUsername[0] + '</div>') +
        '<div>' +
          '<div style="font-size:14px;font-weight:bold;color:#fff;margin-bottom:2px;">' + ownerDisplayName + '</div>' +
          '<div class="l" style="font-size:9px;">@' + ownerUsername + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctrl-row">' +
        '<span class="ctrl-label">Export:</span>' +
        '<select id="range-select" class="ctrl-select">' +
          '<option value="all">All Visible</option>' +
          '<option value="newest">Top N Newest (Newest)</option>' +
          '<option value="oldest">Bottom N Oldest (Oldest)</option>' +
        '</select>' +
        '<span id="limit-label" class="ctrl-label" style="display:none">Limit:</span>' +
        '<input type="number" id="limit-input" class="ctrl-input" style="display:none;width:60px" min="1" value="' + defaultLimit + '">' +
      '</div>' +
      '<div class="ctrl-row" style="margin-top:-6px;margin-bottom:12px;display:flex;align-items:center;gap:8px;padding:6px 12px;background:none;border:none">' +
        '<input type="checkbox" id="align-bottom-checkbox" style="accent-color:#ff0050;cursor:pointer;width:14px;height:14px" ' + (defaultAlignBottom ? 'checked' : '') + '>' +
        '<span id="align-bottom-label" class="ctrl-label" style="cursor:pointer;user-select:none">Treat bottom of visible list as Rank 1 (scrollbar reached end)</span>' +
      '</div>' +
      '<div class="sl" id="status-label">Parsed ' + listTitleText + ' (' + friendsList.length + ' visible, ' + totalCount + ' total)</div>' +
      '<div class="flist" id="flist"></div>' +
      '<hr class="sep">' +
      '<textarea class="ta" id="json-ta" readonly></textarea>' +
      '<div class="row"><button class="btn cpb" id="cp">Copy JSON</button><span class="ok" id="ok" style="display:none">Copied!</span></div>';

    var rangeSelect = cd.querySelector('#range-select');
    var limitInput = cd.querySelector('#limit-input');
    var limitLabel = cd.querySelector('#limit-label');
    var statusLabel = cd.querySelector('#status-label');
    var flistContainer = cd.querySelector('#flist');
    var jsonTextarea = cd.querySelector('#json-ta');
    var alignBottomCheckbox = cd.querySelector('#align-bottom-checkbox');

    function refreshUI() {
      var range = rangeSelect.value;
      var limit = parseInt(limitInput.value, 10) || 20;
      if (limit < 1) limit = 1;
      if (limit > friendsList.length) limit = friendsList.length;
      limitInput.value = limit;

      if (range === 'all') {
        limitInput.style.display = 'none';
        limitLabel.style.display = 'none';
      } else {
        limitInput.style.display = '';
        limitLabel.style.display = '';
      }

      var filtered = [];
      var alignBottom = alignBottomCheckbox.checked;
      var mapped = friendsList.map(function (f, idx) {
        var clone = {};
        for (var k in f) {
          if (f.hasOwnProperty(k)) clone[k] = f[k];
        }
        clone.friendRank = alignBottom ? (friendsList.length - idx) : (totalCount - idx);
        return clone;
      });

      if (range === 'all') {
        filtered = mapped;
      } else if (range === 'newest') {
        filtered = mapped.slice(0, limit);
      } else if (range === 'oldest') {
        filtered = mapped.slice(-limit);
      }

      statusLabel.innerText = 'Exporting ' + filtered.length + ' of ' + friendsList.length + ' visible ' + listType + ' (Total count: ' + totalCount + ')';

      var html = '';
      if (filtered.length > 0) {
        html = filtered.map(function (f) {
          var badgeClass = f.friendRank <= 20 ? 'fbadge-oldest' : 'fbadge-newest';
          return '<div class="fcard">' +
            '<img class="av" src="' + f.avatar + '" onerror="this.style.display=\'none\'">' +
            '<div class="finfo">' +
              '<div class="fname">' + f.name + '</div>' +
              '<div class="fdesc">@' + f.id + '</div>' +
            '</div>' +
            '<div class="fbadge ' + badgeClass + '">Rank ' + f.friendRank + '</div>' +
          '</div>';
        }).join('');
      } else {
        html = '<div style="font-size:12px;opacity:0.5;text-align:center;padding:20px;">No profiles selected.</div>';
      }
      flistContainer.innerHTML = html;

      var newPayload = {
        type: 'friends_list',
        platform: 'tiktok',
        owner: {
          id: ownerUsername,
          name: ownerDisplayName,
          url: 'https://www.tiktok.com/@' + ownerUsername,
          avatar: ownerAvatar || ''
        }
      };
      newPayload[listType] = filtered;
      jsonTextarea.value = JSON.stringify(newPayload, null, 2);
    }

    rangeSelect.onchange = refreshUI;
    limitInput.oninput = refreshUI;
    alignBottomCheckbox.onchange = refreshUI;
    cd.querySelector('#align-bottom-label').onclick = function () {
      alignBottomCheckbox.checked = !alignBottomCheckbox.checked;
      refreshUI();
    };

    refreshUI();

    cd.querySelector('#cl').onclick = function () { host.remove(); };
    cd.querySelector('#cp').onclick = function () {
      navigator.clipboard.writeText(jsonTextarea.value).then(function () {
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
