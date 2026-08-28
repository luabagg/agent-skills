import {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
} from "jsonc-parser";

export function parseJsonc(input, filePath = "JSONC input") {
  if (!input) return {};
  const errors = [];
  const value = parse(input, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length) {
    const detail = errors
      .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Unable to parse ${filePath}: ${detail}`);
  }
  return value;
}

export function setJsoncValue(input, path, value, filePath = "JSONC input") {
  parseJsonc(input, filePath);
  const eol = input.includes("\r\n") ? "\r\n" : "\n";
  const edits = modify(input, path, value, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol },
  });
  const next = applyEdits(input, edits);
  parseJsonc(next, filePath);
  return next;
}

export function insertJsoncObjectProperty(input, name, value, filePath = "JSONC input") {
  const parsed = parseJsonc(input, filePath);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a top-level object`);
  }
  if (Object.hasOwn(parsed, name)) {
    throw new Error(`${filePath} already has ${JSON.stringify(name)}`);
  }
  return setJsoncValue(input, [name], value, filePath);
}
