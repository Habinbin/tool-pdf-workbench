/*
	영수증 처리와 PDF 생성이 브라우저에서 끝나므로 서버가 할 일이 없다.
	정적 HTML 한 장으로 굽고 하이드레이트한다 — 배포에 런타임이 필요 없다.
*/
export const prerender = true;
