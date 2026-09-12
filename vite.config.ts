import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/*
	단독 빌드 전용. 테스트는 `vitest.config.ts` 를 따로 쓴다 — 순수 로직 테스트에
	SvelteKit 플러그인을 물릴 이유가 없고, 툴박스 아래 놓였을 때도 같아야 한다.
*/
export default defineConfig({
	plugins: [sveltekit()]
});
