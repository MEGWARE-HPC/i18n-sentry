import { readdirSync, readFileSync, statSync } from "fs";
import { extname, join } from "path";

const SKIP_DIRS = new Set(["node_modules", ".nuxt", ".output", ".git", "dist"]);

export const EXTENSIONS = [".vue", ".ts", ".js", ".tsx", ".jsx", ".svelte"];

export function collectFiles(dir: string, exts: string[] = EXTENSIONS): string[] {
    const results: string[] = [];

    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(dir, entry);

        if (statSync(full).isDirectory()) {
            results.push(...collectFiles(full, exts));
        } else if (exts.includes(extname(entry))) {
            results.push(full);
        }
    }

    return results;
}

export function readJson(path: string): Record<string, unknown> {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function readFile(path: string): string {
    return readFileSync(path, "utf8");
}

export function getLine(source: string, index: number): number {
    return source.substring(0, index).split("\n").length;
}
