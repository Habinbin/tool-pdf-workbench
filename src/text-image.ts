/**
 * 글자를 투명 PNG 로 굽는다. 브라우저에서만 돈다.
 *
 * PDF 에 글자를 직접 쓰려면 폰트를 임베드해야 하는데, pdf-lib 의 기본 폰트에는
 * 한글이 없다. 한글 폰트를 싣자니 웹폰트는 woff2 라 fontkit 이 못 읽고, TTF 를
 * 따로 번들하면 몇 MB 가 붙는다 — 워터마크 한 줄 때문에.
 *
 * 대신 화면이 이미 가진 폰트로 캔버스에 그려 그림으로 넣는다. 세 가지가 따라온다.
 *
 * - 한글·한자·이모지 무엇이든 된다. 브라우저가 그릴 수 있으면 그대로 나온다.
 * - 미리보기와 결과가 **같은 폰트**다. 임베드 방식은 둘이 어긋날 수 있다.
 * - 추가 번들이 없다.
 *
 * 대가는 글자가 선택되지 않는다는 것. 워터마크와 쪽번호는 읽히면 되지 복사할
 * 대상이 아니므로 받아들일 만한 거래다. 본문은 원본 그대로 복사되므로 영향 없다
 * (@assemble — 원본을 다시 그리지 않는다).
 */

/** 화면 해상도의 몇 배로 구울지. 인쇄에서 계단이 보이지 않을 만큼. */
const SUPERSAMPLE = 4;

export interface TextImage {
	bytes: ArrayBuffer;
	/** pt 단위의 논리 크기. 배율을 되돌린 값이라 그대로 PDF 에 쓸 수 있다. */
	width: number;
	height: number;
}

export interface TextStyle {
	/** pt. PDF 좌표계와 같은 단위로 받는다. */
	fontSize: number;
	color?: string;
	weight?: number;
	/** 비우면 툴의 본문 폰트를 쓴다 — 화면에 보이는 것과 같은 글꼴. */
	fontFamily?: string;
}

/** `.tool-root` 에 걸린 실제 폰트 스택을 읽는다. 없으면 안전한 기본값. */
function resolveFontFamily(explicit?: string): string {
	if (explicit !== undefined && explicit !== '') return explicit;

	const root = document.querySelector('.tool-root');
	if (root !== null) {
		const family = getComputedStyle(root).fontFamily;
		if (family !== '') return family;
	}
	return "'Noto Sans KR Variable', 'Noto Sans KR', sans-serif";
}

/**
 * 한 줄짜리 글자를 투명 PNG 로 굽는다.
 *
 * @param text 그릴 문자열. 빈 문자열이면 `null`.
 * @param style 크기·색·굵기.
 * @returns PNG 바이트와 pt 단위 크기. 그릴 것이 없으면 `null`.
 */
export async function renderText(text: string, style: TextStyle): Promise<TextImage | null> {
	const trimmed = text.trim();
	if (trimmed === '') return null;

	const family = resolveFontFamily(style.fontFamily);
	const font = `${style.weight ?? 400} ${style.fontSize * SUPERSAMPLE}px ${family}`;

	// 먼저 재기만 한다 — 상자 크기를 알아야 캔버스를 만들 수 있다.
	const gauge = document.createElement('canvas').getContext('2d');
	if (gauge === null) throw new Error('캔버스를 열지 못했습니다.');
	gauge.font = font;
	const metrics = gauge.measureText(trimmed);

	/*
		글꼴이 실제로 차지하는 높이를 쓴다. `fontSize` 를 그대로 높이로 삼으면
		한글의 아랫부분이나 g·y 의 꼬리가 잘린다.
	*/
	const ascent = metrics.actualBoundingBoxAscent || style.fontSize * SUPERSAMPLE * 0.8;
	const descent = metrics.actualBoundingBoxDescent || style.fontSize * SUPERSAMPLE * 0.25;

	// 좌우로도 조금 넉넉히 — 이탤릭이나 장식 글꼴이 상자를 넘는 경우가 있다.
	const padding = Math.ceil(style.fontSize * SUPERSAMPLE * 0.15);
	const width = Math.ceil(metrics.width) + padding * 2;
	const height = Math.ceil(ascent + descent) + padding * 2;

	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, width);
	canvas.height = Math.max(1, height);

	const context = canvas.getContext('2d');
	if (context === null) throw new Error('캔버스를 열지 못했습니다.');

	context.font = font;
	context.fillStyle = style.color ?? '#000000';
	context.textBaseline = 'alphabetic';
	context.fillText(trimmed, padding, padding + ascent);

	const blob = await new Promise<Blob | null>((resolve) =>
		// 투명 배경이 필요하므로 PNG 다. JPEG 는 알파를 잃는다.
		canvas.toBlob(resolve, 'image/png')
	);
	if (blob === null) throw new Error('글자를 그림으로 굽지 못했습니다.');

	return {
		bytes: await blob.arrayBuffer(),
		// 배율을 되돌려 pt 로 돌려준다.
		width: canvas.width / SUPERSAMPLE,
		height: canvas.height / SUPERSAMPLE
	};
}

/** 이미지 바이트의 실제 픽셀 크기. 스탬프를 비율로 줄일 때 필요하다. */
export async function imageSize(
	bytes: ArrayBuffer,
	mime: string
): Promise<{ width: number; height: number }> {
	const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
	const size = { width: bitmap.width, height: bitmap.height };
	bitmap.close();
	return size;
}
