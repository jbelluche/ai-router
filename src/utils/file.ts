import { join, dirname } from "path";

export async function saveMedia(
  data: string | Uint8Array,
  options: {
    directory: string;
    filename?: string;
    type: "image" | "audio" | "video";
    format: string;
  }
): Promise<string> {
  const timestamp = Date.now();
  const filename =
    options.filename ?? `${options.type}_${timestamp}.${options.format}`;
  const filepath = join(options.directory, filename);

  await Bun.$`mkdir -p ${options.directory}`.quiet();

  let content: Uint8Array;
  if (typeof data === "string") {
    content = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  } else {
    content = data;
  }

  await Bun.write(filepath, content);
  return filepath;
}

export async function ensureDirectory(path: string): Promise<void> {
  await Bun.$`mkdir -p ${path}`.quiet();
}

export async function fileExists(path: string): Promise<boolean> {
  const file = Bun.file(path);
  return file.exists();
}

export async function readFile(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${path}`);
  }
  return file.text();
}

export async function writeFile(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  await ensureDirectory(dir);
  await Bun.write(path, content);
}

export function getOutputPath(
  outputDir: string,
  type: "image" | "audio" | "video",
  format: string,
  customPath?: string
): string {
  if (customPath) {
    return customPath;
  }
  const timestamp = Date.now();
  return join(outputDir, `${type}_${timestamp}.${format}`);
}
