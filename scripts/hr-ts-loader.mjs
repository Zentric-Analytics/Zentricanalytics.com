import fs from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidate = (base) => [base, `${base}.ts`, path.join(base, "index.ts")].find((value) => fs.existsSync(value) && fs.statSync(value).isFile());

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const resolved = candidate(path.join(root, "src", specifier.slice(2)));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const resolved = candidate(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (resolved?.endsWith(".ts")) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) return { format: "module", source: stripTypeScriptTypes(fs.readFileSync(fileURLToPath(url), "utf8"), { mode: "transform" }), shortCircuit: true };
    return nextLoad(url, context);
  },
});
