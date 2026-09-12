import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * 툴 패키지는 자기 테스트 설정을 직접 갖는다.
 *
 * 이게 없으면 vitest 가 상위 디렉토리를 훑어 껍데기(toolbox)의 설정을 집어온다.
 * 툴은 submodule 로 껍데기 안에 놓이므로, 단독 체크아웃에서는 통과하고 packages/
 * 아래에서는 깨지는 상황이 생긴다. 어디에 놓이든 같아야 한다.
 *
 * 프로젝트가 둘인 이유: 순수 규칙은 node 에서 충분하지만, 서명 배경 처리(canvas)와
 * 저장소(IndexedDB)는 진짜 브라우저가 있어야 확인된다. 흉내 낸 저장소는
 * "새로고침 뒤에도 남아 있는가" 에 답하지 못한다.
 */
export default defineConfig({
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				plugins: [svelte()],
				test: {
					name: 'browser',
					root: import.meta.dirname,
					include: ['src/**/*.svelte.spec.ts'],
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					}
				}
			},
			{
				test: {
					name: 'node',
					root: import.meta.dirname,
					include: ['src/**/*.spec.ts'],
					exclude: ['src/**/*.svelte.spec.ts'],
					environment: 'node',
					/*
						`@cantoo/pdf-lib` 의 ESM 빌드는 표준 폰트를 import attribute 없이
						JSON 으로 들여온다. node 가 그대로 실행하면 거부하므로, 외부 모듈로
						두지 말고 vite 에 통과시켜 변환하게 한다. 브라우저 번들에서는 vite 가
						항상 변환하므로 이 문제가 없다 — 테스트에서만 필요한 설정이다.
					*/
					server: { deps: { inline: ['@cantoo/pdf-lib'] } }
				}
			}
		]
	}
});
