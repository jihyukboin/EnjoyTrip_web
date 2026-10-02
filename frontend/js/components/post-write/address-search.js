// 시작점·도착점은 Kakao 우편번호 서비스에서 고른 주소만 입력란에 채운다
// https://postcode.map.kakao.com/guide — post-write.html에서 postcode.v2.js를 불러온다
const LABELS = { origin: '시작점', destination: '도착점' };

// 사용자가 고른 주소 종류(R: 도로명, J: 지번)를 따른다
const selectedAddress = data =>
  (data.userSelectedType === 'J' ? data.jibunAddress : data.roadAddress) || data.address;

function openSearch(field) {
  if (!globalThis.kakao?.Postcode) {
    const error = document.getElementById(`${field.id}-error`);
    if (error) error.textContent = '주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    return;
  }
  new kakao.Postcode({
    oncomplete(data) {
      field.value = selectedAddress(data);
      // 오류 문구를 지우도록 입력 이벤트를 알린다
      field.dispatchEvent(new Event('input', { bubbles: true }));
    },
    onclose: () => field.focus()
  }).open({ popupTitle: `${LABELS[field.name]} 주소 검색`, popupKey: `enjoytrip-${field.name}` });
}

// 입력란을 누르거나 키보드로 Enter를 누르면 주소 검색 창을 연다
export function bindAddressSearch(form) {
  form.addEventListener('click', event => {
    const field = event.target.closest('input[data-address-search]');
    if (field) openSearch(field);
  });
  form.addEventListener('keydown', event => {
    const field = event.target.closest('input[data-address-search]');
    if (!field || event.key !== 'Enter') return;
    // Enter로 폼이 제출되지 않게 막는다
    event.preventDefault();
    openSearch(field);
  });
}

// 읽기 전용 입력란은 브라우저 검증에서 빠지므로 제출 전에 직접 확인한다
export function checkAddresses(values) {
  for (const [name, label] of Object.entries(LABELS)) {
    if (!values[name]?.trim()) {
      throw Object.assign(new Error(`주소 검색으로 ${label}을 선택해주세요.`), { field: name });
    }
  }
}
