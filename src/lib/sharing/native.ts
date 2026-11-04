export async function prepareShareFiles(urls: string[], signal?: AbortSignal): Promise<File[]> {
  if (!urls.length || urls.some((url) => !url)) throw new Error("missing_slides");
  return Promise.all(urls.map(async (url, index) => {
    const response = await fetch(url, { signal, credentials: "omit", cache: "no-store" });
    if (!response.ok) throw new Error("slide_download_failed");
    const blob = await response.blob();
    const mime = blob.type.split(";")[0].toLowerCase();
    const extension = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : null;
    if (!extension || !blob.size) throw new Error("invalid_slide");
    return new File([blob], `marken-slide-${String(index + 1).padStart(2, "0")}.${extension}`, { type: mime });
  }));
}

// Call directly from the final Share click, after preparation has finished.
export async function sharePreparedFiles(files: File[], device: Pick<Navigator, "share" | "canShare"> = navigator): Promise<"handed-off" | "cancelled" | "unsupported"> {
  if (!files.length || !device.share || !device.canShare?.({ files })) return "unsupported";
  try {
    await device.share({ files });
    return "handed-off";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
    throw error;
  }
}
