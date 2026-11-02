import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Share } from "@capacitor/share";

/** True inside the iPad/iOS app, false in the browser. */
export const isNative = Capacitor.isNativePlatform();

/** A short tap on the device; no-op in the browser. */
export function haptic(style: "light" | "medium" = "medium"): void {
  if (!isNative) return;
  Haptics.impact({
    style: style === "light" ? ImpactStyle.Light : ImpactStyle.Medium,
  }).catch(() => undefined);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Hands a generated file to the user: a download in the browser, the iOS
 * share sheet (Dateien, AirDrop, Mail …) in the app.
 */
export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({ title: filename, files: [uri] });
}
