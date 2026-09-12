import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { loadFile, sortForImport } from './load';

/** 노드에도 File 이 있다 (undici). 실제 드롭과 같은 경로를 쓴다. */
async function pdfFile(name: string, pageCount = 2, password?: string): Promise<File> {
	const doc = await PDFDocument.create();
	for (let i = 0; i < pageCount; i += 1) doc.addPage([300, 400]);
	if (password !== undefined) doc.encrypt({ userPassword: password, ownerPassword: password });
	const bytes = await doc.save();
	return new File([bytes.slice() as unknown as BlobPart], name, { type: 'application/pdf' });
}

const RED_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
);

describe('PDF', () => {
	it('페이지 수만큼 작업대에 올라간다', async () => {
		const result = await loadFile(await pdfFile('a.pdf', 3));
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') return;
		expect(result.pages).toHaveLength(3);
	});

	it('페이지 번호가 원본 순서 그대로다', async () => {
		const result = await loadFile(await pdfFile('a.pdf', 3));
		if (result.status !== 'ok') return;
		expect(result.pages.map((p) => p.pageIndex)).toEqual([0, 1, 2]);
	});

	it('모든 페이지가 같은 원본을 가리킨다 — 바이트를 복제하지 않는다', async () => {
		const result = await loadFile(await pdfFile('a.pdf', 3));
		if (result.status !== 'ok') return;
		expect(new Set(result.pages.map((p) => p.fileId)).size).toBe(1);
	});
});

describe('잠긴 파일 — 기능이 아니라 드롭 시점의 대응', () => {
	it('비밀번호 없이 열면 묻겠다고 알린다', async () => {
		const result = await loadFile(await pdfFile('locked.pdf', 2, 'hunter2'));
		expect(result.status).toBe('locked');
	});

	it('맞는 비밀번호를 주면 올라간다', async () => {
		const result = await loadFile(await pdfFile('locked.pdf', 2, 'hunter2'), 'hunter2');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') return;
		expect(result.pages).toHaveLength(2);
	});

	it('틀린 비밀번호는 다시 묻지 않고 틀렸다고 말한다', async () => {
		const result = await loadFile(await pdfFile('locked.pdf', 2, 'hunter2'), 'nope');
		expect(result.status).toBe('failed');
		if (result.status !== 'failed') return;
		expect(result.reason).toContain('비밀번호');
	});

	it('잠금을 푼 바이트로 올라간다 — 조립할 때 다시 묻지 않는다', async () => {
		const result = await loadFile(await pdfFile('locked.pdf', 2, 'hunter2'), 'hunter2');
		if (result.status !== 'ok') return;
		// 비밀번호 없이 다시 열려야 한다.
		const reopened = await PDFDocument.load(result.source.bytes);
		expect(reopened.getPageCount()).toBe(2);
	});
});

describe('오염된 입력 — 하나가 전체를 실패시키지 않는다', () => {
	it('빈 파일은 이유를 말하고 빠진다', async () => {
		const result = await loadFile(new File([], 'empty.pdf', { type: 'application/pdf' }));
		expect(result.status).toBe('failed');
		if (result.status !== 'failed') return;
		expect(result.reason).toContain('빈 파일');
	});

	it('PDF 가 아닌 파일은 무엇을 넣을 수 있는지 알린다', async () => {
		const result = await loadFile(new File(['hello'], 'note.txt', { type: 'text/plain' }));
		expect(result.status).toBe('failed');
		if (result.status !== 'failed') return;
		expect(result.reason).toContain('PDF');
	});

	it('손상된 PDF 는 손상을 의심하라고 말한다', async () => {
		const broken = new File(['%PDF-1.7\ngarbage'], 'broken.pdf', { type: 'application/pdf' });
		const result = await loadFile(broken);
		expect(result.status).toBe('failed');
		if (result.status !== 'failed') return;
		expect(result.reason).toContain('손상');
	});

	it('실패해도 예외를 던지지 않는다 — 나머지 파일이 계속 올라가야 한다', async () => {
		await expect(
			loadFile(new File(['x'], 'bad.pdf', { type: 'application/pdf' }))
		).resolves.toBeDefined();
	});
});

describe('이미지', () => {
	it('PNG 는 한 장짜리 페이지가 된다', async () => {
		const file = new File([RED_PNG.slice() as unknown as BlobPart], 'a.png', {
			type: 'image/png'
		});
		const result = await loadFile(file);
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') return;
		expect(result.pages).toHaveLength(1);
		expect(result.source.kind).toBe('image');
	});

	it('MIME 이 비어도 확장자로 알아본다', async () => {
		const file = new File([RED_PNG.slice() as unknown as BlobPart], 'a.PNG', { type: '' });
		const result = await loadFile(file);
		expect(result.status).toBe('ok');
	});

	it('image/jpg 를 image/jpeg 로 정규화한다', async () => {
		const file = new File([RED_PNG.slice() as unknown as BlobPart], 'a.jpg', {
			type: 'image/jpg'
		});
		const result = await loadFile(file);
		if (result.status !== 'ok') return;
		expect(result.source.imageMime).toBe('image/jpeg');
	});
});

describe('sortForImport', () => {
	it('10 이 2 뒤에 온다 — 순서를 묻지 않고 정한다', () => {
		const files = ['10.png', '2.png', '1.png'].map((n) => new File(['x'], n));
		expect(sortForImport(files).map((f) => f.name)).toEqual(['1.png', '2.png', '10.png']);
	});

	it('원본 배열을 바꾸지 않는다', () => {
		const files = ['b.pdf', 'a.pdf'].map((n) => new File(['x'], n));
		sortForImport(files);
		expect(files.map((f) => f.name)).toEqual(['b.pdf', 'a.pdf']);
	});
});
