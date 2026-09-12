import FileStackIcon from '@lucide/svelte/icons/file-stack';

/**
 * 런처와 헤더에 쓰이는 메타데이터.
 *
 * 타입을 공유 패키지에서 가져오지 않는다: 이 툴은 자립해야 하고, 호스트가 자기
 * `ToolManifest` 로 구조적으로 검사한다. 제목·설명을 호스트에도 적으면 언젠가 갈라진다.
 */
export const manifest = {
	id: 'pdf-workbench',
	title: 'PDF 작업대',
	description:
		'PDF와 이미지를 떨어뜨리면 페이지 그리드가 뜹니다. 순서를 바꾸고 필요 없는 장을 빼고, 번호·워터마크·서명을 얹어 원하는 형태로 내보냅니다.',
	category: '파일 도구',
	icon: FileStackIcon,
	/** 'embed' — 툴박스 안 라우트로 렌더한다. @standalone-tool-deployment */
	surface: 'embed' as const
};
