const REDUCE = '(prefers-reduced-motion: reduce)';

function reduced() {
  return window.matchMedia(REDUCE).matches;
}

function panelOf(details) {
  return details.querySelector('.case-earlier-panel');
}

function revealNested(details) {
  details.querySelectorAll('.fx-reveal').forEach((el) => el.classList.add('is-in'));
}

function openDetails(details, panel) {
  details.classList.remove('is-closing');
  details.open = true;
  details.classList.add('is-open');
  revealNested(details);
  if (reduced()) {
    panel.style.gridTemplateRows = '1fr';
    return;
  }
  panel.style.gridTemplateRows = '0fr';
  void panel.offsetHeight;
  panel.style.gridTemplateRows = '1fr';
}

function closeDetails(details, panel) {
  details.classList.remove('is-open');
  details.classList.add('is-closing');

  if (reduced()) {
    panel.style.gridTemplateRows = '0fr';
    details.classList.remove('is-closing');
    details.open = false;
    return;
  }

  panel.style.gridTemplateRows = '0fr';

  const finish = (event) => {
    if (event && event.target !== panel) return;
    if (event && event.propertyName && event.propertyName !== 'grid-template-rows') return;
    panel.removeEventListener('transitionend', finish);
    details.classList.remove('is-closing');
    details.open = false;
    panel.style.gridTemplateRows = '';
  };

  panel.addEventListener('transitionend', finish);
  window.setTimeout(() => {
    if (!details.classList.contains('is-closing')) return;
    panel.removeEventListener('transitionend', finish);
    details.classList.remove('is-closing');
    details.open = false;
    panel.style.gridTemplateRows = '';
  }, 400);
}

function wireEarlier(details) {
  const summary = details.querySelector('summary');
  const panel = panelOf(details);
  if (!summary || !panel) return;

  if (details.open) {
    details.classList.add('is-open');
    panel.style.gridTemplateRows = '1fr';
  }

  summary.addEventListener('click', (event) => {
    event.preventDefault();
    if (details.classList.contains('is-open') || details.open) {
      closeDetails(details, panel);
    } else {
      openDetails(details, panel);
    }
  });
}

export function initProjects() {
  document.querySelectorAll('details.case-earlier').forEach(wireEarlier);
}
