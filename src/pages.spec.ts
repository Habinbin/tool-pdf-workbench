import { describe, expect, it } from 'vitest';

import {
	gapCount,
	gapFromPointer,
	moveToGap,
	nudge,
	removeFile,
	removePages,
	rotateBy,
	rotatePages
} from './pages';
import type { Rotation, WorkPage } from './types';

/** 번호만 다른 페이지 n 장. id 는 'p0'..'p{n-1}'. */
function makePages(n: number): WorkPage[] {
	return Array.from({ length: n }, (_, i) => ({
		id: `p${i}`,
		fileId: 'f0',
		pageIndex: i,
		rotation: 0 as Rotation
	}));
}

const ids = (pages: readonly WorkPage[]) => pages.map((p) => p.id).join(',');

describe('틈', () => {
	it('틈은 항목보다 하나 많다 — 마지막 틈이 있어야 맨 뒤로 옮길 수 있다', () => {
		expect(gapCount(makePages(10))).toBe(11);
	});

	it('앞 절반이면 앞 틈, 뒤 절반이면 뒤 틈', () => {
		expect(gapFromPointer(3, true)).toBe(3);
		expect(gapFromPointer(3, false)).toBe(4);
	});
});

describe('moveToGap', () => {
	it('마지막 항목을 첫 자리로 옮긴다', () => {
		expect(ids(moveToGap(makePages(10), 9, 0))).toBe('p9,p0,p1,p2,p3,p4,p5,p6,p7,p8');
	});

	it('첫 항목을 맨 뒤로 옮긴다 — 가장 흔한 누락', () => {
		expect(ids(moveToGap(makePages(10), 0, 10))).toBe('p1,p2,p3,p4,p5,p6,p7,p8,p9,p0');
	});

	it('5-6 사이 틈에 놓으면 정확히 5와 6 사이로 들어간다', () => {
		// 틈 6 = p5 와 p6 사이. p0 을 거기로.
		expect(ids(moveToGap(makePages(10), 0, 6))).toBe('p1,p2,p3,p4,p5,p0,p6,p7,p8,p9');
	});

	it('뒤에서 앞으로 옮길 때 한 칸 어긋나지 않는다', () => {
		expect(ids(moveToGap(makePages(5), 4, 2))).toBe('p0,p1,p4,p2,p3');
	});

	it('자기 앞 틈에 놓으면 제자리', () => {
		expect(ids(moveToGap(makePages(5), 2, 2))).toBe('p0,p1,p2,p3,p4');
	});

	it('자기 뒤 틈에 놓아도 제자리', () => {
		expect(ids(moveToGap(makePages(5), 2, 3))).toBe('p0,p1,p2,p3,p4');
	});

	it('원본 배열을 바꾸지 않는다', () => {
		const original = makePages(5);
		moveToGap(original, 0, 5);
		expect(ids(original)).toBe('p0,p1,p2,p3,p4');
	});

	it('범위 밖 틈·항목은 순서를 그대로 둔다', () => {
		expect(ids(moveToGap(makePages(3), 0, 99))).toBe('p0,p1,p2');
		expect(ids(moveToGap(makePages(3), -1, 1))).toBe('p0,p1,p2');
		expect(ids(moveToGap(makePages(3), 5, 1))).toBe('p0,p1,p2');
	});

	it('어느 틈으로 옮겨도 장수가 보존된다', () => {
		const pages = makePages(8);
		for (let from = 0; from < 8; from += 1) {
			for (let gap = 0; gap <= 8; gap += 1) {
				const moved = moveToGap(pages, from, gap);
				expect(moved).toHaveLength(8);
				expect(new Set(moved.map((p) => p.id)).size).toBe(8);
			}
		}
	});
});

describe('nudge (키보드 재정렬)', () => {
	it('한 칸 뒤로', () => {
		expect(ids(nudge(makePages(5), 1, 1))).toBe('p0,p2,p1,p3,p4');
	});

	it('한 칸 앞으로', () => {
		expect(ids(nudge(makePages(5), 3, -1))).toBe('p0,p1,p3,p2,p4');
	});

	it('맨 앞에서 앞으로 밀면 아무 일도 없다', () => {
		expect(ids(nudge(makePages(5), 0, -1))).toBe('p0,p1,p2,p3,p4');
	});

	it('맨 뒤에서 뒤로 밀면 아무 일도 없다', () => {
		expect(ids(nudge(makePages(5), 4, 1))).toBe('p0,p1,p2,p3,p4');
	});

	it('뒤로 밀고 앞으로 밀면 원래 자리', () => {
		const once = nudge(makePages(5), 1, 1);
		expect(ids(nudge(once, 2, -1))).toBe('p0,p1,p2,p3,p4');
	});
});

describe('제거', () => {
	it('지정한 id 만 뺀다', () => {
		expect(ids(removePages(makePages(5), new Set(['p1', 'p3'])))).toBe('p0,p2,p4');
	});

	it('전부 빼면 빈 목록', () => {
		expect(removePages(makePages(3), new Set(['p0', 'p1', 'p2']))).toHaveLength(0);
	});

	it('한 파일에서 온 페이지를 통째로 뺀다', () => {
		const pages: WorkPage[] = [
			{ id: 'a', fileId: 'f1', pageIndex: 0, rotation: 0 },
			{ id: 'b', fileId: 'f2', pageIndex: 0, rotation: 0 },
			{ id: 'c', fileId: 'f1', pageIndex: 1, rotation: 0 }
		];
		expect(ids(removeFile(pages, 'f1'))).toBe('b');
	});
});

describe('회전', () => {
	it('90도씩 돈다', () => {
		expect(rotateBy(0, 1)).toBe(90);
		expect(rotateBy(90, 1)).toBe(180);
		expect(rotateBy(270, 1)).toBe(0);
	});

	it('4번 돌리면 제자리', () => {
		expect(rotateBy(90, 4)).toBe(90);
	});

	it('반시계로도 돈다 — 음수가 음수각을 만들지 않는다', () => {
		expect(rotateBy(0, -1)).toBe(270);
		expect(rotateBy(0, -5)).toBe(270);
	});

	it('선택한 페이지만 돈다', () => {
		const rotated = rotatePages(makePages(3), new Set(['p1']), 1);
		expect(rotated.map((p) => p.rotation)).toEqual([0, 90, 0]);
	});
});
