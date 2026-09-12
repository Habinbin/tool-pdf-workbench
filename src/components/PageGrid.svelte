<!--
	페이지 그리드 — 이 툴의 본문.

	병합·정렬·삭제·회전이 전부 여기서 손으로 일어난다. 고를 목록이 없다.

	삽입 표시는 **항목이 아니라 틈**에 그린다 (@reorder-affordance #1). 대상 카드에
	테두리만 켜면 "이 카드와 바꾸나, 앞에 넣나, 뒤에 넣나" 에 답하지 못한다.
	막대는 절대 배치라 레이아웃을 밀지 않는다 — 막대 때문에 카드가 움직이면
	어느 틈인지 다시 알 수 없게 된다.
-->
<script lang="ts">
	import { gapFromPointer } from '../pages';
	import PageCard from './PageCard.svelte';
	import type { Workbench } from '../state.svelte';

	interface Props {
		bench: Workbench;
	}

	let { bench }: Props = $props();

	/** 끌고 있는 카드의 번호. `null` 이면 드래그 중이 아니다. */
	let draggingIndex = $state<number | null>(null);
	/** 막대를 그릴 틈. 항상 하나만 켜진다 (@reorder-affordance #3). */
	let activeGap = $state<number | null>(null);

	function endDrag() {
		draggingIndex = null;
		activeGap = null;
	}

	/** 포인터가 카드의 앞 절반인지 뒤 절반인지로 틈을 정한다 (@reorder-affordance #2). */
	function gapUnderPointer(event: DragEvent, index: number): number {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		return gapFromPointer(index, event.clientX < box.left + box.width / 2);
	}

	function onDragOverCard(event: DragEvent, index: number) {
		if (draggingIndex === null) return;
		event.preventDefault();
		activeGap = gapUnderPointer(event, index);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		if (draggingIndex !== null && activeGap !== null) {
			bench.moveToGap(draggingIndex, activeGap);
		}
		endDrag();
	}

	/**
	 * 키보드 재정렬. 드래그만 있으면 쓸 수 없는 사람이 생긴다 (@reorder-affordance #9).
	 *
	 * ↑/↓ 도 ←/→ 와 같게 받는다. 그리드는 가로로 흐르므로 ←/→ 가 맞지만, 목록을
	 * 위아래로 읽는 사람에게는 ↑/↓ 가 먼저 떠오른다. 둘 다 받으면 어느 쪽으로
	 * 생각하든 통한다.
	 *
	 * `preventDefault` 를 반드시 부른다 — 브라우저는 Alt+←/→ 를 뒤로/앞으로
	 * 가기로 쓰므로, 막지 않으면 순서를 바꾸려다 페이지를 떠나게 된다.
	 */
	function onCardKeydown(event: KeyboardEvent, index: number) {
		if (!event.altKey) return;

		const delta =
			event.key === 'ArrowLeft' || event.key === 'ArrowUp'
				? -1
				: event.key === 'ArrowRight' || event.key === 'ArrowDown'
					? 1
					: 0;
		if (delta === 0) return;

		event.preventDefault();
		bench.nudge(index, delta);
	}
</script>

<svelte:window
	ondragend={endDrag}
	onkeydown={(event) => {
		// ESC 로 취소하면 순서가 그대로다 (@reorder-affordance #8).
		if (event.key === 'Escape') endDrag();
	}}
/>

<ol class="grid" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
	{#each bench.pages as page, index (page.id)}
		<li
			class="slot"
			class:gap-before={activeGap === index}
			draggable="true"
			ondragstart={() => (draggingIndex = index)}
			ondragover={(event) => onDragOverCard(event, index)}
			onkeydown={(event) => onCardKeydown(event, index)}
		>
			<PageCard
				{page}
				source={bench.sources.get(page.fileId)}
				number={index + 1}
				selected={bench.selected.has(page.id)}
				dragging={draggingIndex === index}
				ontoggle={() => bench.toggleSelected(page.id)}
				onrotate={() => bench.rotate(new Set([page.id]), 1)}
				onremove={() => bench.remove(new Set([page.id]))}
			/>
		</li>
	{/each}

	<!--
		맨 뒤의 틈. 이게 없으면 마지막 자리로 옮길 수 없고, 그것이 드래그
		재정렬에서 가장 흔한 누락이다 (@reorder-affordance #4).

		목록 항목이 아니라 드롭을 받는 빈 자리이므로 스크린리더에는 알리지 않는다.
	-->
	<li
		class="tail"
		class:gap-before={activeGap === bench.pages.length}
		role="presentation"
		ondragover={(event) => {
			if (draggingIndex === null) return;
			event.preventDefault();
			activeGap = bench.pages.length;
		}}
	></li>
</ol>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--gap-l2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.slot {
		position: relative;
		min-width: 0;
	}

	/* 막대가 들어갈 자리. 카드가 아니라 틈에 그린다. */
	.slot.gap-before::before,
	.tail.gap-before::before {
		content: '';
		position: absolute;
		/* 세로 막대 — 그리드는 가로로 흐른다 (@reorder-affordance §막대의 모양). */
		top: 0;
		bottom: 0;
		/* 카드 사이 간격의 가운데. 절대 배치라 레이아웃을 밀지 않는다. */
		left: calc(var(--gap-l2) / -2 - 1px);
		width: 2px;
		border-radius: 1px;
		background-color: var(--accent);
	}

	/*
		맨 뒤의 틈은 폭이 없어도 되지만, 드롭을 받으려면 면적이 필요하다.
		마지막 행의 남은 자리를 채워 거기로 끌어다 놓을 수 있게 한다.
	*/
	.tail {
		position: relative;
		min-height: 100%;
	}
</style>
