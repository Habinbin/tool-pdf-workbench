import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * 단독 배포 껍데기 설정. 툴박스에 submodule 로 실릴 때는 이 파일이 쓰이지 않는다.
 *
 * `files` 로 라우트와 템플릿을 `app/` 으로 밀어내는 이유: `src/` 는 툴박스도 그대로
 * 가져다 쓰는 라이브러리라, 라우트나 adapter 가 거기 섞이면 껍데기 둘이 갈라진다.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		/*
		 * 영수증 처리도 PDF 생성도 브라우저에서 끝나므로 서버가 할 일이 없다.
		 * 정적 파일로 구우면 어디에나 올릴 수 있다 — 특정 호스팅에 묶이지 않는다.
		 * @client-first-processing
		 */
		adapter: adapter({ fallback: undefined }),
		files: {
			routes: 'app/routes',
			appTemplate: 'app/app.html',
			assets: 'app/static',
			lib: 'src'
		}
	}
};

export default config;
