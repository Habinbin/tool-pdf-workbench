/**
 * 계획을 실제 파일로 굽는다. 브라우저에서 끝난다 (@client-first-processing).
 *
 * `export-plan.ts` 가 "무엇이 나오는가" 를 정하고 여기가 그것을 만든다. 둘을
 * 나눠 두면 계획은 node 에서 검증되고, 화면은 굽기 전에 결과를 보여 줄 수 있다.
 */

import JSZip from 'jszip';

import { assemble } from './assemble';
import type { SourceIndex } from './assemble';
import type { ExportPlan, ExportSettings } from './export-plan';
import { renderThumbnail } from './thumbnails';
import type { WorkPage } from './types';

/** 내려받을 준비가 된 결과. */
export interface ExportResult {
	blob: Blob;
	fileName: string;
}

export interface RunOptions {
	onProgress?: (done: number, total: number) => void;
}

/**
 * 계획대로 굽는다.
 *
 * @param plan {@link planExport} 가 세운 것.
 * @param pages 작업대 순서 그대로.
 * @param sources 원본들.
 * @param settings 형식·암호 등.
 * @returns 파일 하나. 계획이 여러 개면 ZIP 으로 묶여 나온다.
 */
export async function runExport(
	plan: ExportPlan,
	pages: readonly WorkPage[],
	sources: SourceIndex,
	settings: ExportSettings,
	options: RunOptions = {}
): Promise<ExportResult> {
	if (plan.blockedReason !== undefined) throw new Error(plan.blockedReason);

	const total = plan.files.reduce((sum, file) => sum + file.pageIndices.length, 0);
	let done = 0;
	const step = () => {
		done += 1;
		options.onProgress?.(done, total);
	};

	const built: { name: string; data: Blob }[] = [];

	for (const file of plan.files) {
		const slice = file.pageIndices.map((index) => pages[index]);

		if (settings.format === 'pdf') {
			const bytes = await assemble(slice, sources, {
				protection: settings.protection,
				pdfa: settings.pdfa,
				onProgress: step
			});
			built.push({
				name: file.name,
				data: new Blob([bytes.slice() as unknown as BlobPart], { type: 'application/pdf' })
			});
		} else if (settings.format === 'jpg') {
			// JPG 는 장마다 하나이므로 slice 는 언제나 한 장이다.
			const page = slice[0];
			const source = sources.get(page.fileId);
			if (source === undefined) throw new Error(`원본을 찾을 수 없습니다: ${page.fileId}`);
			const thumbnail = await renderThumbnail(source, page.pageIndex);
			const data = await (await fetch(thumbnail.url)).blob();
			URL.revokeObjectURL(thumbnail.url);
			built.push({ name: file.name, data });
			step();
		} else {
			const text = await extractText(slice, sources, step);
			built.push({ name: file.name, data: new Blob([text], { type: 'text/plain' }) });
		}
	}

	if (!plan.zipped) return { blob: built[0].data, fileName: built[0].name };

	const zip = new JSZip();
	for (const file of built) zip.file(file.name, file.data);
	return {
		blob: await zip.generateAsync({ type: 'blob' }),
		fileName: plan.zipName ?? 'export.zip'
	};
}

/** 페이지의 글자를 순서대로 이어 붙인다. 장 사이는 빈 줄로 나눈다. */
async function extractText(
	pages: readonly WorkPage[],
	sources: SourceIndex,
	step: () => void
): Promise<string> {
	const pdfjs = await import('pdfjs-dist');
	const chunks: string[] = [];
	const opened = new Map<string, import('pdfjs-dist').PDFDocumentLoadingTask>();

	try {
		for (const [index, page] of pages.entries()) {
			const source = sources.get(page.fileId);
			if (source === undefined || source.kind === 'image') {
				// 이미지에는 글자가 없다. OCR 은 이 툴의 범위 밖이다.
				chunks.push(`--- ${index + 1}쪽 (이미지) ---`);
				step();
				continue;
			}

			let task = opened.get(page.fileId);
			if (task === undefined) {
				// pdfjs 가 버퍼를 detach 하므로 복사본을 넘긴다.
				task = pdfjs.getDocument({ data: source.bytes.slice(0) });
				opened.set(page.fileId, task);
			}

			const doc = await task.promise;
			const parsed = await doc.getPage(page.pageIndex + 1);
			const content = await parsed.getTextContent();
			const line = content.items
				.map((item) => ('str' in item ? item.str : ''))
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();
			parsed.cleanup();

			chunks.push(`--- ${index + 1}쪽 ---\n${line}`);
			step();
		}
	} finally {
		// 워커를 정리하는 destroy() 는 문서가 아니라 로딩 태스크에 있다.
		for (const task of opened.values()) void task.destroy();
	}

	return chunks.join('\n\n');
}

/** 브라우저에 내려받기를 시킨다. */
export function download(result: ExportResult): void {
	const url = URL.createObjectURL(result.blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = result.fileName;
	anchor.click();
	// 클릭 직후 해제하면 일부 브라우저가 받기를 시작하기 전에 사라진다.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
