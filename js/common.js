/**
 * Wayfinder Tools - Common Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initLogoFallback();
  initCardInteractions();
  initExternalLinks();
});

/**
 * Handles logo image loading errors by swapping to a fallback.
 */
function initLogoFallback() {
  const img = document.querySelector('.logo');
  if (!img) return;
  
  // If the image is already broken (cached error)
  if (img.naturalWidth === 0) {
    // try binding error event just in case, or swap immediately if we can detect it
  }

  img.addEventListener('error', () => {
    if (img.dataset.swapped) return;
    img.dataset.swapped = 'true';
    img.src = 'https://i.imgur.com/q3oovaN.png'; // Fallback URL
  }, { once: true });
}

/**
 * Adds click handlers to cards to make the whole card clickable,
 * while ignoring clicks on buttons/links inside.
 */
function initCardInteractions() {
  const cards = document.querySelectorAll('.card[data-href]');
  
  cards.forEach(card => {
    // Check for missing tools (HEAD request)
    const href = card.dataset.href;
    const badge = card.querySelector('.badge');
    
    if (href && badge) {
      fetch(href, { method: 'HEAD' })
        .then(r => {
          if (!r.ok) badge.classList.add('missing');
          else badge.style.display = 'none';
        })
        .catch(() => badge.classList.add('missing'));
    }

    // Card click
    card.addEventListener('click', (e) => {
      // Ignore if clicking a button or link
      if (e.target.closest('a, button, .btn')) return;
      
      const url = card.dataset.href;
      if (url) window.location.href = url;
    });
  });
}

/**
 * Security: Open external links in new tabs with noopener/noreferrer
 */
function initExternalLinks() {
  const links = document.querySelectorAll('a[href^="http"]');
  links.forEach(link => {
    if (link.hostname !== window.location.hostname) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * Copy text to clipboard with a toast notification
 * @param {string} text - Text to copy
 * @param {HTMLElement} [triggerElement] - Element to show success state on
 */
async function copyToClipboard(text, triggerElement) {
  try {
    await navigator.clipboard.writeText(text);
    if (triggerElement) {
      const originalText = triggerElement.textContent;
      triggerElement.textContent = 'Copied!';
      triggerElement.classList.add('success');
      setTimeout(() => {
        triggerElement.textContent = originalText;
        triggerElement.classList.remove('success');
      }, 1500);
    }
  } catch (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  }
}
