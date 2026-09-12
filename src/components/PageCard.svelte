<!--
	작업대의 한 장.

	썸네일은 **화면에 들어올 때** 그린다. 200장을 한꺼번에 그리면 드롭 직후 몇 초간
	아무것도 안 보이고, 그동안 브라우저가 얼어붙는다 (@failure-checklist-first §응답성).
-->
<script lang="ts">
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import XIcon from '@lucide/svelte/icons/x';

	import IconButton from '../ui/IconButton.svelte';
	import { renderThumbnail, revokeThumbnail, type Thumbnail } from '../thumbnails';
	import type { SourceFile, WorkPage } from '../types';

	interface Props {
		page: WorkPage;
		source: SourceFile | undefined;
		/** 1-기반 표시 번호. 순서가 바뀌면 즉시 갱신된다 (@reorder-affordance #6). */
		number: number;
		selected: boolean;
		/** 끌고 있는 중인가. 목록에서 지우지 않고 흐리게 둔다 (@reorder-affordance #5). */
		dragging: boolean;
		ontoggle: () => void;
		onrotate: () => void;
		onremove: () => void;
	}

	let { page, source, number, selected, dragging, ontoggle, onrotate, onremove }: Props = $props();

	let card = $state<HTMLElement | null>(null);
	let thumbnail = $state<Thumbnail | null>(null);
	let failed = $state(false);
	let visible = $state(false);

	/* 화면 근처에 들어오면 그리기 시작한다. 한 번 보이면 다시 관찰하지 않는다. */
	$effect(() => {
		const element = card;
		if (element === null || visible) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					visible = true;
					observer.disconnect();
				}
			},
			// 한 화면 앞질러 그려 두면 스크롤이 빈 칸을 지나가지 않는다.
			{ rootMargin: '400px' }
		);
		observer.observe(element);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!visible || source === undefined) return;

		let alive = true;
		let made: Thumbnail | null = null;

		void renderThumbnail(source, page.pageIndex)
			.then((result) => {
				if (!alive) {
					revokeThumbnail(result);
					return;
				}
				made = result;
				thumbnail = result;
			})
			.catch(() => {
				if (alive) failed = true;
			});

		return () => {
			alive = false;
			revokeThumbnail(made);
			thumbnail = null;
		};
	});
</script>

<article bind:this={card} class="card" class:selected class:dragging aria-label="{number}번 페이지">
	<!--
		그림 전체가 선택 토글이다. 카드 안에 버튼이 셋이므로, 선택만 큰 면적을
		차지하게 해서 어느 것이 주 동작인지 손이 먼저 알게 한다.
	-->
	<button type="button" class="sheet" onclick={ontoggle} aria-pressed={selected}>
		{#if thumbnail !== null}
			<img src={thumbnail.url} alt="" draggable="false" />
		{:else if failed}
			<span class="placeholder">미리보기 없음</span>
		{:else}
			<span class="placeholder" aria-hidden="true"></span>
		{/if}
	</button>

	<div class="bar">
		<span class="number">{number}</span>
		<span class="spacer"></span>
		<IconButton label="90도 회전" onclick={onrotate}>
			<RotateCwIcon size={14} />
		</IconButton>
		<IconButton label="이 장 빼기" tone="danger" onclick={onremove}>
			<XIcon size={14} />
		</IconButton>
	</div>
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background-color: var(--surface);
		padding: var(--space-8);
		/* 막대가 카드를 밀지 않도록, 카드 자체는 자리를 고정한다. */
		transition: border-color 120ms ease;
	}

	.card.selected {
		border-color: var(--accent);
		/*
		   깊이를 만드는 그림자가 아니라 **안쪽 헤어라인**이다. 테두리만으로는
		   1px 이라 선택 여부가 멀리서 안 읽히는데, 테두리를 2px 로 키우면
		   카드가 1px 씩 움직인다. inset 은 자리를 차지하지 않는다.
		*/
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	/* 끌고 있는 장은 흐리게 남긴다 — 어디서 왔는지 보여야 한다. */
	.card.dragging {
		opacity: 0.4;
	}

	.sheet {
		display: grid;
		place-items: center;
		aspect-ratio: 1 / 1.414;
		width: 100%;
		overflow: hidden;
		border: none;
		border-radius: calc(var(--radius-panel) - 4px);
		/* 종이는 테마가 어두워져도 희다 — 출력물이 흰 종이이기 때문이다. */
		background-color: var(--paper);
		padding: 0;
		cursor: pointer;
	}

	.sheet:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.placeholder {
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
		min-height: 24px;
	}

	.spacer {
		flex: 1;
	}

	.number {
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		color: var(--ink-muted);
	}
</style>
