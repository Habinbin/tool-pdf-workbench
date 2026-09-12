/**
 * "어떤 형태로 받지" 에 대한 답을 한 곳에 모은다.
 *
 * iLovePDF 는 분할·PDF→JPG·압축·암호걸기·PDF/A 를 **각각 다른 툴**로 둔다.
 * 엔드포인트 하나가 파일 하나를 처리하는 서버 구조에서 나온 형태이고, 그래서
 * "압축하고 암호 걸기" 는 두 번 왕복해야 한다. 여기서는 전부 한 설정의 필드다.
 *
 * 이 파일은 **계획만** 세운다 — 몇 개의 파일이 어떤 이름으로 나오는지. 실제로 굽는
 * 일은 `assemble.ts`(PDF)와 `render.ts`(JPG·텍스트)가 한다. 계획을 분리해 두면
 * 내보내기 전에 결과를 보여줄 수 있고(@tool-ux-principles §3), node 에서 검증된다.
 */

import { pageFileName, sanitize } from './naming';
import type { Protection } from './assemble';

/** 받을 형태. */
export type OutputFormat = 'pdf' | 'jpg' | 'text';

export interface ExportSettings {
	format: OutputFormat;
	/** 기본 파일명. 확장자 없이. */
	baseName: string;
	/**
	 * 한 장씩 따로 파일로 — iLovePDF 의 "Split PDF".
	 *
	 * `format: 'jpg'` 는 본래 장마다 한 장이므로 이 값과 무관하게 항상 쪼개진다.
	 */
	splitPages: boolean;
	/** 걸면 AES-256. PDF 일 때만 의미가 있다. */
	protection?: Protection;
	/** 장기보존용. PDF 일 때만, 그리고 암호와 함께 쓸 수 없다. */
	pdfa?: boolean;
}

/** 계획된 출력 하나. */
export interface PlannedFile {
	name: string;
	/** 이 파일에 들어갈 페이지의 0-기반 번호들. 작업대 순서 기준. */
	pageIndices: number[];
}

export interface ExportPlan {
	files: PlannedFile[];
	/** 파일이 둘 이상이면 ZIP 으로 묶는다. */
	zipped: boolean;
	/** ZIP 일 때의 이름. 아니면 `undefined`. */
	zipName?: string;
	/** 사용자에게 한 줄로 보여 줄 요약. */
	summary: string;
	/**
	 * 지금 설정으로는 내보낼 수 없는 이유. `undefined` 면 내보낼 수 있다.
	 *
	 * 버튼을 숨기지 않고 **비활성 + 이유 한 줄**로 쓴다 (@tool-ux-principles §2).
	 */
	blockedReason?: string;
}

const EXTENSION: Record<OutputFormat, string> = { pdf: 'pdf', jpg: 'jpg', text: 'txt' };

const FORMAT_LABEL: Record<OutputFormat, string> = { pdf: 'PDF', jpg: 'JPG', text: '텍스트' };

/** 이 형태로 받을 때 장마다 파일이 하나씩 나오는가. */
function alwaysSplits(format: OutputFormat): boolean {
	// JPG 는 한 장이 한 이미지다. 텍스트는 반대로 늘 한 파일로 이어 붙인다.
	return format === 'jpg';
}

/**
 * 설정과 장수로부터 무엇이 나올지 계산한다.
 *
 * @param pageCount 작업대에 남은 장수.
 * @param settings 사용자가 오른쪽 패널에서 고른 것.
 * @returns 파일 목록과 요약. 내보낼 수 없으면 `blockedReason` 이 채워진다.
 */
export function planExport(pageCount: number, settings: ExportSettings): ExportPlan {
	const base = sanitize(settings.baseName);
	const extension = EXTENSION[settings.format];
	const blockedReason = blockReason(pageCount, settings);

	if (pageCount === 0) {
		return { files: [], zipped: false, summary: '내보낼 페이지가 없습니다.', blockedReason };
	}

	const split = alwaysSplits(settings.format) || (settings.format === 'pdf' && settings.splitPages);

	const files: PlannedFile[] = split
		? Array.from({ length: pageCount }, (_, i) => ({
				name: pageFileName(base, i, pageCount, extension),
				pageIndices: [i]
			}))
		: [
				{
					name: `${base}.${extension}`,
					pageIndices: Array.from({ length: pageCount }, (_, i) => i)
				}
			];

	const zipped = files.length > 1;

	return {
		files,
		zipped,
		zipName: zipped ? `${base}.zip` : undefined,
		summary: summarize(files.length, pageCount, settings, zipped),
		blockedReason
	};
}

/** 내보낼 수 없는 이유. 없으면 `undefined`. */
function blockReason(pageCount: number, settings: ExportSettings): string | undefined {
	if (pageCount === 0) return '파일을 떨어뜨리면 내보낼 수 있습니다.';

	const hasPassword =
		(settings.protection?.userPassword ?? '') !== '' ||
		(settings.protection?.ownerPassword ?? '') !== '';

	// PDF/A 규격은 암호화를 금지한다. 툴이 두 옵션을 나란히 두었으니
	// 사용자가 둘 다 켤 수 있고, 그러면 여기서 막고 이유를 말해야 한다.
	if (settings.format === 'pdf' && settings.pdfa === true && hasPassword) {
		return 'PDF/A 는 암호를 허용하지 않습니다. 둘 중 하나만 선택하세요.';
	}

	if (settings.format !== 'pdf' && hasPassword) {
		return `${FORMAT_LABEL[settings.format]} 에는 암호를 걸 수 없습니다.`;
	}

	if (sanitize(settings.baseName) === '문서' && settings.baseName.trim() === '') {
		// 빈 이름은 막지 않는다 — 기본 이름으로 대체된다. 이유를 만들지 않는다.
		return undefined;
	}

	return undefined;
}

/** "3개 파일 · ZIP" 같은 한 줄. 내보내기 전에 결과를 보여 준다. */
function summarize(
	fileCount: number,
	pageCount: number,
	settings: ExportSettings,
	zipped: boolean
): string {
	const parts = [`${FORMAT_LABEL[settings.format]} ${fileCount}개`];

	if (fileCount !== pageCount) parts.push(`${pageCount}장`);
	if (zipped) parts.push('ZIP');
	if (settings.format === 'pdf' && settings.pdfa === true) parts.push('PDF/A');

	const hasPassword =
		(settings.protection?.userPassword ?? '') !== '' ||
		(settings.protection?.ownerPassword ?? '') !== '';
	if (settings.format === 'pdf' && hasPassword) parts.push('암호');

	return parts.join(' · ');
}
