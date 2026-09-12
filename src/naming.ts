/**
 * 출력 파일명을 정한다.
 *
 * 파일명은 **묻지 않고 추론한다** (@tool-ux-principles §1). 첫 입력 파일에서 끌어오고,
 * 사용자는 바꾸고 싶을 때만 건드린다.
 */

/** 파일명에서 확장자를 뗀다. 확장자가 없거나 점으로 시작하면 그대로 둔다. */
export function stripExtension(fileName: string): string {
	const dot = fileName.lastIndexOf('.');
	return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * 파일 시스템이 거부하는 문자를 지운다.
 *
 * 윈도·맥·리눅스가 각각 금지하는 문자의 합집합을 쓴다 — 내려받은 파일이 어느
 * 기기로 옮겨갈지 알 수 없다.
 */
export function sanitize(name: string): string {
	const cleaned = name
		// 제어문자와 윈도가 금지하는 아홉 글자. 소스에 제어문자를 그대로 적지 않는다.
		.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		// 윈도는 이름 끝의 점과 공백을 조용히 잘라낸다.
		.replace(/[. ]+$/, '');
	return cleaned === '' ? '문서' : cleaned;
}

/**
 * 여러 입력에서 기본 출력 이름을 고른다.
 *
 * @param fileNames 사용자가 떨어뜨린 순서 그대로.
 * @returns 첫 파일 이름(확장자 제외). 입력이 없으면 `'문서'`.
 */
export function baseNameFrom(fileNames: readonly string[]): string {
	if (fileNames.length === 0) return '문서';
	return sanitize(stripExtension(fileNames[0]));
}

/**
 * 분할 출력의 한 장짜리 파일명.
 *
 * 번호는 전체 장수의 자릿수에 맞춰 0을 채운다 — 그래야 파일 탐색기의 사전순
 * 정렬이 페이지 순서와 같아진다. 채우지 않으면 `10` 이 `2` 앞에 온다.
 *
 * @param base 확장자 없는 기본 이름.
 * @param index 0-기반 페이지 번호.
 * @param total 전체 장수.
 * @param extension 점 없는 확장자.
 */
export function pageFileName(
	base: string,
	index: number,
	total: number,
	extension: string
): string {
	const width = String(total).length;
	return `${base}_${String(index + 1).padStart(width, '0')}.${extension}`;
}

/**
 * 사람이 기대하는 순서로 정렬한다 — `2` 가 `10` 앞에 온다.
 *
 * 사전순은 `10.png` 를 `2.png` 앞에 놓는다. 스캔 파일이나 슬라이드 캡처처럼
 * 번호가 붙은 입력에서 이게 곧바로 순서 오류가 된다.
 */
export function naturalCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
