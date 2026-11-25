export function captureResizedBlob(video: HTMLVideoElement | null): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!video || video.videoWidth === 0) {
      return reject(new Error("Kamera belum siap."));
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 480 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Gagal memproses kanvas kamera."));

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Gagal mengonversi foto."));
      },
      "image/jpeg",
      0.75
    );
  });
}