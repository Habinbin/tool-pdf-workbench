<!--
	툴의 뿌리. 본문만 그린다 — 헤더·제목·바깥 여백은 호스트의 것이다
	(@theme-contract §헤더는 호스트가 그린다, @layout-consistency).

	화면은 둘뿐이다: 비어 있으면 드롭존, 아니면 작업대. 모드 전환도 툴 목록도 없다.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';

	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';

	import Button from './ui/Button.svelte';
	import IconButton from './ui/IconButton.svelte';
	import DropOverlay from './ui/DropOverlay.svelte';
	import DropZone from './ui/DropZone.svelte';
	import SectionLabel from './ui/SectionLabel.svelte';
	import TextField from './ui/TextField.svelte';
	import ExportPanel from './components/ExportPanel.svelte';
	import OverlayPanel from './components/OverlayPanel.svelte';
	import PageGrid from './components/PageGrid.svelte';
	import { isFileDrag } from './drag-source.svelte';
	import { loadFile, sortForImport } from './load';
	import { planExport } from './export-plan';
	import { download, runExport } from './export-run';
	import { releaseAll, releaseDocument } from './thumbnails';
	import { Workbench } from './state.svelte';

	/*
		폰트는 툴이 직접 싣는다. 호스트에서 빌리면 툴박스 안에서와 단독 배포에서
		서로 다른 글꼴로 뜬다 — 실제로 그런 적이 있다 (@typography-and-language).
	*/
	import '@fontsource-variable/noto-sans-kr';
	import './ui/theme.css';

	const bench = new Workbench();

	/** 화면 위로 파일을 끌고 있는가. 드롭존 밖에서도 받는다. */
	let hovering = $state(false);
	let passwordInput = $state('');

	const ACCEPT = 'application/pdf,image/png,image/jpeg';

	async function importFiles(files: File[]) {
		if (files.length === 0) return;

		const queue = sortForImport(files);
		bench.loading = { done: 0, total: queue.length };

		for (const [index, file] of queue.entries()) {
			const outcome = await loadFile(file);

			if (outcome.status === 'ok') {
				bench.add(outcome.source, outcome.pages);
			} else if (outcome.status === 'locked') {
				// 한 번에 하나만 묻는다. 나머지는 계속 올라간다.
				bench.passwordPrompt = { file, retry: false };
				passwordInput = '';
			} else {
				bench.notify('error', `${outcome.fileName} — ${outcome.reason}`);
			}

			bench.loading = { done: index + 1, total: queue.length };
		}

		bench.loading = null;
	}

	async function submitPassword() {
		const prompt = bench.passwordPrompt;
		if (prompt === null) return;

		const outcome = await loadFile(prompt.file, passwordInput);
		if (outcome.status === 'ok') {
			bench.add(outcome.source, outcome.pages);
			bench.passwordPrompt = null;
			passwordInput = '';
		} else if (outcome.status === 'failed') {
			bench.passwordPrompt = { file: prompt.file, retry: true };
			passwordInput = '';
		}
	}

	function cancelPassword() {
		const prompt = bench.passwordPrompt;
		if (prompt !== null) bench.notify('info', `${prompt.file.name} 은(는) 빼고 진행합니다.`);
		bench.passwordPrompt = null;
		passwordInput = '';
	}

	async function doExport() {
		const plan = planExport(bench.pages.length, bench.exportSettings);
		if (plan.blockedReason !== undefined) return;

		bench.exporting = { done: 0, total: bench.pages.length };
		try {
			const result = await runExport(plan, bench.pages, bench.sources, bench.exportSettings, {
				overlays: bench.overlays,
				flattenForms: bench.flattenForms,
				onProgress: (done, total) => (bench.exporting = { done, total })
			});
			download(result);
		} catch (error) {
			bench.notify('error', error instanceof Error ? error.message : '내보내지 못했습니다.');
		} finally {
			bench.exporting = null;
		}
	}

	function removeFile(fileId: string) {
		bench.removeFile(fileId);
		releaseDocument(fileId);
	}

	onDestroy(releaseAll);
</script>

<svelte:window
	ondragover={(event) => {
		// 카드를 끌어 순서를 바꾸는 중에도 브라우저는 dataTransfer 에 Files 를 담는다.
		// 그대로 두면 재정렬 내내 업로드 안내가 떴다 사라진다.
		if (!isFileDrag(event)) return;
		event.preventDefault();
		hovering = true;
	}}
	ondragleave={(event) => {
		if (event.relatedTarget === null) hovering = false;
	}}
	ondrop={(event) => {
		// 페이지 재정렬 드래그는 파일이 없다 — 그건 그리드가 처리한다.
		const files = [...(event.dataTransfer?.files ?? [])];
		if (files.length === 0) return;
		event.preventDefault();
		hovering = false;
		void importFiles(files);
	}}
/>

<div class="tool-root">
	{#if bench.isEmpty}
		<div class="empty">
			<DropZone
				accept={ACCEPT}
				label="PDF 나 이미지를 여기에 놓으세요"
				hint="여러 개를 놓으면 순서대로 이어집니다. PNG · JPG 는 한 장짜리 페이지가 됩니다."
				onfiles={(files) => void importFiles(files)}
			/>
		</div>
	{:else}
		<div class="work">
			<main class="stage">
				<!-- 작업대 위의 도구 막대. 선택이 없으면 전체가 대상이다. -->
				<div class="toolbar">
					<SectionLabel>
						{bench.pages.length}장
						{#snippet trailing()}
							<span class="muted">
								{bench.selected.size > 0 ? `${bench.selected.size}장 선택됨` : '전체 대상'}
							</span>
						{/snippet}
					</SectionLabel>

					<div class="actions">
						<Button size="sm" onclick={() => bench.rotate(bench.targetIds(), 1)}>
							<RotateCwIcon size={14} /> 회전
						</Button>
						<Button
							size="sm"
							variant="danger"
							disabled={bench.selected.size === 0}
							onclick={() => bench.remove(bench.selected)}
						>
							<Trash2Icon size={14} /> 빼기
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onclick={() => (bench.selected.size > 0 ? bench.clearSelection() : bench.selectAll())}
						>
							{bench.selected.size > 0 ? '선택 해제' : '전체 선택'}
						</Button>
					</div>
				</div>

				<div class="scroll">
					<PageGrid {bench} />

					<div class="add">
						<DropZone
							accept={ACCEPT}
							compact
							label="파일 더 넣기"
							onfiles={(files) => void importFiles(files)}
						/>
					</div>
				</div>

				<!-- 어떤 파일에서 왔는지, 그리고 파일 단위로 뺄 수 있게 (@tool-ux-principles §4). -->
				<footer class="files">
					{#each bench.activeFiles as file (file.id)}
						<span class="chip">
							<span class="chip-name">{file.name}</span>
							<IconButton label="{file.name} 빼기" onclick={() => removeFile(file.id)}>
								<XIcon size={14} />
							</IconButton>
						</span>
					{/each}
				</footer>
			</main>

			<!--
				패널의 **자리는 고정**이고 내용만 바뀐다. 덧입히기를 켜면 그 설정이
				들어오고 끝내면 내보내기로 돌아온다 — 그래서 화면의 주 행동이 늘
				하나다 (@tool-ux-principles §2, @layout-consistency #3).
			-->
			<aside class="panel">
				{#if bench.view === 'export'}
					<ExportPanel {bench} onexport={() => void doExport()} />
				{:else}
					<OverlayPanel {bench} view={bench.view} />
				{/if}
			</aside>
		</div>
	{/if}

	<!-- 화면 어디에 놓아도 받는다는 것을 끌고 있는 동안 보여 준다. -->
	<DropOverlay open={hovering} hint="PDF · PNG · JPG 를 놓으면 뒤에 이어 붙습니다" />

	{#if bench.loading !== null}
		<p class="banner" role="status">
			파일 읽는 중 — {bench.loading.done} / {bench.loading.total}
		</p>
	{/if}

	{#each bench.notices as notice (notice.id)}
		<p class="banner" class:error={notice.tone === 'error'}>
			{notice.text}
			<IconButton label="닫기" onclick={() => bench.dismiss(notice.id)}>
				<XIcon size={14} />
			</IconButton>
		</p>
	{/each}

	{#if bench.passwordPrompt !== null}
		<div class="scrim">
			<div class="dialog" role="dialog" aria-modal="true" aria-label="비밀번호 입력">
				<h2>{bench.passwordPrompt.file.name}</h2>
				<p class="muted">
					{bench.passwordPrompt.retry
						? '비밀번호가 맞지 않습니다. 다시 입력해 주세요.'
						: '잠긴 PDF 입니다. 비밀번호를 입력하면 잠금을 풀어 올립니다.'}
				</p>
				<TextField bind:value={passwordInput} label="비밀번호" placeholder="비밀번호" />
				<div class="dialog-actions">
					<Button variant="ghost" onclick={cancelPassword}>이 파일 빼기</Button>
					<Button variant="primary" onclick={() => void submitPassword()}>열기</Button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.tool-root {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		background-color: var(--surface-raised);
	}

	.empty {
		display: grid;
		flex: 1;
		place-items: center;
		padding: var(--space-40);
	}

	.work {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.stage {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	/* 패널의 껍데기는 여기가 소유한다 — 내용이 바뀌어도 폭과 경계선이 움직이지 않는다. */
	.panel {
		display: flex;
		width: var(--pane-w);
		flex: none;
		flex-direction: column;
		border-left: 1px solid var(--line);
		background-color: var(--surface);
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-l2);
		border-bottom: 1px solid var(--line);
		padding: var(--space-12) var(--space-20);
	}

	.actions {
		display: flex;
		gap: var(--gap-l3);
	}

	.scroll {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--gap-l1);
		overflow-y: auto;
		padding: var(--space-20);
	}

	.add {
		max-width: 320px;
	}

	.files {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-l3);
		border-top: 1px solid var(--line);
		padding: var(--space-12) var(--space-20);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-l4);
		max-width: 220px;
		border-radius: var(--radius-pill);
		background-color: var(--surface);
		padding: 4px 4px 4px 10px;
		font-size: var(--text-caption);
		color: var(--ink-muted);
	}

	/* 긴 파일명이 칩을 밀지 않는다 (@failure-checklist-first §겹침·잘림). */
	.chip-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-l3);
		margin: 0;
		border-top: 1px solid var(--line);
		background-color: var(--surface);
		padding: var(--space-8) var(--space-20);
		font-size: var(--text-body-sm);
		color: var(--ink-muted);
	}

	.banner.error {
		color: var(--danger);
	}

	.muted {
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}

	.scrim {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background-color: var(--scrim);
		padding: var(--space-20);
	}

	.dialog {
		display: flex;
		width: min(380px, 100%);
		flex-direction: column;
		gap: var(--gap-l2);
		border-radius: var(--radius-panel);
		background-color: var(--surface);
		padding: var(--space-24);
	}

	.dialog h2 {
		margin: 0;
		overflow: hidden;
		font-size: var(--text-body);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dialog p {
		margin: 0;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--gap-l3);
	}
</style>
