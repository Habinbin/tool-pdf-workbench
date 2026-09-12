<!--
	모든 툴이 같은 입력란을 쓴다. 라벨 위치·테두리·포커스 표시가 한 곳에서 온다.
	`suffix` 는 사용자가 바꿀 수 없는 꼬리표(확장자 등)다 — 입력값의 일부가 아니다.
-->
<script lang="ts">
	interface Props {
		value: string;
		label: string;
		/** 라벨을 시각적으로 숨기고 스크린리더에만 남긴다. */
		hideLabel?: boolean;
		placeholder?: string;
		/** `.pptx` 처럼 고정된 꼬리표. 입력란 오른쪽에 붙는다. */
		suffix?: string;
		/** `인수자:` 처럼 고정된 머리표. 입력란 왼쪽에 붙는다. */
		prefix?: string;
		oninput?: (value: string) => void;
	}

	let {
		value = $bindable(),
		label,
		hideLabel = false,
		placeholder,
		suffix,
		prefix,
		oninput
	}: Props = $props();
</script>

<label class="field">
	<span class="label" class:sr-only={hideLabel}>{label}</span>
	<span class="control">
		{#if prefix}<span class="affix">{prefix}</span>{/if}
		<input
			type="text"
			{value}
			{placeholder}
			oninput={(e) => {
				value = e.currentTarget.value;
				oninput?.(value);
			}}
		/>
		{#if suffix}<span class="affix">{suffix}</span>{/if}
	</span>
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
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.control {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
		min-width: 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-control);
		background-color: var(--surface);
		padding: 7px 10px;
		transition: border-color 0.15s;
	}

	.control:focus-within {
		border-color: var(--accent);
	}

	/* 꼬리표·머리표는 줄바꿈되지 않는다 — 두 글자짜리 라벨이 세로로 접히면
 입력란 높이가 들쭉날쭉해진다. */
	.affix {
		flex-shrink: 0;
		white-space: nowrap;
		font-size: var(--text-body-sm);
		color: var(--ink-faint);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		padding: 0;
		font-family: var(--font);
		font-size: var(--text-body-sm);
		color: var(--ink);
	}

	input:focus {
		outline: none;
		box-shadow: none;
	}

	input::placeholder {
		color: var(--ink-faint);
	}
</style>
