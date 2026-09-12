<!--
	모든 체크박스가 여기서 온다 (@control-contract #1).

	내보내기 패널의 옵션들이 전부 이 컨트롤이다 — 분할·PDF/A·암호. iLovePDF 에서
	각각 별도 툴인 것들이 여기서는 나란한 체크박스가 되므로, 모양이 하나여야
	"이것들은 같은 층위의 선택" 이라는 것이 읽힌다 (@information-architecture).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		checked: boolean;
		label: string;
		/** 라벨 밑에 붙는 한 줄 설명. */
		hint?: string;
		disabled?: boolean;
		/** 켰을 때 펼쳐지는 추가 입력. 꺼져 있으면 그리지 않는다. */
		children?: Snippet;
		onchange?: (checked: boolean) => void;
	}

	let {
		checked = $bindable(),
		label,
		hint,
		disabled = false,
		children,
		onchange
	}: Props = $props();
</script>

<div class="group">
	<label class="row" class:disabled>
		<input
			type="checkbox"
			{checked}
			{disabled}
			onchange={(event) => {
				checked = event.currentTarget.checked;
				onchange?.(checked);
			}}
		/>
		<span class="text">
			<span class="label">{label}</span>
			{#if hint}<span class="hint">{hint}</span>{/if}
		</span>
	</label>

	{#if children && checked && !disabled}
		<div class="nested">{@render children()}</div>
	{/if}
</div>

<style>
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
	}

	.row {
		display: flex;
		align-items: flex-start;
		gap: var(--gap-l3);
		/* 클릭 대상 24px 이상 (@control-contract #5). */
		min-height: 24px;
		cursor: pointer;
	}

	.row.disabled {
		cursor: not-allowed;
		color: var(--ink-faint);
	}

	input {
		appearance: none;
		flex: none;
		width: 16px;
		height: 16px;
		/* 첫 줄 글자의 중앙에 맞춘다. */
		margin-top: 2px;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background-color: var(--surface);
		cursor: inherit;
	}

	input:checked {
		border-color: var(--accent);
		background-color: var(--accent);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 6.5 5 9l4.5-5.5'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: center;
	}

	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	input:disabled {
		background-color: var(--surface-raised);
		border-color: var(--line);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.label {
		font-size: var(--text-body-sm);
		color: inherit;
	}

	.hint {
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}

	/* 켰을 때 펼쳐지는 입력은 체크박스 글자와 왼쪽을 맞춘다. */
	.nested {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		padding-left: calc(16px + var(--gap-l3));
	}
</style>
