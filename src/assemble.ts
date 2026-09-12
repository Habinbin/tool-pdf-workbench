/**
 * 작업대의 페이지들을 실제 PDF 바이트로 굽는다.
 *
 * 원칙 하나: **원본을 다시 그리지 않는다.** 페이지는 `copyPages` 로 옮기고 이미지는
 * 원본 바이트 그대로 삽입한다. 캔버스에 렌더해서 다시 넣으면 텍스트가 선택 불가능한
 * 그림이 되고 용량이 몇 배로 뛴다 — 병합했더니 검색이 안 된다는 사고가 거기서 난다.
 */

import { PDFDocument, degrees } from '@cantoo/pdf-lib';

import type { SourceFile, WorkPage } from './types';

/** 내보내기에 걸 수 있는 암호. 둘 다 비면 암호를 걸지 않는다. */
export interface Protection {
	/** 문서를 열 때 묻는 비밀번호. */
	userPassword?: string;
	/** 권한 변경까지 허용하는 비밀번호. 비우면 `userPassword` 를 쓴다. */
	ownerPassword?: string;
}

export interface AssembleOptions {
	/** 걸면 AES-256 으로 암호화한다. */
	protection?: Protection;
	/** 켜면 장기보존용 PDF/A 구조를 덧붙인다. 암호화와 함께 쓸 수 없다. */
	pdfa?: boolean;
	/** 한 장 구울 때마다 불린다. 진행률 표시용 (@tool-ux-principles §2). */
	onProgress?: (done: number, total: number) => void;
}

/** 원본 파일을 id 로 찾을 수 있게 담아 둔 것. */
export type SourceIndex = ReadonlyMap<string, SourceFile>;

/** PDF/A 는 암호화를 금지한다 — 둘 다 켜면 파일이 규격을 어긴다. */
export class ConflictingOptionsError extends Error {
	constructor() {
		super('PDF/A 는 암호화를 허용하지 않습니다. 둘 중 하나만 선택하세요.');
		this.name = 'ConflictingOptionsError';
	}
}

/** 작업대에 남은 페이지가 없다. */
export class NoPagesError extends Error {
	constructor() {
		super('내보낼 페이지가 없습니다.');
		this.name = 'NoPagesError';
	}
}

/**
 * 이미지를 제 크기 그대로의 새 페이지로 넣는다.
 *
 * 페이지 크기를 이미지 픽셀 크기에 맞춘다 — A4 에 끼워 맞추면 여백이 생기거나
 * 잘린다. 종이에 맞추는 일은 인쇄할 때 뷰어가 한다.
 */
async function addImagePage(out: PDFDocument, source: SourceFile): Promise<void> {
	const bytes = new Uint8Array(source.bytes);
	const mime = (source.imageMime ?? '').toLowerCase();

	const image =
		mime === 'image/png'
			? await out.embedPng(bytes)
			: mime === 'image/jpeg' || mime === 'image/jpg'
				? await out.embedJpg(bytes)
				: null;

	if (image === null) throw new Error(`지원하지 않는 이미지 형식입니다: ${source.imageMime}`);

	const { width, height } = image.scale(1);
	out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
}

/**
 * 페이지 목록을 하나의 PDF 로 굽는다.
 *
 * @param pages 작업대 순서 그대로. 이 순서가 출력 순서다.
 * @param sources `pages` 가 가리키는 원본들.
 * @param options 암호·PDF/A·진행률.
 * @returns PDF 바이트.
 * @throws {NoPagesError} 페이지가 하나도 없을 때.
 * @throws {ConflictingOptionsError} PDF/A 와 암호를 동시에 켰을 때.
 */
export async function assemble(
	pages: readonly WorkPage[],
	sources: SourceIndex,
	options: AssembleOptions = {}
): Promise<Uint8Array> {
	if (pages.length === 0) throw new NoPagesError();

	const hasPassword =
		(options.protection?.userPassword ?? '') !== '' ||
		(options.protection?.ownerPassword ?? '') !== '';
	if (options.pdfa === true && hasPassword) throw new ConflictingOptionsError();

	const out = await PDFDocument.create();

	/*
		원본 문서를 파일당 한 번만 파싱한다. 20페이지짜리 PDF 의 페이지 20장을
		각각 파싱하면 같은 일을 20번 한다.
	*/
	const parsed = new Map<string, PDFDocument>();

	for (const [index, page] of pages.entries()) {
		const source = sources.get(page.fileId);
		if (source === undefined) throw new Error(`원본을 찾을 수 없습니다: ${page.fileId}`);

		if (source.kind === 'image') {
			await addImagePage(out, source);
		} else {
			let doc = parsed.get(page.fileId);
			if (doc === undefined) {
				doc = await PDFDocument.load(source.bytes);
				parsed.set(page.fileId, doc);
			}
			const [copied] = await out.copyPages(doc, [page.pageIndex]);
			out.addPage(copied);
		}

		if (page.rotation !== 0) {
			const added = out.getPage(out.getPageCount() - 1);
			// 사용자의 회전은 원본이 이미 가진 회전에 **더해진다**. 덮어쓰면
			// 가로로 스캔된 원본이 사용자가 손대는 순간 세로로 돌아가 버린다.
			added.setRotation(degrees((added.getRotation().angle + page.rotation) % 360));
		}

		options.onProgress?.(index + 1, pages.length);
	}

	if (options.pdfa === true) out.convertToPDFA();

	if (hasPassword) {
		const user = options.protection?.userPassword ?? '';
		const owner = options.protection?.ownerPassword ?? '';
		out.encrypt({
			userPassword: user === '' ? undefined : user,
			// 소유자 비밀번호를 따로 받지 않았으면 같은 것을 쓴다. 비워 두면
			// 라이브러리가 임의 값을 만들어, 사용자가 모르는 비밀번호가 생긴다.
			ownerPassword: owner === '' ? (user === '' ? undefined : user) : owner
		});
	}

	return await out.save();
}
