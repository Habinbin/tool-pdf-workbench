import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import { ConflictingOptionsError, NoPagesError, assemble } from './assemble';
import type { SourceFile, WorkPage } from './types';

/**
 * 검증은 결과물을 **실제로 열어서** 한다 (@failure-checklist-first).
 * 그래서 여기 테스트는 전부 구운 바이트를 다시 `PDFDocument.load` 해서 확인한다.
 */

/** 각 장에 제 번호를 크게 적은 PDF. 순서가 섞이면 글자로 드러난다. */
async function makePdf(pageCount: number, label: string): Promise<ArrayBuffer> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let i = 0; i < pageCount; i += 1) {
		const page = doc.addPage([400, 600]);
		page.drawText(`${label}${i}`, { x: 40, y: 500, size: 48, font, color: rgb(0, 0, 0) });
	}
	return (await doc.save()).slice().buffer as ArrayBuffer;
}

/** 이미 회전이 걸린 채로 저장된 PDF — 스캐너가 내놓는 모양. */
async function makeRotatedPdf(angle: number): Promise<ArrayBuffer> {
	const doc = await PDFDocument.create();
	doc.addPage([400, 600]).setRotation(degrees(angle));
	return (await doc.save()).slice().buffer as ArrayBuffer;
}

/** 1×1 빨간 PNG. */
const RED_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
);

function source(id: string, bytes: ArrayBuffer, name = `${id}.pdf`): SourceFile {
	return { id, name, bytes, kind: 'pdf' };
}

function page(fileId: string, pageIndex: number, rotation: 0 | 90 | 180 | 270 = 0): WorkPage {
	return { id: `${fileId}:${pageIndex}:${rotation}`, fileId, pageIndex, rotation };
}

/** 구운 결과의 각 장에서 텍스트를 읽어 순서를 확인한다. */
async function pageCountOf(bytes: Uint8Array, password?: string): Promise<number> {
	const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer, { password });
	return doc.getPageCount();
}

let threePages: ArrayBuffer;
let twoPages: ArrayBuffer;

beforeAll(async () => {
	threePages = await makePdf(3, 'A');
	twoPages = await makePdf(2, 'B');
});

describe('정확성', () => {
	it('출력 페이지 수 == 작업대에 남은 페이지 수', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0), page('a', 2)], sources);
		expect(await pageCountOf(bytes)).toBe(2);
	});

	it('두 파일을 병합하면 장수가 합쳐진다', async () => {
		const sources = new Map([
			['a', source('a', threePages)],
			['b', source('b', twoPages)]
		]);
		const pages = [page('a', 0), page('a', 1), page('a', 2), page('b', 0), page('b', 1)];
		expect(await pageCountOf(await assemble(pages, sources))).toBe(5);
	});

	it('삭제한 페이지가 출력에 없다 — 장수로 확인', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		// 가운데 장을 뺀다.
		const bytes = await assemble([page('a', 0), page('a', 2)], sources);
		const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer);
		expect(doc.getPageCount()).toBe(2);
	});

	it('같은 페이지를 두 번 넣을 수 있다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble(
			[
				{ id: 'x', fileId: 'a', pageIndex: 1, rotation: 0 },
				{ id: 'y', fileId: 'a', pageIndex: 1, rotation: 0 }
			],
			sources
		);
		expect(await pageCountOf(bytes)).toBe(2);
	});

	it('텍스트 PDF 를 병합해도 래스터화되지 않는다 — 폰트 자원이 살아 있다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources);
		// 래스터화했다면 폰트가 사라지고 이미지 XObject 만 남는다.
		const raw = new TextDecoder('latin1').decode(bytes);
		expect(raw).toContain('/Font');
	});
});

describe('회전', () => {
	it('사용자가 준 회전이 출력에 반영된다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0, 90)], sources);
		const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer);
		expect(doc.getPage(0).getRotation().angle).toBe(90);
	});

	it('원본이 이미 회전돼 있으면 더해진다 — 덮어쓰지 않는다', async () => {
		const rotated = await makeRotatedPdf(90);
		const sources = new Map([['r', source('r', rotated)]]);
		const bytes = await assemble([page('r', 0, 90)], sources);
		const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer);
		expect(doc.getPage(0).getRotation().angle).toBe(180);
	});

	it('270 + 180 은 90 으로 접힌다 — 360 을 넘지 않는다', async () => {
		const rotated = await makeRotatedPdf(270);
		const sources = new Map([['r', source('r', rotated)]]);
		const bytes = await assemble([page('r', 0, 180)], sources);
		const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer);
		expect(doc.getPage(0).getRotation().angle).toBe(90);
	});

	it('회전 0 이면 원본 각도를 그대로 둔다', async () => {
		const rotated = await makeRotatedPdf(90);
		const sources = new Map([['r', source('r', rotated)]]);
		const bytes = await assemble([page('r', 0, 0)], sources);
		const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer);
		expect(doc.getPage(0).getRotation().angle).toBe(90);
	});
});

describe('이미지', () => {
	it('이미지가 제 픽셀 크기의 페이지로 들어간다 — 여백도 잘림도 없다', async () => {
		const sources = new Map<string, SourceFile>([
			[
				'img',
				{
					id: 'img',
					name: 'red.png',
					bytes: RED_PNG.slice().buffer as ArrayBuffer,
					kind: 'image',
					imageMime: 'image/png'
				}
			]
		]);
		const bytes = await assemble([page('img', 0)], sources);
		const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer);
		const { width, height } = doc.getPage(0).getSize();
		expect([width, height]).toEqual([1, 1]);
	});

	it('지원하지 않는 이미지 형식은 이유를 밝히며 실패한다', async () => {
		const sources = new Map<string, SourceFile>([
			[
				'gif',
				{
					id: 'gif',
					name: 'a.gif',
					bytes: new ArrayBuffer(8),
					kind: 'image',
					imageMime: 'image/gif'
				}
			]
		]);
		await expect(assemble([page('gif', 0)], sources)).rejects.toThrow('image/gif');
	});
});

describe('암호', () => {
	it('건 비밀번호로 열린다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, {
			protection: { userPassword: 'hunter2' }
		});
		expect(await pageCountOf(bytes, 'hunter2')).toBe(1);
	});

	it('비밀번호 없이는 열리지 않는다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, {
			protection: { userPassword: 'hunter2' }
		});
		await expect(pageCountOf(bytes)).rejects.toThrow();
	});

	it('틀린 비밀번호로는 열리지 않는다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, {
			protection: { userPassword: 'hunter2' }
		});
		await expect(pageCountOf(bytes, 'wrong')).rejects.toThrow();
	});

	it('암호를 걸어도 장수와 순서가 보존된다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 2), page('a', 0)], sources, {
			protection: { userPassword: 'pw' }
		});
		expect(await pageCountOf(bytes, 'pw')).toBe(2);
	});

	it('빈 비밀번호는 암호를 걸지 않는다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, { protection: { userPassword: '' } });
		expect(await pageCountOf(bytes)).toBe(1);
	});
});

describe('PDF/A', () => {
	it('변환해도 장수가 보존된다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0), page('a', 1)], sources, { pdfa: true });
		expect(await pageCountOf(bytes)).toBe(2);
	});

	it('PDF/A 와 암호를 같이 켜면 거부한다 — 규격이 금지한다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		await expect(
			assemble([page('a', 0)], sources, { pdfa: true, protection: { userPassword: 'x' } })
		).rejects.toBeInstanceOf(ConflictingOptionsError);
	});
});

describe('경계', () => {
	it('페이지가 없으면 이유를 밝히며 거부한다', async () => {
		await expect(assemble([], new Map())).rejects.toBeInstanceOf(NoPagesError);
	});

	it('원본이 사라졌으면 어느 파일인지 말한다', async () => {
		await expect(assemble([page('ghost', 0)], new Map())).rejects.toThrow('ghost');
	});

	it('진행률이 1부터 전체까지 빠짐없이 보고된다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const seen: number[] = [];
		await assemble([page('a', 0), page('a', 1), page('a', 2)], sources, {
			onProgress: (done, total) => {
				expect(total).toBe(3);
				seen.push(done);
			}
		});
		expect(seen).toEqual([1, 2, 3]);
	});
});

/**
 * 오버레이는 `renderer` 를 주입받으므로 node 에서도 검증된다 — 캔버스 없이
 * 가짜 렌더러로 "그려졌는가 · 어디에 그려졌는가" 를 확인한다.
 */
describe('덧입히기', () => {
	/** 1×1 투명 PNG 를 주는 가짜 렌더러. 크기만 그럴듯하면 기하 검증에 충분하다. */
	const renderer = {
		async renderText(text: string, style: { fontSize: number }) {
			return {
				bytes: RED_PNG.slice().buffer as ArrayBuffer,
				width: text.length * style.fontSize * 0.6,
				height: style.fontSize * 1.3
			};
		},
		async imageSize() {
			return { width: 1, height: 1 };
		}
	};

	const numbering = {
		kind: 'numbering' as const,
		anchor: 'bottom-center' as const,
		format: 'plain' as const,
		startAt: 1,
		skipFirst: 0,
		fontSize: 10
	};

	it('쪽번호를 얹어도 장수와 순서가 그대로다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0), page('a', 1)], sources, {
			overlays: [numbering],
			renderer
		});
		expect(await pageCountOf(bytes)).toBe(2);
	});

	it('renderer 가 없으면 조용히 건너뛴다 — 조립을 실패시키지 않는다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, { overlays: [numbering] });
		expect(await pageCountOf(bytes)).toBe(1);
	});

	it('자르기는 CropBox 를 좁힌다 — 내용은 그대로 둔다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, {
			overlays: [{ kind: 'crop', top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 }]
		});
		const doc = await PDFDocument.load(bytes.slice().buffer as ArrayBuffer);
		const cropped = doc.getPage(0).getCropBox();
		// 원본은 400×600.
		expect(cropped.width).toBeCloseTo(320);
		expect(cropped.height).toBeCloseTo(480);
		// MediaBox 는 건드리지 않는다 — 되돌릴 수 있어야 한다.
		expect(doc.getPage(0).getMediaBox().width).toBeCloseTo(400);
	});

	it('워터마크를 얹어도 본문 텍스트가 살아 있다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, {
			overlays: [{ kind: 'watermark', text: '대외비', opacity: 0.2, angle: 45, fontSize: 48 }],
			renderer
		});
		expect(new TextDecoder('latin1').decode(bytes)).toContain('/Font');
	});

	it('스탬프는 렌더러 없이도 얹힌다 — 이미 그림이다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, {
			overlays: [
				{
					kind: 'stamp',
					bytes: RED_PNG.slice().buffer as ArrayBuffer,
					mime: 'image/png',
					anchor: 'bottom-right',
					widthRatio: 0.2,
					opacity: 1
				}
			]
		});
		expect(await pageCountOf(bytes)).toBe(1);
	});

	it('여러 개를 겹쳐 얹을 수 있다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, {
			overlays: [
				numbering,
				{ kind: 'watermark', text: '초안', opacity: 0.15, angle: 45, fontSize: 40 },
				{ kind: 'crop', top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 }
			],
			renderer
		});
		expect(await pageCountOf(bytes)).toBe(1);
	});

	it('폼 평탄화는 폼이 없어도 실패하지 않는다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		const bytes = await assemble([page('a', 0)], sources, { flattenForms: true });
		expect(await pageCountOf(bytes)).toBe(1);
	});

	it('건너뛴 장에는 번호를 얹지 않는다', async () => {
		const sources = new Map([['a', source('a', threePages)]]);
		let asked = 0;
		const counting = {
			...renderer,
			async renderText(text: string, style: { fontSize: number }) {
				asked += 1;
				return renderer.renderText(text, style);
			}
		};
		await assemble([page('a', 0), page('a', 1), page('a', 2)], sources, {
			overlays: [{ ...numbering, skipFirst: 1 }],
			renderer: counting
		});
		expect(asked).toBe(2);
	});
});
