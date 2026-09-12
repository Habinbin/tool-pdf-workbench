/**
 * 지금 진행 중인 드래그가 이 문서 안에서 시작됐는지.
 *
 * 카드를 끌어 순서를 바꾸는 중에도 브라우저는 `dataTransfer.types` 에 `Files` 를
 * 담는다 — 카드 안에 이미지가 있으면 그 이미지를 파일로 꺼낼 수 있기 때문이다.
 * 그래서 types 만 보고 "파일 드롭"이라 판단하면, 순서를 바꾸는 내내 업로드 안내가
 * 떴다 사라졌다 한다.
 *
 * 대신 드래그가 **어디서 시작됐는지**로 가른다. OS 에서 끌어온 파일은 이 문서에서
 * `dragstart` 가 나지 않는다.
 */

let internal = $state(false);

if (typeof document !== 'undefined') {
	// 캡처 단계로 듣는다 — 중간에서 전파를 멈추는 핸들러가 있어도 놓치지 않게.
	document.addEventListener('dragstart', () => (internal = true), true);
	document.addEventListener('dragend', () => (internal = false), true);
	document.addEventListener('drop', () => (internal = false), true);
}

/** 문서 안에서 시작된 드래그면 true. */
export function isInternalDrag(): boolean {
	return internal;
}

/**
 * 이 드래그를 파일 드롭으로 받아야 하는지.
 *
 * @param event 드래그 이벤트.
 * @returns OS 에서 끌어온 파일이면 true.
 */
export function isFileDrag(event: DragEvent): boolean {
	return !internal && (event.dataTransfer?.types.includes('Files') ?? false);
}
