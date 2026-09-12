<!--
	모든 툴이 같은 버튼을 쓴다.

	전에는 툴마다 같은 역할의 버튼이 다른 모서리(lg·xl)·다른 글자 크기(xs·sm)·
	다른 굵기(bold·semibold)로 그려졌다. 같은 행동이 화면마다 다르게 보이면
	사용자는 그게 같은 행동인지 매번 확인해야 한다.
	색·모서리는 계약 토큰에서 오므로 툴박스가 값을 바꾸면 전부 함께 바뀐다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		/** 가로를 꽉 채운다. 패널 하단의 주 행동에 쓴다. */
		block?: boolean;
		children: Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		block = false,
		type = 'button',
		children,
		...rest
	}: Props = $props();
</script>

<button {type} class="btn {variant} {size}" class:block {...rest}>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--gap-l4);
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		font-family: var(--font);
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.block {
		width: 100%;
	}

	.md {
		padding: 9px 16px;
		font-size: var(--text-body-sm);
	}

	.sm {
		padding: 6px 10px;
		font-size: var(--text-caption);
	}

	.primary {
		background-color: var(--accent);
		color: var(--on-accent);
	}

	.primary:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}

	.secondary {
		border-color: var(--line-strong);
		background-color: var(--surface);
		color: var(--ink);
	}

	.secondary:hover:not(:disabled) {
		border-color: var(--accent);
	}

	.ghost {
		background-color: transparent;
		color: var(--ink-muted);
	}

	.ghost:hover:not(:disabled) {
		background-color: var(--surface-sunken);
		color: var(--ink);
	}

	.danger {
		border-color: var(--line-strong);
		background-color: var(--surface);
		color: var(--danger);
	}

	.danger:hover:not(:disabled) {
		border-color: var(--danger);
	}
</style>
