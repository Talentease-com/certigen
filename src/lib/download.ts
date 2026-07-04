export function downloadBase64File(
	base64: string,
	filename: string,
	mime = "image/png",
) {
	const byteChars = atob(base64);
	const byteArray = new Uint8Array(byteChars.length);
	for (let i = 0; i < byteChars.length; i++) {
		byteArray[i] = byteChars.charCodeAt(i);
	}
	const blob = new Blob([byteArray], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
