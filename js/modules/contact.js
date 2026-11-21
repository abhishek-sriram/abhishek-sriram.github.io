function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopy(text);
}

export function initContact() {
  const year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const copyBtn = document.querySelector('.contact-copy');
  const live = document.getElementById('copyStatus');
  if (!copyBtn) return;

  const email =
    copyBtn.getAttribute('data-copy-email') || 'abhisriram15@gmail.com';
  const idleLabel = copyBtn.textContent.trim() || 'Copy';
  let revertTimer = 0;

  copyBtn.addEventListener('click', async () => {
    try {
      await copyText(email);
      copyBtn.textContent = 'Copied';
      if (live) live.textContent = 'Copied';
      window.clearTimeout(revertTimer);
      revertTimer = window.setTimeout(() => {
        copyBtn.textContent = idleLabel;
        if (live) live.textContent = '';
      }, 2000);
    } catch (err) {
      if (live) live.textContent = 'Copy failed';
    }
  });
}
