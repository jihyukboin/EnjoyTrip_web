// 회원 폼의 입력 검증, 오류 표시, 제출 중 상태를 처리한다
const MISMATCH_MESSAGE = '비밀번호가 일치하지 않습니다.';

export function showFieldError(field, message) {
  const error = document.getElementById(`${field.id}-error`);
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  if (error) error.textContent = message;
}

// 결과 문구를 표시한다. tone은 error 또는 success
export function showStatus(status, message, tone = 'error') {
  status.dataset.tone = tone;
  status.textContent = message;
}

const formStatus = form => form.querySelector('.form-status');

export function resetForm(form) {
  form.reset();
  for (const field of form.elements) showFieldError(field, '');
  showStatus(formStatus(form), '');
}

// data-match="필드이름"이 있는 입력은 해당 필드와 값이 같아야 한다
function validate(form) {
  let firstInvalid = null;
  for (const field of form.elements) {
    if (!field.willValidate) continue;
    if (field.dataset.match) {
      field.setCustomValidity(field.value === form.elements[field.dataset.match].value ? '' : MISMATCH_MESSAGE);
    }
    const valid = field.checkValidity();
    showFieldError(field, valid ? '' : field.validationMessage);
    firstInvalid ??= valid ? null : field;
  }
  firstInvalid?.focus();
  return !firstInvalid;
}

function showApiError(form, error) {
  const field = error.field && form.elements[error.field];
  if (!field) {
    showStatus(formStatus(form), error.message || '요청을 처리하지 못했습니다.');
    return;
  }
  showFieldError(field, error.message);
  field.focus();
}

// action은 폼 값을 객체로 받는다. 실패하면 오류를 화면에 표시한다.
export function bindForm(form, action) {
  const submit = form.querySelector('[type="submit"]');

  form.addEventListener('input', event => showFieldError(event.target, ''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    showStatus(formStatus(form), '');
    if (!validate(form)) return;

    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      await action(Object.fromEntries(new FormData(form)));
    } catch (error) {
      showApiError(form, error);
    } finally {
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}
