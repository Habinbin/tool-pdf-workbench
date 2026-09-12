<!--
	모든 툴이 같은 대화상자를 쓴다.

	네이티브 `<dialog showModal>` 위에 얹는다 — 포커스 가두기, ESC 닫기, 바깥 클릭
	차단을 브라우저가 이미 한다. 직접 만들면 키보드로 빠져나갈 수 없는 상자가 된다.

	본문 위에 겹치므로 화면 골격(사이드바 폭·헤더 높이)을 건드리지 않는다
	— 규약: rules/layout-consistency.md
-->
<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		/** 상자의 정체. 스크린리더가 읽는 이름이기도 하다. */
		title: string;
		/** 제목 아래 한 줄 설명. 없으면 그리지 않는다. */
		description?: string;
		onclose: () => void;
		children: Snippet;
	}

	let { open, title, description, onclose, children }: Props = $props();

	let element = $state<HTMLDialogElement | null>(null);

	// `open` 속성을 직접 쓰지 않는다 — showModal() 로 열어야 포커스가 갇힌다.
	$effect(() => {
		const dialog: HTMLDialogElement | null = element;
		if (dialog === null) return;
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});
</script>

<dialog bind:this={element} aria-label={title} {onclose} oncancel={onclose}>
	<!--
		<header> 가 아니라 <div> 다. <dialog> 안의 <header> 는 접근성 트리에서
		banner 랜드마크로 노출될 수 있어, 페이지에 banner 가 둘이 된다.
	-->
	<div class="titlebar">
		<div class="identity">
			<h2>{title}</h2>
			{#if description}<p>{description}</p>{/if}
		</div>
		<button type="button" class="close" onclick={onclose} aria-label="닫기">
			<XIcon class="icon" />
		</button>
	</div>
	<div class="body">{@render children()}</div>
</dialog>

<style>
	dialog {
		/*
		 * 모달 <dialog> 는 브라우저 기본값 `margin: auto` 로 가운데 선다. 호스트의
		 * CSS 초기화가 모든 요소에 `margin: 0` 을 걸면 그 정렬이 죽어 좌상단에 붙는다
		 * — 규약: rules/theme-contract.md #5 (호스트 CSS 로부터 자기를 지킨다)
		 */
		margin: auto;
		width: min(560px, calc(100vw - 32px));
		max-height: min(720px, calc(100vh - 64px));
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background-color: var(--surface);
		color: var(--ink);
		overflow: hidden;
	}

	dialog:not([open]) {
		display: none;
	}

	dialog::backdrop {
		background-color: var(--scrim);
	}

	.titlebar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--gap-l2);
		border-bottom: 1px solid var(--line);
		padding: var(--gap-l2) var(--gap-l1);
	}

	.identity {
		display: flex;
		flex-direction: column;
		/* 제목과 그 설명은 한 덩어리다 — 가장 좁은 단. */
		gap: var(--gap-l4);
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: var(--text-body);
		font-weight: 600;
	}

	.identity p {
		margin: 0;
		font-size: var(--text-caption);
		color: var(--ink-muted);
	}

	.close {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		padding: 6px;
		color: var(--ink-faint);
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.close:hover {
		background-color: var(--surface-sunken);
		color: var(--ink);
	}

	.close :global(.icon) {
		width: 16px;
		height: 16px;
	}

	.body {
		display: flex;
		flex-direction: column;
		/* 상자 안의 큰 구획 사이 — 사다리의 가장 넓은 단. */
		gap: var(--gap-l1);
		max-height: calc(min(720px, 100vh - 64px) - 64px);
		overflow-y: auto;
		padding: var(--gap-l1);
	}
</style>
