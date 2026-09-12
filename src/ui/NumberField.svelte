<!--
	숫자 입력란. 한 정의에서 온다 (@control-contract #1).

	`TextField` 를 숫자에 재활용하지 않는 이유: 범위를 묶는 일과 빈 칸을 다루는 일이
	여기 있어야 한다. 텍스트 칸에 `type="number"` 만 얹으면 화살표가 그리는 자리를
	모르는 채로 좌우 padding 을 일괄 지정하게 되고, 그게 @control-contract #3 이
	막으려는 바로 그 사고다.
-->
<script lang="ts">
	interface Props {
		value: number;
		label: string;
		/** 라벨 밑 한 줄 설명. */
		hint?: string;
		min?: number;
		max?: number;
		step?: number;
		/**
		 * 값은 0–1 비율인데 사람에게는 **퍼센트로 보여 준다.**
		 * `min`·`max` 도 퍼센트로 받는다 — 부르는 쪽이 단위를 두 번 환산하지 않게.
		 */
		percentOf?: boolean;
	}

	let {
		value = $bindable(),
		label,
		hint,
		min = 0,
		max = 100,
		step = 1,
		percentOf = false
	}: Props = $props();

	/** 화면에 보이는 값. 비율이면 퍼센트로 올려서 보여 준다. */
	const shown = $derived(percentOf ? Math.round(value * 100) : value);

	function commit(raw: string) {
		const parsed = Number(raw);
		// 빈 칸이나 글자가 들어오면 최솟값으로 돌린다. NaN 을 그대로 흘리면
		// 그 값을 쓰는 기하 계산이 통째로 NaN 이 된다.
		const next = Number.isFinite(parsed) ? parsed : min;
		const clamped = Math.min(max, Math.max(min, next));
		value = percentOf ? clamped / 100 : clamped;
	}
</script>

<label class="field">
	<span class="label">{label}</span>
	<input
		type="number"
		value={shown}
		{min}
		{max}
		step={percentOf ? 1 : step}
		oninput={(event) => commit(event.currentTarget.value)}
	/>
	{#if hint}<span class="hint">{hint}</span>{/if}
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

	.hint {
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}

	input {
		width: 100%;
		min-width: 0;
		/* 클릭 대상 24px 이상 (@control-contract #5, WCAG 2.2 AA). */
		min-height: 34px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background-color: var(--surface);
		color: var(--ink);
		font-family: var(--font);
		font-size: var(--text-body-sm);

		/*
			위·아래·왼쪽만 지정한다. 오른쪽은 브라우저가 증감 화살표를 그리는
			자리이므로 건드리지 않는다 (@control-contract #3).
		*/
		padding-top: 6px;
		padding-bottom: 6px;
		padding-left: 10px;
	}

	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
