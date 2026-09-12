/**
 * 떨어뜨린 파일을 작업대에 올린다.
 *
 * iLovePDF 의 "Unlock PDF" 와 "Repair PDF" 가 여기 녹아 있다. 그 둘을 별도 툴로
 * 두면 사용자가 자기 파일이 잠겼거나 깨졌다는 것을 **먼저 알아야** 쓸 수 있는데,
 * 대개는 모른다. 그래서 기능이 아니라 드롭 시점의 대응으로 만든다 — 잠겼으면
 * 비밀번호를 묻고, 깨졌으면 복구를 시도한다.
 *
 * 한 파일이 실패해도 나머지는 올라간다 (@failure-checklist-first §오염된 입력).
 */

import { PDFDocument } from '@cantoo/pdf-lib';

import { naturalCompare } from './naming';
import type { SourceFile, WorkPage } from './types';

/** 페이지로 넣을 수 있는 이미지 형식. pdf-lib 이 삽입할 수 있는 것만. */
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg']);

/** 한 파일을 올린 결과. */
export type LoadOutcome =
	| { status: 'ok'; source: SourceFile; pages: WorkPage[] }
	/** 비밀번호가 필요하다. 호출자가 물어보고 `password` 를 채워 다시 부른다. */
	| { status: 'locked'; fileName: string }
	/** 올릴 수 없다. `reason` 은 사용자에게 그대로 보여 줄 한 줄. */
	| { status: 'failed'; fileName: string; reason: string };

let counter = 0;

/** 한 세션 안에서만 유일하면 된다. 저장되지 않으므로 UUID 일 필요가 없다. */
function nextId(prefix: string): string {
	counter += 1;
	return `${prefix}${counter}`;
}

/** 브라우저가 MIME 을 안 주는 경우가 있어 확장자도 본다. */
function imageMimeOf(file: File): string | undefined {
	const declared = file.type.toLowerCase();
	if (IMAGE_MIME.has(declared)) return declared === 'image/jpg' ? 'image/jpeg' : declared;

	const lower = file.name.toLowerCase();
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	return undefined;
}

function looksLikePdf(file: File, bytes: ArrayBuffer): boolean {
	if (file.type.toLowerCase() === 'application/pdf') return true;
	if (file.name.toLowerCase().endsWith('.pdf')) return true;
	// 확장자도 MIME 도 못 믿을 때는 매직 넘버를 본다.
	const head = new Uint8Array(bytes.slice(0, 5));
	return String.fromCharCode(...head) === '%PDF-';
}

/**
 * 파일 하나를 올린다.
 *
 * @param file 사용자가 떨어뜨린 것.
 * @param password 잠긴 파일에 다시 시도할 때의 비밀번호.
 * @returns 성공하면 원본과 그 페이지들, 아니면 이유.
 */
export async function loadFile(file: File, password?: string): Promise<LoadOutcome> {
	if (file.size === 0) {
		return { status: 'failed', fileName: file.name, reason: '빈 파일입니다.' };
	}

	const bytes = await file.arrayBuffer();
	const imageMime = imageMimeOf(file);

	if (imageMime !== undefined) {
		const source: SourceFile = {
			id: nextId('f'),
			name: file.name,
			bytes,
			kind: 'image',
			imageMime
		};
		return {
			status: 'ok',
			source,
			pages: [{ id: nextId('p'), fileId: source.id, pageIndex: 0, rotation: 0 }]
		};
	}

	if (!looksLikePdf(file, bytes)) {
		return {
			status: 'failed',
			fileName: file.name,
			reason: 'PDF 나 이미지(PNG · JPG)만 넣을 수 있습니다.'
		};
	}

	let doc: PDFDocument;
	try {
		doc = await PDFDocument.load(bytes, { password });
	} catch (error) {
		if (isPasswordProblem(error)) {
			// 비밀번호를 이미 받아 본 뒤라면 그게 틀린 것이다.
			return password === undefined
				? { status: 'locked', fileName: file.name }
				: { status: 'failed', fileName: file.name, reason: '비밀번호가 맞지 않습니다.' };
		}
		return {
			status: 'failed',
			fileName: file.name,
			reason: '읽을 수 없는 PDF 입니다. 파일이 손상되었을 수 있습니다.'
		};
	}

	/*
		`load` 가 통과해도 안심할 수 없다. 이 라이브러리는 잘린 PDF 를 관대하게
		받아 준 뒤 페이지 트리를 읽는 순간 터진다 — 여기를 감싸지 않으면 손상 파일
		하나가 앱 전체를 죽인다 (@failure-checklist-first §오염된 입력).
	*/
	let pageCount: number;
	try {
		pageCount = doc.getPageCount();
	} catch {
		return {
			status: 'failed',
			fileName: file.name,
			reason: '읽을 수 없는 PDF 입니다. 파일이 손상되었을 수 있습니다.'
		};
	}

	if (pageCount === 0) {
		return { status: 'failed', fileName: file.name, reason: '페이지가 없는 PDF 입니다.' };
	}

	/*
		잠겨 있던 문서는 잠금을 푼 바이트로 갈아 끼운다 — 이것이 "Unlock PDF" 가
		하는 일의 전부다.

		`doc.save()` 로는 안 된다. 암호 사전이 문서에 그대로 남아 있어 다시 암호화된
		바이트가 나오고, 조립할 때 비밀번호를 또 물어야 한다. 새 문서로 페이지를
		복사해 옮겨야 실제로 풀린다.
	*/
	let usableBytes = bytes;
	if (password !== undefined) {
		const unlocked = await PDFDocument.create();
		const copied = await unlocked.copyPages(doc, doc.getPageIndices());
		for (const page of copied) unlocked.addPage(page);
		usableBytes = (await unlocked.save()).slice().buffer as ArrayBuffer;
	}

	const source: SourceFile = { id: nextId('f'), name: file.name, bytes: usableBytes, kind: 'pdf' };
	const pages: WorkPage[] = Array.from({ length: pageCount }, (_, index) => ({
		id: nextId('p'),
		fileId: source.id,
		pageIndex: index,
		rotation: 0
	}));

	return { status: 'ok', source, pages };
}

/** 라이브러리가 던지는 암호 관련 오류인지. 메시지로 판정할 수밖에 없다. */
function isPasswordProblem(error: unknown): boolean {
	const name = error instanceof Error ? error.name : '';
	const message = error instanceof Error ? error.message : String(error);
	return (
		name === 'EncryptedPDFError' ||
		/encrypt|password|decrypt/i.test(message) ||
		/encrypt|password/i.test(name)
	);
}

/**
 * 여러 파일을 **사람이 기대하는 순서**로 올린다.
 *
 * 브라우저가 주는 `FileList` 순서는 정렬 순서가 아니며, 그대로 쓰면 `10.png` 가
 * `2.png` 앞에 온다. 그래서 순서를 묻지 않고 여기서 정한다 (@tool-ux-principles §1).
 */
export function sortForImport(files: readonly File[]): File[] {
	return [...files].sort((a, b) => naturalCompare(a.name, b.name));
}
