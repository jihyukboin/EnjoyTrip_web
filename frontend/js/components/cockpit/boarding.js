// 탑승 안내: 처음 들어오면 역할·조작법을 보여주고 1인·2인 탑승을 고른다
export function initializeBoarding(cockpit) {
  const dialog = cockpit.querySelector('[data-boarding]');
  const form = dialog.querySelector('form');
  const applyCrew = () => { cockpit.dataset.crew = form.elements.crew.value; };

  form.addEventListener('change', applyCrew);
  dialog.addEventListener('close', applyCrew);
  cockpit.querySelector('[data-boarding-open]').addEventListener('click', () => dialog.showModal());
  dialog.showModal();

  return { isOpen: () => dialog.open };
}
