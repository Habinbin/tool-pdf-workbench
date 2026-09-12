<!--
	덧입히기 설정. 오른쪽 패널의 **같은 자리**에 내보내기 대신 들어온다.

	사용자가 목록에서 골라야 하는 것은 이것뿐이다 — 나머지 기능은 손동작이거나
	내보내기 옵션이라 고를 대상이 아니다. 그래서 목록이 다섯 줄로 끝난다.
-->
<script lang="ts">
	import Button from '../ui/Button.svelte';
	import Checkbox from '../ui/Checkbox.svelte';
	import NumberField from '../ui/NumberField.svelte';
	import SectionLabel from '../ui/SectionLabel.svelte';
	import Select from '../ui/Select.svelte';
	import TextField from '../ui/TextField.svelte';
	import type { Anchor, NumberFormat } from '../overlays';
	import type { PanelView, Workbench } from '../state.svelte';

	interface Props {
		bench: Workbench;
		view: Exclude<PanelView, 'export'>;
	}

	let { bench, view }: Props = $props();

	const ANCHORS: readonly { value: Anchor; label: string }[] = [
		{ value: 'top-left', label: '위 왼쪽' },
		{ value: 'top-center', label: '위 가운데' },
		{ value: 'top-right', label: '위 오른쪽' },
		{ value: 'middle-left', label: '가운데 왼쪽' },
		{ value: 'middle-center', label: '정가운데' },
		{ value: 'middle-right', label: '가운데 오른쪽' },
		{ value: 'bottom-left', label: '아래 왼쪽' },
		{ value: 'bottom-center', label: '아래 가운데' },
		{ value: 'bottom-right', label: '아래 오른쪽' }
	];

	const FORMATS: readonly { value: NumberFormat; label: string }[] = [
		{ value: 'plain', label: '1' },
		{ value: 'of-total', label: '1 / 10' },
		{ value: 'dashed', label: '- 1 -' }
	];

	const TITLE: Record<Exclude<PanelView, 'export'>, string> = {
		numbering: '쪽번호',
		watermark: '워터마크',
		stamp: '도장 · 서명',
		crop: '여백 자르기'
	};

	/** 백분율로 보여 주고 비율로 저장한다 — 사용자는 %로 생각한다. */
	function percent(ratio: number): number {
		return Math.round(ratio * 100);
	}

	async function pickStamp(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file === undefined) return;

		bench.stampBytes = await file.arrayBuffer();
		bench.stampMime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
		bench.stampName = file.name;
		bench.stampOn = true;
	}
</script>

<div class="body">
	<SectionLabel>{TITLE[view]}</SectionLabel>

	{#if view === 'numbering'}
		<Checkbox bind:checked={bench.numberingOn} label="쪽번호 넣기" />
		<Select bind:value={bench.numberAnchor} label="자리" options={ANCHORS} />
		<Select bind:value={bench.numberFormat} label="표기" options={FORMATS} />
		<NumberField bind:value={bench.numberStartAt} label="시작 번호" min={0} max={9999} />
		<NumberField
			bind:value={bench.numberSkipFirst}
			label="앞에서 건너뛸 장"
			hint="표지처럼 번호를 넣지 않을 장의 수"
			min={0}
			max={Math.max(0, bench.pages.length - 1)}
		/>
	{:else if view === 'watermark'}
		<Checkbox bind:checked={bench.watermarkOn} label="워터마크 넣기" />
		<TextField
			bind:value={bench.watermarkText}
			label="문구"
			placeholder="대외비"
			oninput={() => (bench.watermarkOn = bench.watermarkText.trim() !== '')}
		/>
		<NumberField
			bind:value={bench.watermarkOpacity}
			label="진하기"
			hint="0 에 가까울수록 밑의 내용이 잘 비칩니다"
			min={0.05}
			max={1}
			step={0.05}
		/>
		<NumberField bind:value={bench.watermarkAngle} label="각도" min={0} max={359} step={15} />
	{:else if view === 'stamp'}
		<label class="picker">
			<span class="picker-label">이미지 고르기</span>
			<input type="file" accept="image/png,image/jpeg" onchange={pickStamp} />
		</label>

		{#if bench.stampBytes !== null}
			<Checkbox bind:checked={bench.stampOn} label="도장 넣기" hint={bench.stampName} />
			<Select bind:value={bench.stampAnchor} label="자리" options={ANCHORS} />
			<NumberField
				bind:value={bench.stampWidth}
				label="크기"
				hint="페이지 너비 대비 비율"
				min={0.05}
				max={1}
				step={0.05}
			/>
		{:else}
			<p class="note">PNG 나 JPG 를 고르면 자리와 크기를 정할 수 있습니다.</p>
		{/if}
	{:else}
		<Checkbox
			bind:checked={bench.cropOn}
			label="여백 자르기"
			hint="내용은 그대로 두고 보이는 창만 좁힙니다 — 되돌릴 수 있습니다."
		/>
		<div class="sides">
			<NumberField bind:value={bench.cropTop} label="위 %" min={0} max={45} percentOf />
			<NumberField bind:value={bench.cropBottom} label="아래 %" min={0} max={45} percentOf />
			<NumberField bind:value={bench.cropLeft} label="왼쪽 %" min={0} max={45} percentOf />
			<NumberField bind:value={bench.cropRight} label="오른쪽 %" min={0} max={45} percentOf />
		</div>
		<p class="note">
			한 변에서 최대 45% 까지. 마주 보는 두 변이 절반씩이면 남는 면적이 없어집니다.
		</p>
	{/if}
</div>

<footer class="foot">
	<p class="summary">
		{bench.activeOverlayCount === 0
			? '아직 얹은 것이 없습니다'
			: `${bench.activeOverlayCount}개 얹는 중`}
	</p>
	<Button variant="primary" block onclick={() => (bench.view = 'export')}>내보내기로</Button>
</footer>

<style>
	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--gap-l2);
		overflow-y: auto;
		padding: var(--space-20);
	}

	.sides {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-l3);
	}

	.note,
	.summary {
		margin: 0;
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}

	/*
		파일 고르기는 한 번만 쓰는 입구라 공유 컨트롤로 만들 만큼 반복되지 않는다.
		입력 자체는 숨기고 라벨이 버튼 노릇을 한다 — 브라우저 기본 파일 입력은
		문구도 모양도 제어할 수 없다.
	*/
	.picker input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.picker-label {
		display: grid;
		place-items: center;
		/* 클릭 대상 24px 이상 (@control-contract #5). */
		min-height: 38px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-control);
		color: var(--ink-muted);
		font-size: var(--text-body-sm);
		cursor: pointer;
	}

	.picker-label:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.foot {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		border-top: 1px solid var(--line);
		padding: var(--space-20);
	}
</style>
