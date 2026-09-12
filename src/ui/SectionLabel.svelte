<!--
	패널·목록 위에 붙는 작은 구역 이름. 세 툴이 각자 다른 크기·굵기·색으로
	같은 역할을 그리고 있었다(11~12px, bold~semibold, ink-faint~ink-muted).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** 라벨 오른쪽의 보조 표시(개수·상태 등). */
		trailing?: Snippet;
		children: Snippet;
	}

	let { trailing, children }: Props = $props();
</script>

<div class="row">
	<h2>{@render children()}</h2>
	{#if trailing}<div class="trailing">{@render trailing()}</div>{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-l3);
		min-height: 22px;
	}

	h2 {
		margin: 0;
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.trailing {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
		flex-shrink: 0;
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}
</style>
