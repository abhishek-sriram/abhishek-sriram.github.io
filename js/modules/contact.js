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
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      /* Permission or focus can reject Clipboard API; use legacy path. */
    }
  }
  fallbackCopy(text);
}

function armBand(band) {
  if (!band) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches || !('IntersectionObserver' in window)) {
    band.classList.add('is-in');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        band.classList.add('is-in');
        io.unobserve(band);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
  );
  io.observe(band);
  const onReduce = () => {
    if (!reduce.matches) return;
    band.classList.add('is-in');
    io.disconnect();
  };
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
  else reduce.addListener(onReduce);
}

export function initContact() {
  const year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  armBand(document.getElementById('contact'));

  const copyBtn = document.querySelector('.contact-copy');
  const live = document.getElementById('copyStatus');
  const label = copyBtn?.querySelector('.contact-copy-label');
  if (!copyBtn || !label) return;

  const email =
    copyBtn.getAttribute('data-copy-email') || 'abhisriram15@gmail.com';
  const idleLabel = label.textContent.trim() || 'Copy';
  let revertTimer = 0;

  copyBtn.addEventListener('click', async () => {
    try {
      await copyText(email);
      label.textContent = 'Copied';
      copyBtn.classList.add('is-copied');
      if (live) live.textContent = 'Copied';
      window.clearTimeout(revertTimer);
      revertTimer = window.setTimeout(() => {
        label.textContent = idleLabel;
        copyBtn.classList.remove('is-copied');
        if (live) live.textContent = '';
      }, 2000);
    } catch (err) {
      if (live) live.textContent = 'Copy failed';
    }
  });
}
