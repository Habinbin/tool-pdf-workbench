<!--
	모든 툴이 같은 드롭 영역을 쓴다.

	전에는 툴마다 패딩·그림자·색이 제각각이었다(넷). 파일을 놓는다는 같은 행동이
	화면마다 다르게 보이면 사용자는 매번 다시 배워야 한다.
	색·모양은 계약 토큰에서 오므로 툴박스가 값을 바꾸면 전부 함께 바뀐다.
-->
<script lang="ts">
	import UploadIcon from '@lucide/svelte/icons/upload';

	import { isFileDrag } from '../drag-source.svelte';

	interface Props {
		/** `input[type=file]` 의 accept. */
		accept?: string;
		multiple?: boolean;
		/** 목록이 이미 있을 때 쓰는 좁은 형태. */
		compact?: boolean;
		label?: string;
		/** 형식·순서 같은 제약. 넓은 형태에서만 보인다. */
		hint?: string;
		onfiles: (files: File[]) => void;
	}

	let {
		accept,
		multiple = true,
		compact = false,
		label = '파일을 여기에 놓으세요',
		hint,
		onfiles
	}: Props = $props();

	let dragging = $state(false);
	let input: HTMLInputElement;

	/**
	 * 드롭·선택된 파일을 상위로 넘긴다.
	 *
	 * @param list 브라우저가 준 FileList. 비어 있으면 아무것도 하지 않는다.
	 */
	function emit(list: FileList | null): void {
		if (list === null || list.length === 0) return;
		onfiles(Array.from(list));
	}
</script>

<div
	role="presentation"
	class="wrap"
	class:compact
	ondragover={(e: DragEvent) => {
		// 카드를 끌어 순서를 바꾸는 중이면 반응하지 않는다.
		if (!isFileDrag(e)) return;
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={(e: DragEvent) => {
		e.preventDefault();
		dragging = false;
		emit(e.dataTransfer?.files ?? null);
	}}
>
	<input
		bind:this={input}
		type="file"
		{accept}
		{multiple}
		hidden
		onchange={(e) => {
			emit(e.currentTarget.files);
			e.currentTarget.value = '';
		}}
	/>

	<button type="button" class="zone" class:dragging onclick={() => input.click()}>
		<UploadIcon class="icon" />
		<span class="label">{label}</span>
	</button>
	{#if hint && !compact}<p class="hint">{hint}</p>{/if}
</div>

<style>
	/*
		드롭 영역에 테두리나 색 면을 두르지 않는다. 파일은 이 화면 어디에 놓아도
		받으므로, 네모를 그려 놓으면 "저 안에만 놓아야 한다"고 잘못 읽힌다.
		남기는 것은 무엇을 하면 되는지 알려주는 버튼 하나뿐이다.
	*/
	.wrap {
		display: flex;
		width: 100%;
		flex-direction: column;
		align-items: center;
		gap: var(--gap-l3);
	}

	.wrap.compact {
		align-items: stretch;
	}

	/* 주 행동이므로 채운 버튼 — 배경은 잉크, 글자는 그 위에 음각처럼 뚫린다. */
	.zone {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--gap-l3);
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background-color: var(--accent);
		padding: 11px 22px;
		font-family: var(--font);
		font-size: var(--text-body);
		font-weight: 600;
		color: var(--on-accent);
		cursor: pointer;
		transition:
			background-color 0.2s,
			border-color 0.2s,
			color 0.2s;
	}

	.zone:hover,
	.zone.dragging {
		background-color: var(--accent-hover);
	}

	/* 목록이 이미 있을 때의 보조 행동. 검은 버튼이 둘이면 무엇이 주인지 흐려진다. */
	.compact .zone {
		width: 100%;
		border-color: var(--line-strong);
		background-color: transparent;
		padding: 8px 16px;
		font-size: var(--text-body-sm);
		font-weight: 500;
		color: var(--ink-muted);
	}

	.compact .zone:hover,
	.compact .zone.dragging {
		border-color: var(--accent);
		background-color: transparent;
		color: var(--ink);
	}

	.zone :global(.icon) {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.hint {
		margin: 0;
		max-width: 56ch;
		text-align: center;
		font-size: var(--text-body-sm);
		color: var(--ink-muted);
	}
</style>
