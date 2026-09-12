/**
 * 작업대의 상태. 화면이 읽고 쓰는 단 하나의 원천.
 *
 * 조작은 전부 `pages.ts` 의 순수 함수에 위임한다 — 여기서 배열을 직접 주무르면
 * 그 로직은 테스트되지 않는다.
 */

import { moveToGap, nudge, removeFile, removePages, rotatePages } from './pages';
import { baseNameFrom } from './naming';
import type { GapIndex } from './pages';
import type { ExportSettings, OutputFormat } from './export-plan';
import type { Anchor, NumberFormat, Overlay } from './overlays';
import type { SourceFile, WorkPage } from './types';

/** 오른쪽 패널이 지금 무엇을 보여 주는가. 자리는 고정, 내용만 바뀐다. */
export type PanelView = 'export' | 'numbering' | 'watermark' | 'stamp' | 'crop';

/** 사용자에게 보여 줄 한 줄짜리 알림. 스스로 사라지지 않는다 — 사용자가 닫는다. */
export interface Notice {
	id: string;
	tone: 'error' | 'info';
	text: string;
}

/** 비밀번호를 기다리는 파일. 한 번에 하나만 묻는다. */
export interface PasswordPrompt {
	file: File;
	/** 앞서 틀린 적이 있으면 그 사실을 보여 준다. */
	retry: boolean;
}

let noticeCounter = 0;

export class Workbench {
	/** 올라온 원본들. 페이지가 이걸 id 로 가리킨다. */
	sources = $state<Map<string, SourceFile>>(new Map());

	/** 작업대에 놓인 순서. **이 순서가 곧 출력 순서다.** */
	pages = $state<WorkPage[]>([]);

	/** 선택된 페이지 id. 회전·삭제가 이것을 대상으로 한다. */
	selected = $state<Set<string>>(new Set());

	notices = $state<Notice[]>([]);

	/** 비밀번호를 기다리는 파일. `null` 이면 묻는 중이 아니다. */
	passwordPrompt = $state<PasswordPrompt | null>(null);

	/** 파일을 읽는 중인가. 진행률은 n / m 으로 보여 준다. */
	loading = $state<{ done: number; total: number } | null>(null);

	/** 내보내는 중인가. */
	exporting = $state<{ done: number; total: number } | null>(null);

	/* ── 오른쪽 패널 ─────────────────────────────── */

	/**
	 * 패널이 보여 주는 것. 덧입히기를 켜면 그 설정으로 바뀌고, 끝내면
	 * 내보내기로 돌아온다 — 그래서 주 행동이 늘 하나다 (@tool-ux-principles §2).
	 */
	view = $state<PanelView>('export');

	/* ── 덧입히기 ────────────────────────────────── */

	numberingOn = $state(false);
	numberAnchor = $state<Anchor>('bottom-center');
	numberFormat = $state<NumberFormat>('plain');
	numberStartAt = $state(1);
	numberSkipFirst = $state(0);

	watermarkOn = $state(false);
	watermarkText = $state('');
	watermarkOpacity = $state(0.15);
	watermarkAngle = $state(45);

	stampOn = $state(false);
	stampBytes = $state<ArrayBuffer | null>(null);
	stampMime = $state('image/png');
	stampName = $state('');
	stampAnchor = $state<Anchor>('bottom-right');
	stampWidth = $state(0.2);

	cropOn = $state(false);
	cropTop = $state(0);
	cropRight = $state(0);
	cropBottom = $state(0);
	cropLeft = $state(0);

	flattenForms = $state(false);

	/** 지금 켜져 있는 덧입히기들. 그리는 순서대로. */
	get overlays(): Overlay[] {
		const list: Overlay[] = [];

		// 자르기를 먼저 — 좁아진 창 안에 나머지를 얹어야 잘려 나가지 않는다.
		if (this.cropOn) {
			list.push({
				kind: 'crop',
				top: this.cropTop,
				right: this.cropRight,
				bottom: this.cropBottom,
				left: this.cropLeft
			});
		}

		if (this.watermarkOn && this.watermarkText.trim() !== '') {
			list.push({
				kind: 'watermark',
				text: this.watermarkText,
				opacity: this.watermarkOpacity,
				angle: this.watermarkAngle,
				// 글자 수가 많을수록 작게 — 긴 문구가 페이지를 넘지 않게.
				fontSize: Math.max(18, 72 - this.watermarkText.trim().length * 3)
			});
		}

		if (this.stampOn && this.stampBytes !== null) {
			list.push({
				kind: 'stamp',
				bytes: this.stampBytes,
				mime: this.stampMime,
				anchor: this.stampAnchor,
				widthRatio: this.stampWidth,
				opacity: 1
			});
		}

		// 쪽번호는 맨 위 — 워터마크에 가리면 읽을 수 없다.
		if (this.numberingOn) {
			list.push({
				kind: 'numbering',
				anchor: this.numberAnchor,
				format: this.numberFormat,
				startAt: this.numberStartAt,
				skipFirst: this.numberSkipFirst,
				fontSize: 10
			});
		}

		return list;
	}

	/** 덧입히기 중 실제로 켜진 것의 수. 목록에 배지로 보여 준다. */
	get activeOverlayCount(): number {
		return this.overlays.length;
	}

	/* ── 내보내기 ────────────────────────────────── */

	format = $state<OutputFormat>('pdf');
	splitPages = $state(false);
	pdfa = $state(false);
	protect = $state(false);
	password = $state('');

	/** 사용자가 손댔는지. 손대기 전에는 입력 파일을 따라간다. */
	#baseNameTouched = $state(false);
	#baseName = $state('');

	get baseName(): string {
		return this.#baseNameTouched ? this.#baseName : baseNameFrom(this.#sourceNames());
	}

	set baseName(value: string) {
		this.#baseNameTouched = true;
		this.#baseName = value;
	}

	/** 오른쪽 패널이 만든 설정 한 덩어리. */
	get exportSettings(): ExportSettings {
		return {
			format: this.format,
			baseName: this.baseName,
			splitPages: this.splitPages,
			pdfa: this.format === 'pdf' && this.pdfa,
			protection:
				this.format === 'pdf' && this.protect && this.password !== ''
					? { userPassword: this.password }
					: undefined
		};
	}

	/** 파일이 떨어진 순서대로의 이름들. 기본 출력 이름을 여기서 끌어온다. */
	#sourceNames(): string[] {
		const seen: string[] = [];
		for (const page of this.pages) {
			const source = this.sources.get(page.fileId);
			if (source !== undefined && !seen.includes(source.name)) seen.push(source.name);
		}
		return seen;
	}

	/** 작업대에 남아 있는 원본들 — 페이지가 전부 지워진 파일은 빠진다. */
	get activeFiles(): SourceFile[] {
		const ids = new Set(this.pages.map((page) => page.fileId));
		return [...this.sources.values()].filter((source) => ids.has(source.id));
	}

	get isEmpty(): boolean {
		return this.pages.length === 0;
	}

	/* ── 페이지 조작 ──────────────────────────────── */

	add(source: SourceFile, pages: WorkPage[]): void {
		this.sources.set(source.id, source);
		// Map 은 자체로 반응하지 않는다 — 새 Map 으로 갈아 끼운다.
		this.sources = new Map(this.sources);
		this.pages = [...this.pages, ...pages];
	}

	moveToGap(from: number, gap: GapIndex): void {
		this.pages = moveToGap(this.pages, from, gap);
	}

	nudge(index: number, delta: -1 | 1): void {
		this.pages = nudge(this.pages, index, delta);
	}

	remove(ids: ReadonlySet<string>): void {
		this.pages = removePages(this.pages, ids);
		this.#dropSelection(ids);
	}

	removeFile(fileId: string): void {
		const gone = new Set(
			this.pages.filter((page) => page.fileId === fileId).map((page) => page.id)
		);
		this.pages = removeFile(this.pages, fileId);
		this.#dropSelection(gone);
	}

	rotate(ids: ReadonlySet<string>, quarterTurns: number): void {
		this.pages = rotatePages(this.pages, ids, quarterTurns);
	}

	/** 선택이 비어 있으면 전체를 대상으로 본다 — 아무것도 안 고르고 회전을 누르면 전부 돈다. */
	targetIds(): Set<string> {
		if (this.selected.size > 0) return new Set(this.selected);
		return new Set(this.pages.map((page) => page.id));
	}

	toggleSelected(id: string): void {
		const next = new Set(this.selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		this.selected = next;
	}

	clearSelection(): void {
		this.selected = new Set();
	}

	selectAll(): void {
		this.selected = new Set(this.pages.map((page) => page.id));
	}

	#dropSelection(ids: ReadonlySet<string>): void {
		const next = new Set(this.selected);
		for (const id of ids) next.delete(id);
		this.selected = next;
	}

	/* ── 알림 ────────────────────────────────────── */

	notify(tone: Notice['tone'], text: string): void {
		noticeCounter += 1;
		this.notices = [...this.notices, { id: `n${noticeCounter}`, tone, text }];
	}

	dismiss(id: string): void {
		this.notices = this.notices.filter((notice) => notice.id !== id);
	}

	clearNotices(): void {
		this.notices = [];
	}

	/** 전부 비운다. 파괴적이므로 호출 쪽에서 확인을 받는다 (@tool-ux-principles §4). */
	reset(): void {
		this.sources = new Map();
		this.pages = [];
		this.selected = new Set();
		this.notices = [];
		this.passwordPrompt = null;
		this.#baseNameTouched = false;
		this.#baseName = '';
		this.view = 'export';
	}
}
