import { describe, expect, it } from 'vitest';

import { planExport, type ExportSettings } from './export-plan';

function settings(overrides: Partial<ExportSettings> = {}): ExportSettings {
	return { format: 'pdf', baseName: '회의록', splitPages: false, ...overrides };
}

describe('기본 — 묻지 않고 정하는 것', () => {
	it('PDF 한 파일로 나온다. ZIP 으로 묶지 않는다', () => {
		const plan = planExport(5, settings());
		expect(plan.files).toHaveLength(1);
		expect(plan.files[0].name).toBe('회의록.pdf');
		expect(plan.zipped).toBe(false);
	});

	it('한 파일에는 모든 장이 순서대로 들어간다', () => {
		expect(planExport(3, settings()).files[0].pageIndices).toEqual([0, 1, 2]);
	});
});

describe('분할 — iLovePDF 의 Split PDF', () => {
	it('장마다 파일 하나', () => {
		const plan = planExport(3, settings({ splitPages: true }));
		expect(plan.files.map((f) => f.name)).toEqual(['회의록_1.pdf', '회의록_2.pdf', '회의록_3.pdf']);
	});

	it('각 파일에는 제 장 하나만', () => {
		expect(planExport(3, settings({ splitPages: true })).files[1].pageIndices).toEqual([1]);
	});

	it('여러 파일이면 ZIP 으로 묶는다', () => {
		const plan = planExport(3, settings({ splitPages: true }));
		expect(plan.zipped).toBe(true);
		expect(plan.zipName).toBe('회의록.zip');
	});

	it('1장짜리를 분할하면 파일이 하나뿐이라 ZIP 을 만들지 않는다', () => {
		const plan = planExport(1, settings({ splitPages: true }));
		expect(plan.files).toHaveLength(1);
		expect(plan.zipped).toBe(false);
	});

	it('10장 이상이면 번호에 0을 채워 사전순이 페이지 순서와 같다', () => {
		const names = planExport(12, settings({ splitPages: true })).files.map((f) => f.name);
		expect(names[0]).toBe('회의록_01.pdf');
		expect([...names].sort()).toEqual(names);
	});
});

describe('JPG — 분할 설정과 무관하게 장마다 하나', () => {
	it('splitPages 가 꺼져 있어도 쪼개진다', () => {
		const plan = planExport(3, settings({ format: 'jpg', splitPages: false }));
		expect(plan.files.map((f) => f.name)).toEqual(['회의록_1.jpg', '회의록_2.jpg', '회의록_3.jpg']);
	});
});

describe('텍스트 — 늘 한 파일로 이어 붙인다', () => {
	it('분할을 켜도 한 파일', () => {
		const plan = planExport(5, settings({ format: 'text', splitPages: true }));
		expect(plan.files).toHaveLength(1);
		expect(plan.files[0].name).toBe('회의록.txt');
	});
});

describe('막는 이유 — 숨기지 않고 이유를 말한다', () => {
	it('페이지가 없으면 무엇을 하면 되는지 알린다', () => {
		expect(planExport(0, settings()).blockedReason).toContain('떨어뜨리면');
	});

	it('PDF/A 와 암호를 같이 켜면 막고 이유를 말한다', () => {
		const plan = planExport(3, settings({ pdfa: true, protection: { userPassword: 'x' } }));
		expect(plan.blockedReason).toContain('PDF/A');
	});

	it('PDF/A 만 켜면 막지 않는다', () => {
		expect(planExport(3, settings({ pdfa: true })).blockedReason).toBeUndefined();
	});

	it('암호만 걸면 막지 않는다', () => {
		expect(
			planExport(3, settings({ protection: { userPassword: 'x' } })).blockedReason
		).toBeUndefined();
	});

	it('JPG 에 암호를 걸려 하면 막는다', () => {
		const plan = planExport(3, settings({ format: 'jpg', protection: { userPassword: 'x' } }));
		expect(plan.blockedReason).toContain('JPG');
	});

	it('빈 비밀번호는 암호를 건 것으로 치지 않는다', () => {
		expect(
			planExport(3, settings({ pdfa: true, protection: { userPassword: '' } })).blockedReason
		).toBeUndefined();
	});
});

describe('요약 — 내보내기 전에 결과를 보여 준다', () => {
	it('한 파일', () => {
		expect(planExport(5, settings()).summary).toBe('PDF 1개 · 5장');
	});

	it('분할하면 ZIP 이라고 알린다', () => {
		expect(planExport(3, settings({ splitPages: true })).summary).toBe('PDF 3개 · ZIP');
	});

	it('압축·암호·PDF-A 를 한 줄에 함께 적는다', () => {
		expect(planExport(3, settings({ protection: { userPassword: 'x' } })).summary).toBe(
			'PDF 1개 · 3장 · 암호'
		);
	});

	it('PDF/A 도 요약에 나온다', () => {
		expect(planExport(2, settings({ pdfa: true })).summary).toBe('PDF 1개 · 2장 · PDF/A');
	});
});

describe('파일명', () => {
	it('금지 문자를 지운다', () => {
		expect(planExport(1, settings({ baseName: 'a/b:c' })).files[0].name).toBe('abc.pdf');
	});

	it('비우면 기본 이름을 쓰고 막지 않는다', () => {
		const plan = planExport(1, settings({ baseName: '   ' }));
		expect(plan.files[0].name).toBe('문서.pdf');
		expect(plan.blockedReason).toBeUndefined();
	});
});
