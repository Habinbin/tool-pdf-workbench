/** 작업대가 다루는 값들. Svelte·DOM 에 의존하지 않는다. */

/** 사용자가 떨어뜨린 원본 파일. 바이트는 한 번만 읽어 여기 둔다. */
export interface SourceFile {
	id: string;
	name: string;
	/**
	 * 원본 바이트 그대로.
	 *
	 * 재인코딩하지 않는다 — 이미지를 페이지로 넣을 때도 원본을 그대로 삽입해야
	 * 화질이 유지되고 메모리도 한 벌만 쓴다. @client-first-processing
	 */
	bytes: ArrayBuffer;
	kind: 'pdf' | 'image';
	/** `kind === 'image'` 일 때의 MIME. PDF 면 없다. */
	imageMime?: string;
}

/** 시계방향 회전각. PDF 가 허용하는 90도 배수만 쓴다. */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * 작업대에 놓인 한 장.
 *
 * 원본을 복제하지 않고 `fileId` + `pageIndex` 로 가리킨다. 같은 페이지를 두 번
 * 넣어도 바이트가 두 벌 생기지 않는다.
 */
export interface WorkPage {
	id: string;
	fileId: string;
	/** 원본 PDF 안에서의 0-기반 페이지 번호. 이미지면 0. */
	pageIndex: number;
	/** 사용자가 **추가로** 준 회전. 원본이 이미 가진 회전에 더해진다. */
	rotation: Rotation;
}
