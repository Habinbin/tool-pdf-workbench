/**
 * 작업대의 페이지들을 실제 PDF 바이트로 굽는다.
 *
 * 원칙 하나: **원본을 다시 그리지 않는다.** 페이지는 `copyPages` 로 옮기고 이미지는
 * 원본 바이트 그대로 삽입한다. 캔버스에 렌더해서 다시 넣으면 텍스트가 선택 불가능한
 * 그림이 되고 용량이 몇 배로 뛴다 — 병합했더니 검색이 안 된다는 사고가 거기서 난다.
 */

import type { PDFDocument } from '@cantoo/pdf-lib';

import { pdfLib } from './pdf-lib-lazy';
import { cropRect, numberLabel, placeInView, type Overlay } from './overlays';
import type { SourceFile, WorkPage } from './types';

/**
 * 글자를 그림으로 구워 주는 함수. 브라우저에서만 존재하므로 **주입받는다** —
 * 여기서 직접 부르면 이 파일이 캔버스에 묶여 node 에서 테스트할 수 없게 된다.
 */
export interface OverlayRenderer {
	renderText(
		text: string,
		style: { fontSize: number; color?: string; weight?: number }
	): Promise<{
		bytes: ArrayBuffer;
		width: number;
		height: number;
	} | null>;
	imageSize(bytes: ArrayBuffer, mime: string): Promise<{ width: number; height: number }>;
}

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
	/** 켜면 폼 입력값을 못 고치게 굳힌다 — iLovePDF 의 "PDF Forms" 중 평탄화. */
	flattenForms?: boolean;
	/** 모든 장에 얹을 것들. 순서대로 겹쳐 그린다. */
	overlays?: readonly Overlay[];
	/** 글자를 그림으로 굽는 수단. `overlays` 에 글자가 있으면 필요하다. */
	renderer?: OverlayRenderer;
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

	const { PDFDocument, degrees } = await pdfLib();
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

		const added = out.getPage(out.getPageCount() - 1);

		if (page.rotation !== 0) {
			// 사용자의 회전은 원본이 이미 가진 회전에 **더해진다**. 덮어쓰면
			// 가로로 스캔된 원본이 사용자가 손대는 순간 세로로 돌아가 버린다.
			added.setRotation(degrees((added.getRotation().angle + page.rotation) % 360));
		}

		for (const overlay of options.overlays ?? []) {
			await applyOverlay(out, added, overlay, index, pages.length, options.renderer);
		}

		options.onProgress?.(index + 1, pages.length);
	}

	if (options.flattenForms === true) {
		/*
			폼이 없는 문서에서도 부를 수 있어야 한다. 필드가 하나도 없으면
			라이브러리가 던지는 경우가 있어 감싼다 — 폼이 없다는 것은 실패가 아니다.
		*/
		try {
			out.getForm().flatten();
		} catch {
			// 굳힐 폼이 없었을 뿐이다.
		}
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

/**
 * 한 장에 하나를 얹는다.
 *
 * 글자가 필요한 오버레이는 `renderer` 없이는 조용히 건너뛴다 — 조립 자체를
 * 실패시키면 워터마크 문구를 지우지 않는 한 아무것도 내보낼 수 없게 된다.
 */
async function applyOverlay(
	out: PDFDocument,
	page: ReturnType<PDFDocument['getPage']>,
	overlay: Overlay,
	pageIndex: number,
	total: number,
	renderer: OverlayRenderer | undefined
): Promise<void> {
	const { degrees } = await pdfLib();

	/*
		자르기는 **원본 페이지 전체**를 기준으로 비율을 잰다.
	*/
	const mediaSize = page.getSize();

	if (overlay.kind === 'crop') {
		const rect = cropRect(mediaSize, overlay);
		/*
			CropBox 만 바꾼다. 내용은 그대로 두고 보이는 창을 좁히는 것이라
			되돌릴 수 있고, 잘라 낸 부분이 그림으로 굳지 않는다.
		*/
		page.setCropBox(rect.x, rect.y, rect.width, rect.height);
		return;
	}

	/*
		나머지는 **보이는 창**을 기준으로 놓는다.

		`getSize()` 는 MediaBox 를 돌려주므로, 여백을 잘라 낸 뒤에도 그 값으로
		앵커를 잡으면 쪽번호가 잘려 나간 띠 안에 찍혀 아예 보이지 않는다.
		실제로 그랬다 — 아래 10% 를 자르자 28pt 지점의 쪽번호가 사라졌다.
		CropBox 는 원점도 옮기므로 좌표에 그 시작점을 더해 준다.
	*/
	const view = page.getCropBox();

	if (overlay.kind === 'stamp') {
		const bytes = new Uint8Array(overlay.bytes);
		const mime = overlay.mime.toLowerCase();
		const image =
			mime === 'image/png'
				? await out.embedPng(bytes)
				: mime === 'image/jpeg' || mime === 'image/jpg'
					? await out.embedJpg(bytes)
					: null;
		if (image === null) return;

		const at = placeInView(view, { width: image.width, height: image.height }, overlay);
		page.drawImage(image, {
			x: at.x,
			y: at.y,
			width: at.width,
			height: at.height,
			opacity: at.opacity
		});
		return;
	}

	if (renderer === undefined) return;

	if (overlay.kind === 'numbering') {
		const label = numberLabel(pageIndex, total, overlay);
		if (label === null) return;

		const text = await renderer.renderText(label, { fontSize: overlay.fontSize });
		if (text === null) return;

		const image = await out.embedPng(new Uint8Array(text.bytes));
		const at = placeInView(view, text, overlay);
		page.drawImage(image, { x: at.x, y: at.y, width: at.width, height: at.height });
		return;
	}

	// 워터마크.
	const text = await renderer.renderText(overlay.text, {
		fontSize: overlay.fontSize,
		weight: 700
	});
	if (text === null) return;

	const image = await out.embedPng(new Uint8Array(text.bytes));
	const at = placeInView(view, text, overlay);
	page.drawImage(image, {
		x: at.x,
		y: at.y,
		width: at.width,
		height: at.height,
		rotate: degrees(at.angle),
		opacity: at.opacity
	});
}
