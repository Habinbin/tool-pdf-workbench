/**
 * `@cantoo/pdf-lib` 를 **쓰는 순간에** 싣는다.
 *
 * 두 가지를 동시에 해결한다.
 *
 * 1. **SSR 이 죽지 않는다.** 이 패키지의 ESM 빌드는 표준 폰트를 import attribute 없이
 *    JSON 으로 들여온다. 노드가 모듈 그래프를 훑다가 거기서 멈춘다. 호스트마다
 *    `ssr.noExternal` 을 적어 달라고 요구할 수도 있지만, 그러면 이 툴은 껍데기가
 *    설정을 꽂아 줘야 도는 상태가 된다 — 계약 위반이다
 *    (@tool-package-contract #7, @standalone-tool-deployment #3).
 *    브라우저에서 처음 필요해질 때 부르면 노드는 이 모듈을 볼 일이 없다.
 *
 * 2. **첫 화면이 가벼워진다.** 이 패키지는 풀어서 26MB 다. 파일을 떨어뜨리기
 *    전까지는 한 바이트도 필요하지 않다.
 */

let cached: Promise<typeof import('@cantoo/pdf-lib')> | null = null;

/** 한 번만 싣고 이후로는 같은 모듈을 돌려준다. */
export function pdfLib(): Promise<typeof import('@cantoo/pdf-lib')> {
	cached ??= import('@cantoo/pdf-lib');
	return cached;
}
