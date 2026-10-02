export function readSearch() {
  const params = new URLSearchParams(location.search);
  return { field: params.get('field') ?? 'title', q: (params.get('q') ?? '').trim() };
}

export function bindSearch(section) {
  const form = section.querySelector('[data-list-search]');
  const sync = () => {
    const { field, q } = readSearch();
    form.elements.field.value = field;
    form.elements.q.value = q;
  };
  sync();
  form.addEventListener('submit', event => {
    event.preventDefault();
    const params = new URLSearchParams({ field: form.elements.field.value, q: form.elements.q.value.trim() });
    location.assign(`${location.pathname}?${params}`);
  });
  return sync;
}
