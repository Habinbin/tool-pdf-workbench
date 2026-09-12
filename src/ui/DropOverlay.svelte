<!--
	파일을 창 위로 끌어왔을 때 덮이는 안내. 세 툴이 각자 다른 문구·크기·배경으로
	같은 순간을 그리고 있었다(반투명 검정 + 흰 카드 / 짙은 카드 + 튀는 아이콘).
	놓아도 되는 순간이라는 신호는 어느 툴에서나 같아야 한다.
-->
<script lang="ts">
	interface Props {
		/** 보일지 여부. 툴의 드래그 상태를 그대로 넘긴다. */
		open: boolean;
		/** 무엇이 추가되는지 한 줄. 생략하면 문구 없이 제목만 보인다. */
		hint?: string;
	}

	let { open, hint }: Props = $props();
</script>

{#if open}
	<div class="scrim">
		<div class="card">
			<p class="title">놓으면 추가됩니다</p>
			{#if hint}<p class="hint">{hint}</p>{/if}
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: absolute;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: center;
		pointer-events: none;
		background-color: var(--wash);
	}

	.card {
		border: 2px dashed var(--accent);
		border-radius: var(--radius-panel);
		background-color: var(--surface);
		padding: 28px 40px;
		text-align: center;
	}

	.title {
		margin: 0;
		font-size: var(--text-body);
		font-weight: 600;
		color: var(--ink);
	}

	.hint {
		margin: var(--gap-l4) 0 0;
		font-size: var(--text-caption);
		color: var(--ink-muted);
	}
</style>
