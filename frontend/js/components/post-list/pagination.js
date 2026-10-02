const WINDOW = 5;

// 현재 페이지를 가운데 두고 최대 5개의 번호를 고른다
export function pageNumbers(page, totalPages) {
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const end = Math.min(totalPages, start + WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function pageLink(page, label, { current = false, disabled = false, ariaLabel } = {}) {
  if (disabled) {
    const span = document.createElement('span');
    span.className = 'pagination__link';
    span.setAttribute('aria-disabled', 'true');
    span.textContent = label;
    return span;
  }
  const link = document.createElement('a');
  link.className = 'pagination__link';
  const params = new URLSearchParams(location.search);
  params.set('page', page);
  link.href = `?${params}`;
  link.dataset.page = String(page);
  link.textContent = label;
  if (ariaLabel) link.setAttribute('aria-label', ariaLabel);
  if (current) link.setAttribute('aria-current', 'page');
  return link;
}

export function renderPagination(nav, { page, totalPages }) {
  const items = [
    pageLink(page - 1, '이전', { disabled: page <= 1, ariaLabel: '이전 페이지' }),
    ...pageNumbers(page, totalPages).map(number =>
      pageLink(number, String(number), { current: number === page, ariaLabel: `${number}페이지` })),
    pageLink(page + 1, '다음', { disabled: page >= totalPages, ariaLabel: '다음 페이지' })
  ];
  nav.replaceChildren(...items);
  nav.hidden = totalPages <= 1;
}
