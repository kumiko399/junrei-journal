import { invoke } from "@tauri-apps/api/core";

const isTauri = () => "__TAURI_INTERNALS__" in window;

export async function chooseLegacyExport(): Promise<unknown | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false, filters: [{ name: "旧网站导出", extensions: ["json"] }] });
    if (!path) return null;
    return invoke<unknown>("read_legacy_export", { sourcePath: path });
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json";
    input.onchange = async () => { try { const file = input.files?.[0]; resolve(file ? JSON.parse(await file.text()) : null); } catch (error) { reject(error); } };
    input.click();
  });
}
