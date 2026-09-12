/**
 * 페이지 위에 얹는 것들 — "위에 뭘 얹지" 에 답하는 자리.
 *
 * 사용자가 목록에서 고르는 것은 여기뿐이다. 나머지 기능은 손동작이거나
 * 내보내기 옵션이라 고를 대상이 아니다 (README §왜 "툴 목록" 이 아닌가).
 *
 * 이 파일은 **좌표만** 계산한다. 실제로 그리는 일은 `assemble.ts` 가 하고, 글자를
 * 그림으로 굽는 일은 `text-image.ts` 가 한다. 기하를 떼어 놓아야 "오른쪽 아래에
 * 넣었는데 왼쪽 위에 찍힌다" 같은 부류를 node 에서 잡을 수 있다.
 */

/** 페이지 안의 아홉 자리. 워터마크만 예외로 늘 가운데다. */
export type Anchor =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'middle-left'
	| 'middle-center'
	| 'middle-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right';

/** 페이지 번호의 표기. */
export type NumberFormat = 'plain' | 'of-total' | 'dashed';

export interface Numbering {
	kind: 'numbering';
	anchor: Anchor;
	format: NumberFormat;
	/** 몇 번부터 셀지. 표지를 빼고 세고 싶을 때 쓴다. */
	startAt: number;
	/** 번호를 넣지 않을 앞쪽 장수. 표지·속표지용. */
	skipFirst: number;
	fontSize: number;
}

export interface Watermark {
	kind: 'watermark';
	text: string;
	/** 0–1. 낮을수록 밑의 내용이 잘 비친다. */
	opacity: number;
	/** 반시계 방향 각도. 대각선이 기본. */
	angle: number;
	fontSize: number;
}

export interface Stamp {
	kind: 'stamp';
	/** PNG · JPG 바이트. 서명·도장·로고. */
	bytes: ArrayBuffer;
	mime: string;
	anchor: Anchor;
	/** 페이지 너비 대비 폭 비율. 0–1. */
	widthRatio: number;
	opacity: number;
}

/** 여백을 잘라 낸다. 각 값은 그 변에서 **안쪽으로** 들어간 비율(0–0.45). */
export interface Crop {
	kind: 'crop';
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export type Overlay = Numbering | Watermark | Stamp | Crop;

/** 앵커가 가장자리에서 떨어지는 거리(pt). 일반적인 인쇄 여백 안쪽에 놓인다. */
export const ANCHOR_MARGIN = 28;

export interface Box {
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

/**
 * 앵커에 맞춰 내용물의 왼쪽-아래 좌표를 구한다.
 *
 * PDF 좌표계는 **왼쪽 아래가 원점**이고 y 가 위로 자란다. 화면 좌표계와 반대라
 * 여기서 한 번에 뒤집어 두지 않으면 호출하는 쪽마다 헷갈린다.
 *
 * @param page 페이지 크기(pt).
 * @param content 얹을 것의 크기(pt).
 * @param anchor 어느 자리에.
 * @param margin 가장자리에서 떨어지는 거리.
 * @returns 내용물의 왼쪽-아래 좌표.
 */
export function anchorPoint(
	page: Box,
	content: Box,
	anchor: Anchor,
	margin: number = ANCHOR_MARGIN
): Point {
	const [vertical, horizontal] = anchor.split('-');

	const x =
		horizontal === 'left'
			? margin
			: horizontal === 'right'
				? page.width - content.width - margin
				: (page.width - content.width) / 2;

	const y =
		vertical === 'bottom'
			? margin
			: vertical === 'top'
				? page.height - content.height - margin
				: (page.height - content.height) / 2;

	return { x, y };
}

/**
 * 한 장에 찍힐 번호 문자열. 번호를 넣지 않는 장이면 `null`.
 *
 * @param pageIndex 0-기반 위치.
 * @param total 전체 장수.
 * @param numbering 설정.
 */
export function numberLabel(pageIndex: number, total: number, numbering: Numbering): string | null {
	if (pageIndex < numbering.skipFirst) return null;

	const shown = pageIndex - numbering.skipFirst + numbering.startAt;
	// 번호가 붙는 장의 수. "3 / 10" 의 10 은 전체가 아니라 번호가 붙는 범위다 —
	// 표지를 뺐는데 마지막이 "9 / 10" 으로 끝나면 한 장이 사라진 것처럼 보인다.
	const counted = total - numbering.skipFirst + numbering.startAt - 1;

	switch (numbering.format) {
		case 'of-total':
			return `${shown} / ${counted}`;
		case 'dashed':
			return `- ${shown} -`;
		default:
			return String(shown);
	}
}

/** 잘라 낸 뒤의 상자. PDF 의 CropBox 에 그대로 넣을 수 있는 값. */
export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** 한 변에서 잘라 낼 수 있는 최대 비율. 넘으면 남는 면적이 사라진다. */
const MAX_TRIM = 0.45;

function clampTrim(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(MAX_TRIM, Math.max(0, value));
}

/**
 * 비율로 준 여백을 실제 상자로 바꾼다.
 *
 * 각 변은 0–45% 로 묶는다. 마주 보는 두 변이 50% 씩이면 남는 것이 없어 뷰어가
 * 빈 페이지를 그리거나 파일을 거부한다.
 *
 * @param page 원본 페이지 크기.
 * @param crop 각 변에서 안쪽으로 들어갈 비율.
 */
export function cropRect(page: Box, crop: Crop): CropRect {
	const left = clampTrim(crop.left);
	const right = clampTrim(crop.right);
	const top = clampTrim(crop.top);
	const bottom = clampTrim(crop.bottom);

	const x = page.width * left;
	// PDF 는 아래가 원점이므로 `bottom` 이 y 의 시작이다.
	const y = page.height * bottom;

	return {
		x,
		y,
		width: page.width * (1 - left - right),
		height: page.height * (1 - top - bottom)
	};
}

/** 스탬프를 페이지 폭 비율에 맞춰 줄인 크기. 가로세로 비는 유지한다. */
export function stampSize(page: Box, image: Box, widthRatio: number): Box {
	const ratio = Math.min(1, Math.max(0.02, widthRatio));
	const width = page.width * ratio;
	return { width, height: (image.height / image.width) * width };
}

/**
 * 워터마크를 페이지 가운데에 대각선으로 놓을 때의 좌표.
 *
 * 회전은 **그리는 쪽 기준점**을 중심으로 일어나므로, 글자 상자의 가운데가 페이지
 * 가운데에 오도록 회전각을 감안해 되돌려 놓아야 한다. 이걸 빼먹으면 각도를 바꿀
 * 때마다 워터마크가 페이지 밖으로 미끄러진다.
 *
 * @param page 페이지 크기.
 * @param content 글자 상자 크기(회전 전).
 * @param angleDegrees 반시계 방향 각도.
 */
export function centeredRotatedPoint(page: Box, content: Box, angleDegrees: number): Point {
	const radians = (angleDegrees * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);

	// 회전 뒤 글자 상자 중심이 원점에서 얼마나 벗어나는지.
	const offsetX = (content.width * cos - content.height * sin) / 2;
	const offsetY = (content.width * sin + content.height * cos) / 2;

	return { x: page.width / 2 - offsetX, y: page.height / 2 - offsetY };
}

/** 얹을 것을 놓을 절대 좌표와 크기. 페이지 좌표계 기준. */
export interface Placement {
	x: number;
	y: number;
	width: number;
	height: number;
	/** 반시계 방향 회전각. 0 이면 회전하지 않는다. */
	angle: number;
	opacity: number;
}

/**
 * **보이는 창** 안에 얹을 것을 놓는다.
 *
 * `view` 로 CropBox 를 받는 것이 요점이다. MediaBox 를 기준으로 잡으면 여백을
 * 잘라 낸 뒤 쪽번호가 잘려 나간 띠 안에 찍혀 아예 보이지 않는다 — 실제로 그랬다.
 * CropBox 는 원점도 옮기므로 그 시작점을 더해 절대 좌표로 돌려준다.
 *
 * @param view 보이는 창. 자르지 않았으면 페이지 전체와 같다.
 * @param content 얹을 것의 크기(회전 전).
 * @param overlay 쪽번호 · 워터마크 · 도장 중 하나. 자르기는 여기 오지 않는다.
 */
export function placeInView(
	view: CropRect,
	content: Box,
	overlay: Numbering | Watermark | Stamp
): Placement {
	const size = { width: view.width, height: view.height };

	if (overlay.kind === 'watermark') {
		const point = centeredRotatedPoint(size, content, overlay.angle);
		return {
			x: view.x + point.x,
			y: view.y + point.y,
			width: content.width,
			height: content.height,
			angle: overlay.angle,
			opacity: overlay.opacity
		};
	}

	const box = overlay.kind === 'stamp' ? stampSize(size, content, overlay.widthRatio) : content;
	const point = anchorPoint(size, box, overlay.anchor);

	return {
		x: view.x + point.x,
		y: view.y + point.y,
		width: box.width,
		height: box.height,
		angle: 0,
		opacity: overlay.kind === 'stamp' ? overlay.opacity : 1
	};
}
