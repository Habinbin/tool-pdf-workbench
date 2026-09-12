/**
 * 작업대 위 페이지 목록의 조작. 전부 순수 함수 — 원본 배열을 바꾸지 않는다.
 *
 * 재정렬을 "항목 → 항목" 이 아니라 **"항목 → 틈"** 으로 표현하는 것이 이 파일의
 * 핵심이다. 사용자에게 보이는 것이 틈에 그려진 삽입선이므로(@reorder-affordance),
 * 코드도 같은 단위로 말해야 "표시한 틈과 놓인 자리가 다르다" 는 부류의 버그가
 * 애초에 생기지 않는다. 대상 항목 기준으로 계산하면 앞/뒤 보정이 끼어들고,
 * 자기 자신을 넘어갈 때 한 칸 어긋난다.
 */

import type { Rotation, WorkPage } from './types';

/**
 * 틈의 번호. `0` 은 맨 앞, `pages.length` 는 **맨 뒤**.
 *
 * 틈이 항목보다 하나 많다는 것이 요점이다 — 마지막 틈이 없으면 맨 뒤로 옮길 수
 * 없고, 그게 드래그 재정렬에서 가장 흔한 누락이다 (@reorder-affordance #4).
 */
export type GapIndex = number;

/** 목록이 가질 수 있는 틈의 개수. 항상 항목 수 + 1. */
export function gapCount(pages: readonly WorkPage[]): number {
	return pages.length + 1;
}

/**
 * 포인터 위치로 어느 틈인지 정한다 — 항목의 앞 절반이면 앞 틈, 뒤 절반이면 뒤 틈.
 *
 * @param itemIndex 포인터가 올라가 있는 항목의 번호.
 * @param beforeHalf 포인터가 그 항목의 앞 절반에 있는가.
 * @returns 삽입선을 그릴 틈.
 */
export function gapFromPointer(itemIndex: number, beforeHalf: boolean): GapIndex {
	return beforeHalf ? itemIndex : itemIndex + 1;
}

/**
 * `from` 번째 항목을 `gap` 틈으로 옮긴다.
 *
 * 제자리에 놓으면(자기 앞 틈·뒤 틈) **같은 배열 내용**을 돌려준다
 * (@reorder-affordance #7).
 *
 * @param pages 현재 목록.
 * @param from 끌고 있는 항목의 번호.
 * @param gap 놓을 틈. `0`..`pages.length`.
 * @returns 새 배열. 범위 밖 입력이면 원본과 같은 내용을 돌려준다.
 */
export function moveToGap(pages: readonly WorkPage[], from: number, gap: GapIndex): WorkPage[] {
	const next = [...pages];
	if (from < 0 || from >= pages.length) return next;
	if (gap < 0 || gap > pages.length) return next;
	// 자기 앞 틈(from)과 자기 뒤 틈(from + 1)은 둘 다 제자리다.
	if (gap === from || gap === from + 1) return next;

	const [moved] = next.splice(from, 1);
	// 항목을 빼내면 그 뒤의 틈은 전부 한 칸 당겨진다.
	next.splice(gap > from ? gap - 1 : gap, 0, moved);
	return next;
}

/** 키보드 재정렬 — 한 칸 앞/뒤로. 끝에서는 아무 일도 없다 (@reorder-affordance #9). */
export function nudge(pages: readonly WorkPage[], index: number, delta: -1 | 1): WorkPage[] {
	const target = index + delta;
	if (target < 0 || target >= pages.length) return [...pages];
	// 한 칸 뒤로 갈 때는 대상의 **뒤** 틈이 목적지다.
	return moveToGap(pages, index, delta === 1 ? target + 1 : target);
}

/** 지정한 id 들을 뺀 목록. */
export function removePages(pages: readonly WorkPage[], ids: ReadonlySet<string>): WorkPage[] {
	return pages.filter((page) => !ids.has(page.id));
}

/** 한 파일에서 온 페이지를 전부 뺀다 — 파일 단위 제거 (@tool-ux-principles §4). */
export function removeFile(pages: readonly WorkPage[], fileId: string): WorkPage[] {
	return pages.filter((page) => page.fileId !== fileId);
}

/** 시계방향으로 90도씩. 4번 돌리면 제자리로 돌아온다. */
export function rotateBy(rotation: Rotation, quarterTurns: number): Rotation {
	const turns = (((rotation / 90 + quarterTurns) % 4) + 4) % 4;
	return (turns * 90) as Rotation;
}

/** 지정한 id 들을 회전시킨 목록. 나머지는 그대로 둔다. */
export function rotatePages(
	pages: readonly WorkPage[],
	ids: ReadonlySet<string>,
	quarterTurns: number
): WorkPage[] {
	return pages.map((page) =>
		ids.has(page.id) ? { ...page, rotation: rotateBy(page.rotation, quarterTurns) } : page
	);
}
