/**
 * 페이지 미리보기 그림. 브라우저에서만 돈다.
 *
 * 원본이 아니라 **축소본**을 만든다. 200장짜리 문서의 원본 해상도를 전부 그리면
 * 메모리가 터지고, 미리보기에 그만한 해상도가 필요하지도 않다
 * (@client-first-processing §큰 입력 다루기).
 *
 * 보이는 것부터 그린다 — 200장을 다 기다린 뒤에야 화면이 뜨면 응답성 실패다.
 * 그래서 여기는 "한 장 그려 달라" 는 요청만 받고, 무엇을 언제 요청할지는
 * 화면(IntersectionObserver)이 정한다.
 */

import type { SourceFile } from './types';

/** 썸네일의 긴 변 길이(px). 카드 폭의 두 배 — 고밀도 화면에서도 흐리지 않다. */
const MAX_EDGE = 320;

/** pdfjs 는 무겁다. 처음 필요해질 때 한 번만 싣는다. */
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
	if (pdfjsPromise === null) {
		pdfjsPromise = (async () => {
			const pdfjs = await import('pdfjs-dist');
			/*
				워커를 번들에서 끌어온다. CDN 을 가리키면 오프라인에서 죽고,
				툴박스와 단독 배포가 서로 다른 버전을 집을 수 있다.
			*/
			const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
			pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
			return pdfjs;
		})();
	}
	return pdfjsPromise;
}

/**
 * 열어 둔 문서를 파일당 하나만 유지한다 — 페이지마다 다시 파싱하지 않는다.
 *
 * 문서가 아니라 **로딩 태스크**를 들고 있는다. 워커를 정리하는 `destroy()` 가
 * 거기 있고, 문서 프록시에는 없다 — 문서만 버리면 워커가 남는다.
 */
const openTasks = new Map<string, import('pdfjs-dist').PDFDocumentLoadingTask>();

async function openDocument(source: SourceFile) {
	let task = openTasks.get(source.id);
	if (task === undefined) {
		const pdfjs = await getPdfjs();
		/*
			pdfjs 는 넘긴 버퍼를 detach 한다. 원본은 조립할 때 다시 써야 하므로
			복사본을 넘긴다 — 이걸 빠뜨리면 두 번째 내보내기가 빈 문서를 만든다.
		*/
		task = pdfjs.getDocument({ data: source.bytes.slice(0) });
		openTasks.set(source.id, task);
	}
	return await task.promise;
}

/** 더 이상 쓰지 않는 문서를 닫는다. 파일을 빼면 반드시 부른다. */
export function releaseDocument(fileId: string): void {
	const task = openTasks.get(fileId);
	openTasks.delete(fileId);
	void task?.destroy().catch(() => undefined);
}

/** 전부 닫는다. 컴포넌트가 사라질 때 부른다. */
export function releaseAll(): void {
	for (const id of [...openTasks.keys()]) releaseDocument(id);
}

/** 그려진 썸네일. `url` 은 다 쓰면 반드시 해제한다. */
export interface Thumbnail {
	url: string;
	width: number;
	height: number;
}

/** 원본 크기를 긴 변 기준으로 줄이는 배율. */
function scaleFor(width: number, height: number): number {
	return Math.min(1, MAX_EDGE / Math.max(width, height));
}

async function toThumbnail(canvas: HTMLCanvasElement): Promise<Thumbnail> {
	const blob = await new Promise<Blob | null>((resolve) =>
		// 미리보기이므로 JPEG 로 충분하다. PNG 는 같은 그림에 몇 배를 쓴다.
		canvas.toBlob(resolve, 'image/jpeg', 0.8)
	);
	if (blob === null) throw new Error('썸네일을 만들지 못했습니다.');
	return { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
}

/**
 * PDF 한 장을 그린다.
 *
 * @param source PDF 원본.
 * @param pageIndex 0-기반 페이지 번호.
 * @returns 객체 URL 을 든 썸네일. 호출자가 {@link revokeThumbnail} 로 해제한다.
 */
export async function renderPdfPage(source: SourceFile, pageIndex: number): Promise<Thumbnail> {
	const doc = await openDocument(source);
	const page = await doc.getPage(pageIndex + 1);

	const base = page.getViewport({ scale: 1 });
	const viewport = page.getViewport({ scale: scaleFor(base.width, base.height) });

	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.floor(viewport.width));
	canvas.height = Math.max(1, Math.floor(viewport.height));

	const context = canvas.getContext('2d');
	if (context === null) throw new Error('캔버스를 열지 못했습니다.');

	await page.render({ canvas, canvasContext: context, viewport }).promise;
	page.cleanup();

	return await toThumbnail(canvas);
}

/** 이미지 원본을 같은 규격의 썸네일로 줄인다. */
export async function renderImage(source: SourceFile): Promise<Thumbnail> {
	const blob = new Blob([source.bytes], { type: source.imageMime ?? 'image/png' });
	const bitmap = await createImageBitmap(blob);

	const scale = scaleFor(bitmap.width, bitmap.height);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
	canvas.height = Math.max(1, Math.floor(bitmap.height * scale));

	const context = canvas.getContext('2d');
	if (context === null) throw new Error('캔버스를 열지 못했습니다.');
	context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();

	return await toThumbnail(canvas);
}

/** 원본 종류에 맞게 그린다. */
export async function renderThumbnail(source: SourceFile, pageIndex: number): Promise<Thumbnail> {
	return source.kind === 'image'
		? await renderImage(source)
		: await renderPdfPage(source, pageIndex);
}

/** 객체 URL 을 해제한다. 빠뜨리면 페이지를 옮길 때마다 메모리가 샌다. */
export function revokeThumbnail(thumbnail: Thumbnail | null): void {
	if (thumbnail !== null) URL.revokeObjectURL(thumbnail.url);
}
