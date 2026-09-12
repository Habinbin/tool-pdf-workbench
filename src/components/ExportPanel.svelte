<!--
	오른쪽 패널 — "어떤 형태로 받지" 에 답하는 자리.

	iLovePDF 가 Split · PDF to JPG · Protect · PDF/A 를 각각 별도 툴로 두는 것을
	여기서는 나란한 옵션으로 합친다. 그래서 **압축과 암호를 한 번에** 걸 수 있다.

	자리는 화면이 바뀌어도 고정된다 — 주 행동 버튼과 진행률이 늘 같은 좌표에
	나온다 (@layout-consistency #3).
-->
<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	import Button from '../ui/Button.svelte';
	import Checkbox from '../ui/Checkbox.svelte';
	import SectionLabel from '../ui/SectionLabel.svelte';
	import Select from '../ui/Select.svelte';
	import TextField from '../ui/TextField.svelte';
	import { planExport } from '../export-plan';
	import type { OutputFormat } from '../export-plan';
	import type { PanelView, Workbench } from '../state.svelte';

	interface Props {
		bench: Workbench;
		onexport: () => void;
	}

	let { bench, onexport }: Props = $props();

	const FORMATS: readonly { value: OutputFormat; label: string }[] = [
		{ value: 'pdf', label: 'PDF' },
		{ value: 'jpg', label: 'JPG 이미지' },
		{ value: 'text', label: '텍스트' }
	];

	/**
	 * 고를 수 있는 덧입히기. **다섯 줄이 전부다** — 나머지 기능은 손동작이거나
	 * 내보내기 옵션이라 목록에 올라올 자격이 없다 (@information-architecture).
	 */
	const OVERLAYS: readonly { view: Exclude<PanelView, 'export'>; label: string }[] = [
		{ view: 'numbering', label: '쪽번호' },
		{ view: 'watermark', label: '워터마크' },
		{ view: 'stamp', label: '도장 · 서명' },
		{ view: 'crop', label: '여백 자르기' }
	];

	/** 그 덧입히기가 지금 켜져 있는가. 목록에서 점으로 보여 준다. */
	function isOn(view: Exclude<PanelView, 'export'>): boolean {
		if (view === 'numbering') return bench.numberingOn;
		if (view === 'watermark') return bench.watermarkOn && bench.watermarkText.trim() !== '';
		if (view === 'stamp') return bench.stampOn && bench.stampBytes !== null;
		return bench.cropOn;
	}

	const plan = $derived(planExport(bench.pages.length, bench.exportSettings));
	const busy = $derived(bench.exporting !== null);
	const blocked = $derived(plan.blockedReason !== undefined);
</script>

<div class="body">
	<section class="group">
		<SectionLabel>내보내기</SectionLabel>

		<Select
			bind:value={bench.format}
			label="형식"
			options={FORMATS}
			onchange={() => {
				// PDF 전용 옵션은 형식이 바뀌면 의미를 잃는다. 켜 둔 채
				// 숨기면 사용자가 모르는 설정이 남는다.
				if (bench.format !== 'pdf') {
					bench.pdfa = false;
					bench.protect = false;
				}
			}}
		/>

		<TextField bind:value={bench.baseName} label="파일 이름" placeholder="문서" />
	</section>

	<section class="group">
		<SectionLabel>옵션</SectionLabel>

		{#if bench.format === 'pdf'}
			<Checkbox
				bind:checked={bench.splitPages}
				label="페이지마다 따로"
				hint="장마다 파일 하나. 여러 개면 ZIP 으로 묶입니다."
			/>

			<Checkbox
				bind:checked={bench.pdfa}
				label="PDF/A 로 변환"
				hint="장기보존용 규격. 암호와 함께 쓸 수 없습니다."
			/>

			<!--
					라벨을 숨기지 않는다. 플레이스홀더는 입력을 시작하면 사라져서,
					무슨 칸이었는지 다시 알 수 없게 된다.
				-->
			<Checkbox bind:checked={bench.protect} label="암호 걸기" hint="AES-256 으로 잠급니다.">
				<TextField bind:value={bench.password} label="비밀번호" placeholder="열 때 물어볼 값" />
			</Checkbox>
			<Checkbox
				bind:checked={bench.flattenForms}
				label="폼 굳히기"
				hint="입력된 폼 값을 고칠 수 없게 만듭니다."
			/>
		{:else}
			<p class="note">
				{bench.format === 'jpg'
					? '장마다 이미지 하나가 나옵니다. 여러 장이면 ZIP 으로 묶입니다.'
					: '모든 장의 글자를 한 파일로 이어 붙입니다.'}
			</p>
		{/if}
	</section>

	{#if bench.format === 'pdf'}
		<section class="group">
			<SectionLabel>
				덧입히기
				{#snippet trailing()}
					{#if bench.activeOverlayCount > 0}
						<span class="count">{bench.activeOverlayCount}</span>
					{/if}
				{/snippet}
			</SectionLabel>

			<ul class="overlays">
				{#each OVERLAYS as item (item.view)}
					<li>
						<button type="button" class="row" onclick={() => (bench.view = item.view)}>
							<span class="dot" class:on={isOn(item.view)}></span>
							<span class="row-label">{item.label}</span>
							<ChevronRightIcon size={14} />
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<!-- 주 행동은 늘 여기. 화면이 어떤 상태든 좌표가 움직이지 않는다. -->
<footer class="foot">
	{#if bench.exporting !== null}
		<p class="progress" role="status">
			{bench.exporting.done} / {bench.exporting.total} 장 처리 중
		</p>
	{:else}
		<p class="summary">{plan.summary}</p>
	{/if}

	<Button variant="primary" block disabled={blocked || busy} onclick={onexport}>
		{busy ? '내보내는 중…' : '내보내기'}
	</Button>

	<!-- 왜 못 누르는지 한 줄. 숨기지 않고 이유를 보인다 (@tool-ux-principles §2). -->
	{#if plan.blockedReason !== undefined}
		<p class="reason">{plan.blockedReason}</p>
	{/if}
</footer>

<style>
	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		/* 구획 사이 — 사다리의 가장 넓은 단 (@spacing-ladder). */
		gap: var(--gap-l1);
		overflow-y: auto;
		padding: var(--space-20);
	}

	.group {
		display: flex;
		flex-direction: column;
		/* 구획 안의 그룹 사이. l1 의 절반. */
		gap: var(--gap-l2);
	}

	.overlays {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		width: 100%;
		align-items: center;
		gap: var(--gap-l3);
		/* 클릭 대상 24px 이상 (@control-contract #5). */
		min-height: 34px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background-color: var(--surface);
		padding: 6px 10px;
		color: var(--ink);
		font-family: var(--font);
		font-size: var(--text-body-sm);
		cursor: pointer;
	}

	.row:hover {
		border-color: var(--accent);
	}

	.row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.row-label {
		flex: 1;
		overflow: hidden;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* 켜진 것만 색이 든다 — 글자를 더 쓰지 않고 상태를 보여 준다. */
	.dot {
		width: 6px;
		height: 6px;
		flex: none;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
	}

	.dot.on {
		border-color: var(--accent);
		background-color: var(--accent);
	}

	.count {
		font-size: var(--text-caption);
		font-variant-numeric: tabular-nums;
		color: var(--accent);
	}

	.note,
	.summary,
	.reason,
	.progress {
		margin: 0;
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}

	.reason {
		color: var(--warning);
	}

	.foot {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		border-top: 1px solid var(--line);
		padding: var(--space-20);
	}
</style>
