// 伏せ字のテストで使う偽の鍵(どれも本物ではない)。本物と同じ形の文字列をリポジトリのファイルに置かないよう、実行時に組み立てる
// (秘密を探す検査は、テストの材料と本物を見分けられない)。golden の検体では {{FAKE:名前}} の印を、ここの値に置き換えてから使う。
const j = (...parts: string[]): string => parts.join("");

export const FAKES = {
	anthropic: j("sk-ant-", "api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"),
	openai: j("sk-proj", "-ABCDEFGHIJKLMNOPQRST1234"),
	github: j("ghp", "_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"),
	aws_key: j("AKIA", "ABCDEFGHIJKLMNOP"),
	discord: j("MTIzNDU2Nzg5MDEyMzQ1Njc4OTAx", ".GAbCdE.", "abcdefghijklmnopqrstuvwxyz0123"),
	private_key: j("-----BEGIN RSA PRIVATE", " KEY-----\nMIIEnisemono\n-----END RSA PRIVATE", " KEY-----"),
	private_key_openssh: j("-----BEGIN OPENSSH PRIVATE", " KEY-----\nb3BlbnNzaC1rZXktdjEAAAAAnisemono\n-----END OPENSSH PRIVATE", " KEY-----"),
};

/** 検体の中の {{FAKE:名前}} を偽の鍵に置き換える。知らない名前なら止まる */
export function fillFakes(text: string): string {
	return text.replace(/\{\{FAKE:(\w+)\}\}/g, (_m, k: string) => {
		const v = (FAKES as Record<string, string | undefined>)[k];
		if (v === undefined) throw new Error(`知らない偽の鍵: ${k}`);
		return v;
	});
}
