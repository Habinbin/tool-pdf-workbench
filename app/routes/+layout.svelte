<script lang="ts">
	/*
		단독 사이트의 헤더. 툴박스에서는 툴박스 껍데기가 같은 자리를 그리므로,
		여기는 그 역할만 대신한다 — 툴(`src/`)은 자기가 어느 화면 구성 안에 있는지 모른다.

		제목·설명·아이콘을 손으로 적지 않고 manifest 에서 가져온다. 두 곳에 적으면
		런처에 뜨는 이름과 사이트에 뜨는 이름이 언젠가 갈라진다.
	*/
	import { manifest } from '$lib/index';

	let { children } = $props();

	/** `manifest.icon` 은 lucide Svelte 컴포넌트다 — 대문자로 받아 그대로 렌더한다. */
	const Icon = manifest.icon;
</script>

<!-- 탭 제목·설명도 manifest 에서 가져온다. app.html 에 적으면 이름이 두 곳에 남는다. -->
<svelte:head>
	<title>{manifest.title}</title>
	<meta name="description" content={manifest.description} />
</svelte:head>

<header class="shell-header">
	<div class="mark"><Icon size={18} strokeWidth={1.75} /></div>
	<h1>{manifest.title}</h1>
</header>

<div class="body">{@render children()}</div>

<style>
	/*
		툴의 `.tool-root` 는 `flex: 1` 로 남은 높이를 받아 빈 상태의 드롭 영역을 가운데 둔다.
		툴박스에서는 껍데기가 그 높이를 정해 주므로, 단독으로 뜰 때 여기가 그 역할만 대신한다.

		배경색을 토큰이 아니라 값으로 적는 이유: `--surface-raised` 는 `.tool-root` 스코프
		안에서만 살아 있어 `body` 가 읽지 못한다. 대신 `--betlab-surface-raised` 를 정의하면
		호스트가 테마를 덮어쓴 셈이 되어, 단독 실행에서 툴 자신의 기본값을 쓴다는 계약이 깨진다.
		그래서 툴의 기본값과 같은 값을 여기 한 번 적는다.
	*/
	:global(body) {
		display: flex;
		min-height: 100dvh;
		flex-direction: column;
		margin: 0;
		background-color: #f5f5f7;
	}

	/*
		넓은 화면에서는 높이를 화면에 묶는다. `min-height` 만 두면 3열 작업대의 우측
		패널이 화면 아래로 흘러 내보내기 버튼이 잘린다 — 툴박스에서는 ToolPage(fill)가
		같은 일을 한다. 좁은 화면은 세로로 쌓이므로 묶지 않고 페이지가 스크롤한다.
	*/
	@media (min-width: 768px) {
		:global(body) {
			height: 100dvh;
			overflow: hidden;
		}
	}

	/*
		본문의 바깥 여백은 껍데기가 정한다 — 툴은 자기가 어느 화면 구성 안에 있는지 모르므로
		여백을 갖지 않는다(툴박스에서도 호스트가 같은 값을 준다). 여기서 주지 않으면
		목록 상태의 컨트롤 바가 창 가장자리에 붙어 헤더의 28px 와 왼쪽 선이 어긋난다.

		`flex: 1` + `min-height: 0` 이라야 툴의 `.tool-root { flex: 1 }` 이 남은 높이를 받아
		빈 상태의 드롭 영역이 본문 가운데에 온다.
	*/
	/*
		이 툴은 작업대형이다 — 목록·캔버스·미리보기 3열이 화면 높이를 전부 쓴다.
		폭을 묶거나 바깥 여백을 주면 3열이 좁아지고, 툴박스(ToolPage fill)와 본문
		시작 좌표가 달라진다. 그래서 남은 높이를 통째로 넘긴다.
		규약: rules/layout-consistency.md
	*/
	.body {
		box-sizing: border-box;
		display: flex;
		width: 100%;
		min-height: 0;
		flex: 1;
		flex-direction: column;
	}

	/*
		헤더의 색·선·글자도 같은 이유로 계약 토큰이 아니라 값으로 적는다. 헤더는
		`.tool-root` 바깥이라 툴의 토큰이 닿지 않고, 여기서 `--betlab-*` 를 정의하면
		호스트 노릇을 하게 되어 툴이 자기 기본값을 쓰지 못한다.
		아래 값은 모두 `src/ui/theme.css` 의 기본값과 같다 — 바뀌면 같이 바꾼다.

		`flex-shrink: 0` 으로 헤더가 제 높이를 지켜야 형제인 `.tool-root` 가 남은 높이를
		받는다. 그래야 빈 상태의 드롭 영역이 헤더 아래 본문 영역의 가운데에 온다.
	*/
	.shell-header {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 12px;
		padding: 14px 28px;
		border-bottom: 1px solid #d2d2d7;
		background-color: #ffffff;
		color: #1d1d1f;
		font-family: 'Noto Sans KR Variable', 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif;
	}

	/*
		아이콘은 본문의 주 행동(드롭 버튼)과 같은 처리를 쓴다 — 채운 파란 면에 흰 아이콘이
		음각처럼 뚫린다. 한 화면에 강조색이 두 가지 표정으로 나오면 같은 체계로 안 읽힌다.
		값은 툴 기본 강조색(`--accent` 의 기본값)과 같다.
	*/
	.mark {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background-color: #0071e3;
		color: #ffffff;
	}

	h1 {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.3;
	}
</style>
