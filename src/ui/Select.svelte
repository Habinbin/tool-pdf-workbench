<!--
	모든 셀렉트가 여기서 온다 (@control-contract #1).

	셰브론은 배경 이미지로 그리고 **그만큼의 오른쪽 여백을 예약한다.** 예약을 덮는
	것이 이 컨트롤에서 가장 흔한 사고다 — `padding` 축약이나 좌우 일괄 지정이
	예약을 지우고, 긴 값이 들어오는 순간 글자가 화살표 밑으로 들어간다.
	지금 안 겹쳐 보이는 것은 선택값이 짧기 때문일 뿐이다 (@control-contract #3).
-->
<script lang="ts" generics="T extends string">
	interface Option<V> {
		value: V;
		label: string;
	}

	interface Props {
		value: T;
		label: string;
		options: readonly Option<T>[];
		/** 라벨을 시각적으로 숨기고 스크린리더에만 남긴다. */
		hideLabel?: boolean;
		disabled?: boolean;
		onchange?: (value: T) => void;
	}

	let {
		value = $bindable(),
		label,
		options,
		hideLabel = false,
		disabled = false,
		onchange
	}: Props = $props();
</script>

<label class="field">
	<span class="label" class:sr-only={hideLabel}>{label}</span>
	<select
		class="control"
		{value}
		{disabled}
		onchange={(event) => {
			value = event.currentTarget.value as T;
			onchange?.(value);
		}}
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		min-width: 0;
	}

	.label {
		font-size: var(--text-caption);
		font-weight: 500;
		color: var(--ink-muted);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.control {
		appearance: none;
		width: 100%;
		min-width: 0;
		/* 클릭 대상 24px 이상 (@control-contract #5). */
		min-height: 34px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background-color: var(--surface);
		color: var(--ink);
		font-family: var(--font);
		font-size: var(--text-body-sm);
		line-height: 1.4;

		/*
			위·아래·왼쪽만 지정한다. 오른쪽은 셰브론의 자리이므로 따로 둔다 —
			`padding` 축약이나 `padding-inline` 을 쓰면 그 자리가 지워진다.
		*/
		padding-top: 6px;
		padding-bottom: 6px;
		padding-left: 10px;
		/* 셰브론 폭(12) + 좌우 여백(2 × 8) = 28. 글자는 여기까지만 온다. */
		padding-right: 28px;

		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%236e6e73' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 8px center;

		/* 긴 값이 컨트롤을 밀지 않도록 잘라 낸다. */
		text-overflow: ellipsis;
	}

	.control:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.control:disabled {
		background-color: var(--surface-raised);
		color: var(--ink-faint);
		cursor: not-allowed;
	}
</style>
