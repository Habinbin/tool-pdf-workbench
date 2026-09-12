<!--
	글자 없이 아이콘만 있는 버튼. 한 정의에서 온다 (@control-contract #1).

	이게 없으면 페이지 카드의 회전·빼기, 칩의 ×, 배너의 닫기가 각자 인라인 CSS 로
	같은 모양을 다시 쓰게 되고, 그 중 하나만 고쳐지면서 갈라진다.

	글자가 없으므로 `label` 은 선택이 아니다 — 스크린리더에는 이것뿐이고,
	마우스 쪽에는 툴팁으로도 쓴다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		/** 무엇을 하는 버튼인지. 툴팁과 스크린리더 이름을 겸한다. */
		label: string;
		/** 되돌리기 어려운 동작. 호버할 때만 붉어진다 — 평소엔 다른 것과 같다. */
		tone?: 'neutral' | 'danger';
		children: Snippet;
	}

	let { label, tone = 'neutral', type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class="icon-button {tone}" title={label} aria-label={label} {...rest}>
	{@render children()}
</button>

<style>
	.icon-button {
		display: grid;
		place-items: center;
		/*
		   클릭 대상 24×24 이상 (@control-contract #5, WCAG 2.2 AA).
		   아이콘은 14px 이지만 대상은 그보다 커야 한다.
		*/
		width: 24px;
		height: 24px;
		flex: none;
		border: none;
		border-radius: var(--radius-control);
		background: none;
		color: var(--ink-muted);
		cursor: pointer;
	}

	.icon-button:hover {
		background-color: var(--wash-weak);
		color: var(--ink);
	}

	.icon-button.danger:hover {
		color: var(--danger);
	}

	.icon-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.icon-button:disabled {
		color: var(--ink-faint);
		cursor: not-allowed;
	}

	.icon-button:disabled:hover {
		background: none;
	}
</style>
