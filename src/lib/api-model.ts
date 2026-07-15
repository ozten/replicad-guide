/**
 * Normalizes TypeDoc JSON (schema 2.0, typedoc pinned in package.json) into
 * the guide's reference model: every public export with an inline signature,
 * params/defaults, and description — no click-through for args (R6/R13).
 *
 * Pure data transform: no I/O, no typedoc import. scripts/generate-api.ts
 * feeds it the real JSON; tests feed it fixtures.
 */

export type ApiKind = "function" | "class" | "interface" | "type" | "variable";

export type ParamDoc = {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
  description?: string;
};

export type MemberDoc = {
  name: string;
  kind: "constructor" | "method" | "property" | "accessor";
  isStatic: boolean;
  /** Full inline signature, e.g. `fillet(radius: RadiusConfig, filter?: …): this`. */
  signature: string;
  /** Additional overload signatures beyond the first. */
  overloads?: string[];
  description?: string;
  deprecated?: boolean;
};

export type ApiSymbol = {
  name: string;
  kind: ApiKind;
  /** Primary signature line (functions: first overload; classes: header). */
  signature: string;
  overloads?: string[];
  description?: string;
  params?: ParamDoc[];
  returns?: string;
  /** Base classes / extended interfaces, by name (in-page anchor targets). */
  extends?: string[];
  members?: MemberDoc[];
  sourceUrl?: string;
  /** Raw `@category` tag when the source carries one. */
  category?: string;
  /** Source fileName relative to the checkout — the grouping seed. */
  file: string;
  deprecated?: boolean;
};

// TypeDoc reflection kinds (typedoc's ReflectionKind enum values).
const KIND = {
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  Accessor: 262144,
  TypeAlias: 2097152,
} as const;

const API_KIND_BY_REFLECTION: Record<number, ApiKind> = {
  [KIND.Variable]: "variable",
  [KIND.Function]: "function",
  [KIND.Class]: "class",
  [KIND.Interface]: "interface",
  [KIND.TypeAlias]: "type",
};

/* ---------------------------------------------------------------- types --- */

type TypeNode = {
  type?: string;
  name?: string;
  value?: unknown;
  types?: TypeNode[];
  elementType?: TypeNode;
  elements?: TypeNode[];
  typeArguments?: TypeNode[];
  declaration?: Reflection;
  targetType?: TypeNode;
  asserts?: boolean;
  operator?: string;
  target?: unknown;
};

type CommentPart = { kind: string; text: string };
type Comment = {
  summary?: CommentPart[];
  blockTags?: { tag: string; content: CommentPart[] }[];
};

type Reflection = {
  id?: number;
  name: string;
  kind: number;
  flags?: {
    isOptional?: boolean;
    isRest?: boolean;
    isStatic?: boolean;
    isReadonly?: boolean;
  };
  comment?: Comment;
  children?: Reflection[];
  signatures?: Reflection[];
  getSignature?: Reflection;
  setSignature?: Reflection;
  parameters?: Reflection[];
  typeParameters?: Reflection[];
  type?: TypeNode;
  defaultValue?: string;
  extendedTypes?: TypeNode[];
  inheritedFrom?: unknown;
  indexSignatures?: Reflection[];
  sources?: { fileName: string; url?: string }[];
};

export type TypedocJson = {
  schemaVersion?: string;
  children?: Reflection[];
};

/** Renders a TypeDoc type node as TypeScript source text. */
export function stringifyType(node: TypeNode | undefined): string {
  if (!node) return "unknown";
  switch (node.type) {
    case "intrinsic":
      return node.name ?? "unknown";
    case "reference": {
      const args = node.typeArguments?.length
        ? `<${node.typeArguments.map(stringifyType).join(", ")}>`
        : "";
      return `${node.name ?? "unknown"}${args}`;
    }
    case "literal":
      return typeof node.value === "string"
        ? JSON.stringify(node.value)
        : String(node.value);
    case "array": {
      const element = stringifyType(node.elementType);
      // unions bind looser than [] — parenthesize
      return node.elementType?.type === "union"
        ? `(${element})[]`
        : `${element}[]`;
    }
    case "union":
      return (node.types ?? [])
        .map((member) => {
          const text = stringifyType(member);
          // function types bind looser than | — parenthesize inside unions
          const isFunctionType =
            member.type === "reflection" &&
            Boolean(member.declaration?.signatures?.length);
          return isFunctionType ? `(${text})` : text;
        })
        .join(" | ");
    case "tuple":
      return `[${(node.elements ?? []).map(stringifyType).join(", ")}]`;
    case "predicate":
      return `${node.name} is ${stringifyType(node.targetType)}`;
    case "typeOperator":
      return `${node.operator} ${stringifyType(node.target as TypeNode)}`;
    case "reflection":
      return stringifyReflectionType(node.declaration);
    default:
      return node.name ?? "unknown";
  }
}

/** Inline object / function types ({ a: T } and (x) => R reflections). */
function stringifyReflectionType(declaration: Reflection | undefined): string {
  if (!declaration) return "object";
  if (declaration.signatures?.length) {
    const sig = declaration.signatures[0];
    return `(${renderParams(sig.parameters)}) => ${stringifyType(sig.type)}`;
  }
  const props = (declaration.children ?? []).map((child) => {
    const optional = child.flags?.isOptional ? "?" : "";
    return `${child.name}${optional}: ${stringifyType(child.type)}`;
  });
  const indexes = (declaration.indexSignatures ?? []).map((sig) => {
    const param = sig.parameters?.[0];
    return `[${param?.name ?? "key"}: ${stringifyType(param?.type)}]: ${stringifyType(sig.type)}`;
  });
  const body = [...props, ...indexes];
  return body.length > 0 ? `{ ${body.join("; ")} }` : "object";
}

function renderParams(parameters: Reflection[] | undefined): string {
  return (parameters ?? [])
    .map((param) => {
      const rest = param.flags?.isRest ? "..." : "";
      // an initialized param is optional for callers even without the ? flag;
      // TypeDoc collapses complex initializers to a literal "..." — drop those
      const hasDefault = Boolean(param.defaultValue) && param.defaultValue !== "...";
      const optional = param.flags?.isOptional || param.defaultValue ? "?" : "";
      const fallback = hasDefault ? ` = ${param.defaultValue}` : "";
      return `${rest}${param.name}${optional}: ${stringifyType(param.type)}${fallback}`;
    })
    .join(", ");
}

function renderTypeParams(typeParameters: Reflection[] | undefined): string {
  if (!typeParameters?.length) return "";
  const rendered = typeParameters.map((tp) => {
    const constraint = tp.type ? ` extends ${stringifyType(tp.type)}` : "";
    return `${tp.name}${constraint}`;
  });
  return `<${rendered.join(", ")}>`;
}

/** One call signature as source text; `prefix` names it (fn name / `new X`). */
function renderSignature(sig: Reflection, prefix: string): string {
  const typeParams = renderTypeParams(sig.typeParameters);
  const params = renderParams(sig.parameters);
  const returns = stringifyType(sig.type);
  return `${prefix}${typeParams}(${params}): ${returns}`;
}

/* ------------------------------------------------------------- comments --- */

/** Flattens TypeDoc comment parts to markdown-ish text (code parts keep their backticks). */
function partsToText(parts: CommentPart[] | undefined): string {
  return (parts ?? [])
    .map((part) => (part.kind === "inline-tag" ? part.text : part.text))
    .join("")
    .trim();
}

function commentText(comment: Comment | undefined): string | undefined {
  const text = partsToText(comment?.summary);
  return text || undefined;
}

function blockTag(comment: Comment | undefined, tag: string): string | undefined {
  const found = comment?.blockTags?.find((entry) => entry.tag === tag);
  return found ? partsToText(found.content) || undefined : undefined;
}

function hasTag(comment: Comment | undefined, tag: string): boolean {
  return Boolean(comment?.blockTags?.some((entry) => entry.tag === tag));
}

/** A declaration's doc comment lives on it or on its first signature. */
function docComment(reflection: Reflection): Comment | undefined {
  return reflection.comment ?? reflection.signatures?.[0]?.comment;
}

/* -------------------------------------------------------------- symbols --- */

function paramDocs(sig: Reflection | undefined): ParamDoc[] {
  return (sig?.parameters ?? []).map((param) => ({
    name: param.flags?.isRest ? `...${param.name}` : param.name,
    type: stringifyType(param.type),
    optional: Boolean(param.flags?.isOptional || param.defaultValue),
    ...(param.defaultValue && param.defaultValue !== "..."
      ? { defaultValue: param.defaultValue }
      : {}),
    ...(commentText(param.comment) ? { description: commentText(param.comment) } : {}),
  }));
}

function memberFromChild(child: Reflection): MemberDoc | null {
  if (child.inheritedFrom) return null; // parent card documents these
  const isStatic = Boolean(child.flags?.isStatic);

  if (child.kind === KIND.Constructor) {
    const sigs = child.signatures ?? [];
    if (sigs.length === 0) return null;
    const [first, ...rest] = sigs.map((sig) =>
      renderSignature(sig, `new ${sig.type?.name ?? sig.name}`),
    );
    return {
      name: "constructor",
      kind: "constructor",
      isStatic: false,
      signature: first,
      ...(rest.length ? { overloads: rest } : {}),
      ...(commentText(docComment(child)) ? { description: commentText(docComment(child)) } : {}),
    };
  }

  if (child.kind === KIND.Method) {
    const sigs = child.signatures ?? [];
    if (sigs.length === 0) return null;
    const [first, ...rest] = sigs.map((sig) => renderSignature(sig, child.name));
    return {
      name: child.name,
      kind: "method",
      isStatic,
      signature: first,
      ...(rest.length ? { overloads: rest } : {}),
      ...(commentText(docComment(child)) ? { description: commentText(docComment(child)) } : {}),
      ...(hasTag(docComment(child), "@deprecated") ? { deprecated: true } : {}),
    };
  }

  if (child.kind === KIND.Property) {
    const optional = child.flags?.isOptional ? "?" : "";
    return {
      name: child.name,
      kind: "property",
      isStatic,
      signature: `${child.name}${optional}: ${stringifyType(child.type)}`,
      ...(commentText(child.comment) ? { description: commentText(child.comment) } : {}),
      ...(hasTag(child.comment, "@deprecated") ? { deprecated: true } : {}),
    };
  }

  if (child.kind === KIND.Accessor) {
    const getter = child.getSignature;
    const signature = getter
      ? `${child.name}: ${stringifyType(getter.type)}`
      : `set ${child.name}(${renderParams(child.setSignature?.parameters)})`;
    const comment = getter?.comment ?? child.comment;
    return {
      name: child.name,
      kind: "accessor",
      isStatic,
      signature,
      ...(commentText(comment) ? { description: commentText(comment) } : {}),
      ...(hasTag(comment, "@deprecated") ? { deprecated: true } : {}),
    };
  }

  return null;
}

function symbolFromReflection(reflection: Reflection): ApiSymbol | null {
  const kind = API_KIND_BY_REFLECTION[reflection.kind];
  if (!kind) return null;

  const source =
    reflection.sources?.[0] ?? reflection.signatures?.[0]?.sources?.[0];
  const comment = docComment(reflection);

  const base: ApiSymbol = {
    name: reflection.name,
    kind,
    signature: "",
    file: source?.fileName ?? "",
    ...(source?.url ? { sourceUrl: source.url } : {}),
    ...(commentText(comment) ? { description: commentText(comment) } : {}),
    ...(blockTag(comment, "@category") ? { category: blockTag(comment, "@category") } : {}),
    ...(hasTag(comment, "@deprecated") ? { deprecated: true } : {}),
  };

  if (kind === "function") {
    const sigs = reflection.signatures ?? [];
    if (sigs.length === 0) return null;
    const [first, ...rest] = sigs.map((sig) => renderSignature(sig, reflection.name));
    return {
      ...base,
      signature: first,
      ...(rest.length ? { overloads: rest } : {}),
      params: paramDocs(sigs[0]),
      ...(blockTag(sigs[0].comment, "@returns")
        ? { returns: blockTag(sigs[0].comment, "@returns") }
        : {}),
    };
  }

  if (kind === "variable") {
    return { ...base, signature: `const ${reflection.name}: ${stringifyType(reflection.type)}` };
  }

  if (kind === "type") {
    // object-literal aliases (`type X = { … }`) carry property children
    // instead of a type node
    const body =
      !reflection.type && reflection.children?.length
        ? stringifyReflectionType(reflection)
        : stringifyType(reflection.type);
    return { ...base, signature: `type ${reflection.name}${renderTypeParams(reflection.typeParameters)} = ${body}` };
  }

  // class / interface
  const heritage = (reflection.extendedTypes ?? []).map(stringifyType);
  const keyword = kind === "class" ? "class" : "interface";
  const extendsClause = heritage.length ? ` extends ${heritage.join(", ")}` : "";
  const members = (reflection.children ?? [])
    .map(memberFromChild)
    .filter((member): member is MemberDoc => member !== null);

  return {
    ...base,
    signature: `${keyword} ${reflection.name}${renderTypeParams(reflection.typeParameters)}${extendsClause}`,
    ...(heritage.length ? { extends: heritage.map((h) => h.replace(/<.*$/, "")) } : {}),
    members,
  };
}

/**
 * Every documentable top-level export in the TypeDoc JSON, in source order.
 * Throws when the JSON has no children — an empty reference is never valid.
 */
export function extractSymbols(json: TypedocJson): ApiSymbol[] {
  const children = json.children ?? [];
  if (children.length === 0) {
    throw new Error(
      "TypeDoc JSON has no exports — wrong entry point or typedoc failure",
    );
  }
  const symbols = children
    .map(symbolFromReflection)
    .filter((symbol): symbol is ApiSymbol => symbol !== null);

  const dropped = children.length - symbols.length;
  if (dropped > 0) {
    const known = new Set(Object.keys(API_KIND_BY_REFLECTION).map(Number));
    const names = children
      .filter((child) => !known.has(child.kind))
      .map((child) => `${child.name} (kind ${child.kind})`);
    throw new Error(
      `TypeDoc JSON contains unsupported reflection kinds — extend api-model.ts: ${names.join(", ")}`,
    );
  }

  return symbols;
}

/* ------------------------------------------------------------- grouping --- */

export type GroupDef = {
  id: string;
  title: string;
  blurb?: string;
  /** Legacy groups render signature+doc only — no examples allowed (R10/R14). */
  legacy?: boolean;
  /** Symbols listed here render first, in this order; the rest follow sorted. */
  pinned?: string[];
};

export type Curation = {
  groups: GroupDef[];
  /**
   * Grouping seed: source fileName (exact, e.g. "draw.ts") or directory
   * prefix (trailing slash, e.g. "finders/") → group id. New exports in
   * known files land automatically; a new file fails loudly until mapped.
   */
  groupByFile: Record<string, string>;
  /** Per-symbol group override (e.g. drawProjection lives in draw.ts but belongs to projection). */
  groupOverrides: Record<string, string>;
  /** Curated per-symbol metadata: entry point (R4) and quick-ref examples to embed (R14). */
  symbols: Record<string, { entryPoint?: string; exampleIds?: string[] }>;
};

export type RefEntry = ApiSymbol & {
  /** How you obtain the object (R4) — curated, or derived from the constructor. */
  entryPoint?: string;
  /** Quick-ref example ids whose code+visual this entry embeds. */
  exampleIds?: string[];
  legacy?: boolean;
};

export type RefGroup = {
  id: string;
  title: string;
  blurb?: string;
  legacy?: boolean;
  entries: RefEntry[];
};

export type ReferenceModel = { groups: RefGroup[] };

const KIND_ORDER: Record<ApiKind, number> = {
  function: 0,
  class: 1,
  interface: 2,
  type: 3,
  variable: 4,
};

function resolveGroup(symbol: ApiSymbol, curation: Curation): string | undefined {
  const override = curation.groupOverrides[symbol.name];
  if (override) return override;
  const exact = curation.groupByFile[symbol.file];
  if (exact) return exact;
  // longest matching directory prefix wins
  let best: string | undefined;
  let bestLength = -1;
  for (const [prefix, group] of Object.entries(curation.groupByFile)) {
    if (!prefix.endsWith("/")) continue;
    if (symbol.file.startsWith(prefix) && prefix.length > bestLength) {
      best = group;
      bestLength = prefix.length;
    }
  }
  return best;
}

/**
 * Groups the extracted symbols by concept (R13) and applies the curated
 * overlay. Validates the reconciliation both ways and throws listing every
 * violation: an uncurated source file (new exports on a ref bump) and a
 * curated symbol that no longer exists (rename) both fail the build.
 */
export function buildReferenceModel(
  symbols: ApiSymbol[],
  curation: Curation,
  knownExampleIds?: Set<string>,
): ReferenceModel {
  const errors: string[] = [];
  const groupIds = new Set(curation.groups.map((group) => group.id));
  const symbolsByName = new Map(symbols.map((symbol) => [symbol.name, symbol]));

  if (symbolsByName.size !== symbols.length) {
    const seen = new Set<string>();
    for (const symbol of symbols) {
      if (seen.has(symbol.name)) {
        errors.push(`duplicate exported symbol name "${symbol.name}" — anchors would collide`);
      }
      seen.add(symbol.name);
    }
  }

  for (const [target, groupId] of Object.entries(curation.groupByFile)) {
    if (!groupIds.has(groupId)) {
      errors.push(`groupByFile["${target}"] names unknown group "${groupId}"`);
    }
  }
  for (const [name, groupId] of Object.entries(curation.groupOverrides)) {
    if (!symbolsByName.has(name)) {
      errors.push(`groupOverrides names unknown symbol "${name}" (renamed or removed upstream?)`);
    }
    if (!groupIds.has(groupId)) {
      errors.push(`groupOverrides["${name}"] names unknown group "${groupId}"`);
    }
  }
  for (const [name, meta] of Object.entries(curation.symbols)) {
    if (!symbolsByName.has(name)) {
      errors.push(`curated symbol "${name}" is not in the export set (renamed or removed upstream?)`);
    }
    for (const exampleId of meta.exampleIds ?? []) {
      if (knownExampleIds && !knownExampleIds.has(exampleId)) {
        errors.push(`curated symbol "${name}" references unknown example id "${exampleId}"`);
      }
    }
  }
  for (const group of curation.groups) {
    for (const pinnedName of group.pinned ?? []) {
      if (!symbolsByName.has(pinnedName)) {
        errors.push(`group "${group.id}" pins unknown symbol "${pinnedName}"`);
      }
    }
  }

  const entriesByGroup = new Map<string, RefEntry[]>(
    curation.groups.map((group) => [group.id, []]),
  );

  for (const symbol of symbols) {
    const groupId = resolveGroup(symbol, curation);
    if (!groupId || !entriesByGroup.has(groupId)) {
      errors.push(
        `symbol "${symbol.name}" (${symbol.file}) has no group — add its file to groupByFile or an override`,
      );
      continue;
    }
    const groupDef = curation.groups.find((group) => group.id === groupId)!;
    const curated = curation.symbols[symbol.name] ?? {};

    if (groupDef.legacy && curated.exampleIds?.length) {
      errors.push(
        `legacy symbol "${symbol.name}" must not embed examples — signature+doc only (R10/R14)`,
      );
    }

    const constructorMember = symbol.members?.find(
      (member) => member.kind === "constructor",
    );
    const entryPoint =
      curated.entryPoint ??
      (symbol.kind === "class" ? constructorMember?.signature : undefined);

    entriesByGroup.get(groupId)!.push({
      ...symbol,
      ...(entryPoint ? { entryPoint } : {}),
      ...(curated.exampleIds?.length && !groupDef.legacy
        ? { exampleIds: curated.exampleIds }
        : {}),
      ...(groupDef.legacy ? { legacy: true } : {}),
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `reference curation violations:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  const groups: RefGroup[] = curation.groups.map((group) => {
    const entries = entriesByGroup.get(group.id)!;
    const pinned = group.pinned ?? [];
    const rank = new Map(pinned.map((name, index) => [name, index]));
    entries.sort((a, b) => {
      const aRank = rank.has(a.name) ? rank.get(a.name)! : Infinity;
      const bRank = rank.has(b.name) ? rank.get(b.name)! : Infinity;
      if (aRank !== bRank) return aRank - bRank;
      if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) {
        return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      }
      return a.name.localeCompare(b.name);
    });
    return {
      id: group.id,
      title: group.title,
      ...(group.blurb ? { blurb: group.blurb } : {}),
      ...(group.legacy ? { legacy: true } : {}),
      entries,
    };
  });

  const empty = groups.filter((group) => group.entries.length === 0);
  if (empty.length > 0) {
    throw new Error(
      `reference groups with no entries: ${empty.map((group) => group.id).join(", ")} — remove them or fix the file map`,
    );
  }

  return { groups };
}
