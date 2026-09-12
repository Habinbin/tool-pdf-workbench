import { describe, expect, it } from 'vitest';

import { baseNameFrom, naturalCompare, pageFileName, sanitize, stripExtension } from './naming';

describe('stripExtension', () => {
	it('확장자를 뗀다', () => {
		expect(stripExtension('보고서.pdf')).toBe('보고서');
	});

	it('점이 여럿이면 마지막 것만 뗀다', () => {
		expect(stripExtension('2026.03.회의록.pdf')).toBe('2026.03.회의록');
	});

	it('확장자가 없으면 그대로', () => {
		expect(stripExtension('보고서')).toBe('보고서');
	});

	it('점으로 시작하는 이름을 통째로 지우지 않는다', () => {
		expect(stripExtension('.gitignore')).toBe('.gitignore');
	});
});

describe('sanitize', () => {
	it('경로 구분자를 지운다', () => {
		expect(sanitize('a/b\\c')).toBe('abc');
	});

	it('윈도가 금지하는 문자를 지운다', () => {
		expect(sanitize('보고서<>:"|?*')).toBe('보고서');
	});

	it('제어문자를 지운다', () => {
		expect(sanitize('보\u0007고\u001f서')).toBe('보고서');
	});

	it('이름 끝의 점과 공백을 지운다 — 윈도가 조용히 잘라낸다', () => {
		expect(sanitize('보고서. ')).toBe('보고서');
	});

	it('전부 지워지면 기본 이름을 준다', () => {
		expect(sanitize('///')).toBe('문서');
		expect(sanitize('   ')).toBe('문서');
	});

	it('한글·영문·숫자·공백·하이픈은 살린다', () => {
		expect(sanitize('2026 회의 자료-최종')).toBe('2026 회의 자료-최종');
	});
});

describe('baseNameFrom', () => {
	it('첫 파일에서 끌어온다 — 묻지 않는다', () => {
		expect(baseNameFrom(['회의록.pdf', '부록.pdf'])).toBe('회의록');
	});

	it('입력이 없으면 기본 이름', () => {
		expect(baseNameFrom([])).toBe('문서');
	});
});

describe('pageFileName', () => {
	it('전체 장수의 자릿수만큼 0을 채운다', () => {
		expect(pageFileName('회의록', 0, 100, 'pdf')).toBe('회의록_001.pdf');
		expect(pageFileName('회의록', 9, 100, 'pdf')).toBe('회의록_010.pdf');
	});

	it('9장이면 자리를 늘리지 않는다', () => {
		expect(pageFileName('a', 0, 9, 'pdf')).toBe('a_1.pdf');
	});

	it('채운 이름은 사전순이 페이지 순서와 같다 — 안 채우면 10이 2 앞에 온다', () => {
		const names = Array.from({ length: 12 }, (_, i) => pageFileName('a', i, 12, 'pdf'));
		expect([...names].sort()).toEqual(names);
	});
});

describe('naturalCompare', () => {
	it('10.png 가 2.png 뒤에 온다 — 사전순이 아니다', () => {
		expect(['10.png', '2.png', '1.png'].sort(naturalCompare)).toEqual(['1.png', '2.png', '10.png']);
	});

	it('접두사가 있어도 숫자로 센다', () => {
		expect(['scan-10', 'scan-9'].sort(naturalCompare)).toEqual(['scan-9', 'scan-10']);
	});
});
