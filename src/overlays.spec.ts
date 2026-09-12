import { describe, expect, it } from 'vitest';

import {
	ANCHOR_MARGIN,
	anchorPoint,
	centeredRotatedPoint,
	cropRect,
	numberLabel,
	placeInView,
	stampSize,
	type Anchor,
	type Crop,
	type Numbering
} from './overlays';

const A4 = { width: 595, height: 842 };
const LABEL = { width: 40, height: 12 };

function numbering(overrides: Partial<Numbering> = {}): Numbering {
	return {
		kind: 'numbering',
		anchor: 'bottom-center',
		format: 'plain',
		startAt: 1,
		skipFirst: 0,
		fontSize: 10,
		...overrides
	};
}

describe('anchorPoint — PDF 는 왼쪽 아래가 원점이다', () => {
	it('왼쪽 아래', () => {
		expect(anchorPoint(A4, LABEL, 'bottom-left')).toEqual({ x: 28, y: 28 });
	});

	it('오른쪽 위 — y 가 위로 자라므로 높이에서 뺀다', () => {
		expect(anchorPoint(A4, LABEL, 'top-right')).toEqual({
			x: 595 - 40 - 28,
			y: 842 - 12 - 28
		});
	});

	it('아래 가운데 — 글자 상자의 폭만큼 되돌려 진짜 가운데에 온다', () => {
		expect(anchorPoint(A4, LABEL, 'bottom-center')).toEqual({ x: (595 - 40) / 2, y: 28 });
	});

	it('정가운데', () => {
		expect(anchorPoint(A4, LABEL, 'middle-center')).toEqual({
			x: (595 - 40) / 2,
			y: (842 - 12) / 2
		});
	});

	it('아홉 자리 전부 페이지 안에 들어간다', () => {
		const anchors: Anchor[] = [
			'top-left',
			'top-center',
			'top-right',
			'middle-left',
			'middle-center',
			'middle-right',
			'bottom-left',
			'bottom-center',
			'bottom-right'
		];
		for (const anchor of anchors) {
			const point = anchorPoint(A4, LABEL, anchor);
			expect(point.x).toBeGreaterThanOrEqual(0);
			expect(point.y).toBeGreaterThanOrEqual(0);
			expect(point.x + LABEL.width).toBeLessThanOrEqual(A4.width);
			expect(point.y + LABEL.height).toBeLessThanOrEqual(A4.height);
		}
	});

	it('여백을 0 으로 주면 모서리에 딱 붙는다', () => {
		expect(anchorPoint(A4, LABEL, 'bottom-left', 0)).toEqual({ x: 0, y: 0 });
	});

	it('기본 여백은 인쇄 여백 안쪽이다', () => {
		expect(ANCHOR_MARGIN).toBeLessThan(72);
	});
});

describe('numberLabel', () => {
	it('기본은 숫자만', () => {
		expect(numberLabel(0, 10, numbering())).toBe('1');
	});

	it('전체와 함께', () => {
		expect(numberLabel(2, 10, numbering({ format: 'of-total' }))).toBe('3 / 10');
	});

	it('줄표 형식', () => {
		expect(numberLabel(4, 10, numbering({ format: 'dashed' }))).toBe('- 5 -');
	});

	it('앞 장을 건너뛰면 그 장에는 번호가 없다', () => {
		expect(numberLabel(0, 10, numbering({ skipFirst: 1 }))).toBeNull();
	});

	it('건너뛴 다음 장이 1번이 된다 — 표지를 빼고 세는 경우', () => {
		expect(numberLabel(1, 10, numbering({ skipFirst: 1 }))).toBe('1');
	});

	it('표지를 뺐으면 마지막이 "9 / 9" 로 끝난다 — 한 장 사라진 것처럼 보이지 않게', () => {
		const options = numbering({ skipFirst: 1, format: 'of-total' });
		expect(numberLabel(9, 10, options)).toBe('9 / 9');
	});

	it('시작 번호를 바꾸면 그만큼 밀린다 — 앞 권에서 이어질 때', () => {
		expect(numberLabel(0, 10, numbering({ startAt: 11 }))).toBe('11');
	});
});

describe('cropRect', () => {
	it('아무것도 안 자르면 원본 그대로', () => {
		const crop: Crop = { kind: 'crop', top: 0, right: 0, bottom: 0, left: 0 };
		expect(cropRect(A4, crop)).toEqual({ x: 0, y: 0, width: 595, height: 842 });
	});

	it('왼쪽 10% 를 자르면 x 가 그만큼 들어가고 폭이 준다', () => {
		const crop: Crop = { kind: 'crop', top: 0, right: 0, bottom: 0, left: 0.1 };
		const rect = cropRect(A4, crop);
		expect(rect.x).toBeCloseTo(59.5);
		expect(rect.width).toBeCloseTo(535.5);
	});

	it('아래를 자르면 y 가 올라간다 — PDF 는 아래가 원점', () => {
		const crop: Crop = { kind: 'crop', top: 0, right: 0, bottom: 0.1, left: 0 };
		expect(cropRect(A4, crop).y).toBeCloseTo(84.2);
	});

	it('마주 보는 두 변을 각각 45% 로 묶는다 — 면적이 사라지지 않게', () => {
		const crop: Crop = { kind: 'crop', top: 0.9, right: 0, bottom: 0.9, left: 0 };
		const rect = cropRect(A4, crop);
		expect(rect.height).toBeGreaterThan(0);
		expect(rect.height).toBeCloseTo(842 * 0.1);
	});

	it('음수는 0 으로 본다', () => {
		const crop: Crop = { kind: 'crop', top: -1, right: 0, bottom: 0, left: 0 };
		expect(cropRect(A4, crop).height).toBe(842);
	});

	it('NaN 이 들어와도 상자가 깨지지 않는다 — 빈 입력란에서 온다', () => {
		const crop: Crop = { kind: 'crop', top: Number.NaN, right: 0, bottom: 0, left: 0 };
		expect(cropRect(A4, crop).height).toBe(842);
	});
});

describe('stampSize', () => {
	it('페이지 폭 비율에 맞춘다', () => {
		expect(stampSize(A4, { width: 200, height: 100 }, 0.25).width).toBeCloseTo(148.75);
	});

	it('가로세로 비를 유지한다', () => {
		const size = stampSize(A4, { width: 200, height: 100 }, 0.25);
		expect(size.width / size.height).toBeCloseTo(2);
	});

	it('1 을 넘는 비율은 페이지 폭으로 묶는다', () => {
		expect(stampSize(A4, { width: 10, height: 10 }, 5).width).toBe(595);
	});
});

describe('centeredRotatedPoint', () => {
	it('회전이 없으면 그냥 가운데', () => {
		const point = centeredRotatedPoint(A4, { width: 300, height: 40 }, 0);
		expect(point.x).toBeCloseTo((595 - 300) / 2);
		expect(point.y).toBeCloseTo((842 - 40) / 2);
	});

	it('어떤 각도에서도 글자 상자의 중심이 페이지 중심에 온다', () => {
		const content = { width: 300, height: 40 };
		for (const angle of [0, 15, 45, 90, 135, 180, 270, 330]) {
			const point = centeredRotatedPoint(A4, content, angle);
			const radians = (angle * Math.PI) / 180;
			// 기준점에서 상자 중심까지를 회전시켜 더하면 페이지 중심이어야 한다.
			const centerX =
				point.x +
				(content.width / 2) * Math.cos(radians) -
				(content.height / 2) * Math.sin(radians);
			const centerY =
				point.y +
				(content.width / 2) * Math.sin(radians) +
				(content.height / 2) * Math.cos(radians);
			expect(centerX).toBeCloseTo(A4.width / 2);
			expect(centerY).toBeCloseTo(A4.height / 2);
		}
	});
});

/**
 * 보이는 창 기준 배치. 실제로 쪽번호가 사라진 적이 있어 회귀 테스트로 남긴다 —
 * MediaBox 기준으로 잡는 바람에 잘려 나간 띠 안에 찍혔다.
 */
describe('placeInView — 자르기 뒤에도 보이는 자리에', () => {
	const numberingAt = (anchor: Anchor): Numbering => ({
		kind: 'numbering',
		anchor,
		format: 'plain',
		startAt: 1,
		skipFirst: 0,
		fontSize: 10
	});

	const label = { width: 20, height: 13 };
	/** 자르지 않은 A4. CropBox 가 페이지 전체와 같다. */
	const full = { x: 0, y: 0, width: 595, height: 842 };
	/** 아래 20% 를 자른 A4. 원점이 위로 올라간다. */
	const trimmed = { x: 0, y: 168.4, width: 595, height: 673.6 };

	it('자르지 않았으면 좌표가 그대로다', () => {
		const at = placeInView(full, label, numberingAt('bottom-center'));
		expect(at.y).toBeCloseTo(ANCHOR_MARGIN);
	});

	it('아래를 자르면 쪽번호가 그만큼 위로 올라온다', () => {
		const at = placeInView(trimmed, label, numberingAt('bottom-center'));
		expect(at.y).toBeCloseTo(168.4 + ANCHOR_MARGIN);
	});

	it('잘린 뒤에도 보이는 창 안에 들어간다 — 아홉 자리 전부', () => {
		const anchors: Anchor[] = [
			'top-left',
			'top-center',
			'top-right',
			'middle-left',
			'middle-center',
			'middle-right',
			'bottom-left',
			'bottom-center',
			'bottom-right'
		];
		for (const anchor of anchors) {
			const at = placeInView(trimmed, label, numberingAt(anchor));
			expect(at.y).toBeGreaterThanOrEqual(trimmed.y);
			expect(at.y + at.height).toBeLessThanOrEqual(trimmed.y + trimmed.height);
			expect(at.x).toBeGreaterThanOrEqual(trimmed.x);
			expect(at.x + at.width).toBeLessThanOrEqual(trimmed.x + trimmed.width);
		}
	});

	it('워터마크는 잘린 창의 가운데에 온다 — 원본 가운데가 아니라', () => {
		const at = placeInView(
			trimmed,
			{ width: 300, height: 40 },
			{
				kind: 'watermark',
				text: '대외비',
				opacity: 0.2,
				angle: 0,
				fontSize: 48
			}
		);
		expect(at.y + at.height / 2).toBeCloseTo(trimmed.y + trimmed.height / 2);
		expect(at.angle).toBe(0);
		expect(at.opacity).toBeCloseTo(0.2);
	});

	it('도장은 보이는 창의 폭을 기준으로 줄어든다', () => {
		const at = placeInView(
			trimmed,
			{ width: 200, height: 100 },
			{
				kind: 'stamp',
				bytes: new ArrayBuffer(0),
				mime: 'image/png',
				anchor: 'bottom-right',
				widthRatio: 0.2,
				opacity: 0.9
			}
		);
		expect(at.width).toBeCloseTo(595 * 0.2);
		expect(at.opacity).toBeCloseTo(0.9);
		// 오른쪽 끝이 창 밖으로 나가지 않는다.
		expect(at.x + at.width).toBeLessThanOrEqual(trimmed.x + trimmed.width);
	});
});
