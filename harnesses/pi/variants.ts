/**
 * /variants — OpenCode-style effort/thinking picker for pi.
 *
 * In pi, "variants" map to thinking levels (off/minimal/low/medium/high/xhigh/max).
 *
 * Usage:
 *   /variants              open selector for levels supported by the current model
 *   /variants high         set effort directly
 *   /variant medium        singular alias
 *
 * Status chip: variant:<level>
 *
 * Install via `npm run setup:pi` (copies harnesses/pi/variants.ts to
 * ~/.pi/agent/extensions/variants.ts). Restart pi so the command is registered.
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

const LEVEL_DESCRIPTIONS: Record<ThinkingLevel, string> = {
	off: "No reasoning",
	minimal: "Very brief reasoning (~1k tokens)",
	low: "Light reasoning (~2k tokens)",
	medium: "Moderate reasoning (~8k tokens)",
	high: "Deep reasoning (~16k tokens)",
	xhigh: "Extra-high reasoning (~32k tokens)",
	max: "Maximum reasoning",
};

const ALL_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
const DEFAULT_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high"];

function isThinkingLevel(value: string): value is ThinkingLevel {
	return (ALL_LEVELS as string[]).includes(value);
}

/**
 * Mirror of pi-ai getSupportedThinkingLevels:
 * - non-reasoning → ["off"]
 * - xhigh/max only if thinkingLevelMap has a non-undefined entry
 * - any level with map value null is hidden
 */
function availableLevels(ctx: ExtensionContext): ThinkingLevel[] {
	const model = ctx.model as
		| {
				reasoning?: boolean;
				thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
		  }
		| undefined;

	if (!model) return DEFAULT_LEVELS;
	if (!model.reasoning) return ["off"];

	const map = model.thinkingLevelMap;
	return ALL_LEVELS.filter((level) => {
		const mapped = map?.[level];
		if (mapped === null) return false;
		if (level === "xhigh" || level === "max") return mapped !== undefined;
		return true;
	});
}

function updateVariantStatus(ctx: ExtensionContext, level: ThinkingLevel) {
	const theme = ctx.ui.theme;
	ctx.ui.setStatus("variant", theme.fg("accent", `variant:${level}`));
}

async function setVariant(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext | ExtensionContext,
	level: ThinkingLevel,
	available: ThinkingLevel[],
): Promise<void> {
	if (!available.includes(level)) {
		ctx.ui.notify(
			`Variant "${level}" not supported by current model. Available: ${available.join(", ")}`,
			"error",
		);
		return;
	}

	const previous = pi.getThinkingLevel() as ThinkingLevel;
	pi.setThinkingLevel(level);
	const applied = pi.getThinkingLevel() as ThinkingLevel;

	updateVariantStatus(ctx, applied);

	if (applied === previous) {
		ctx.ui.notify(`Variant already ${applied}`, "info");
		return;
	}

	if (applied !== level) {
		ctx.ui.notify(`Variant clamped: ${level} → ${applied}`, "warning");
		return;
	}

	ctx.ui.notify(`Variant: ${applied}`, "info");
}

async function showVariantSelector(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	levels: ThinkingLevel[],
): Promise<void> {
	const current = pi.getThinkingLevel() as ThinkingLevel;

	const items: SelectItem[] = levels.map((level) => ({
		value: level,
		label: level === current ? `${level} (current)` : level,
		description: LEVEL_DESCRIPTIONS[level],
	}));

	const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Select Variant (effort)"))));

		const selectList = new SelectList(items, Math.min(items.length, 10), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		const currentIndex = items.findIndex((item) => item.value === current);
		if (currentIndex >= 0) {
			selectList.setSelectedIndex(currentIndex);
		}

		selectList.onSelect = (item) => done(item.value);
		selectList.onCancel = () => done(null);

		container.addChild(selectList);
		container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

		return {
			render(width: number) {
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
			},
			handleInput(data: string) {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	});

	if (!result || !isThinkingLevel(result)) return;
	await setVariant(pi, ctx, result, levels);
}

function registerVariantsCommand(pi: ExtensionAPI, name: string, description: string) {
	pi.registerCommand(name, {
		description,
		getArgumentCompletions: (prefix) => {
			const needle = prefix.trim().toLowerCase();
			return ALL_LEVELS.filter((level) => level.startsWith(needle)).map((level) => ({
				value: level,
				label: level,
				description: LEVEL_DESCRIPTIONS[level],
			}));
		},
		handler: async (args, ctx) => {
			const levels = availableLevels(ctx);

			if (!ctx.model?.reasoning) {
				ctx.ui.notify("No variants (current model does not support thinking/reasoning)", "warning");
				return;
			}

			const raw = args?.trim().toLowerCase();
			if (raw) {
				if (!isThinkingLevel(raw)) {
					ctx.ui.notify(`Unknown variant "${raw}". Available: ${levels.join(", ")}`, "error");
					return;
				}
				await setVariant(pi, ctx, raw, levels);
				return;
			}

			await showVariantSelector(pi, ctx, levels);
		},
	});
}

export default function variantsExtension(pi: ExtensionAPI) {
	registerVariantsCommand(pi, "variants", "Select thinking/effort variant (OpenCode-style)");
	registerVariantsCommand(pi, "variant", "Alias for /variants");

	pi.on("session_start", async (_event, ctx) => {
		updateVariantStatus(ctx, pi.getThinkingLevel() as ThinkingLevel);
	});

	pi.on("thinking_level_select", async (event, ctx) => {
		updateVariantStatus(ctx, event.level as ThinkingLevel);
	});

	pi.on("model_select", async (_event, ctx) => {
		updateVariantStatus(ctx, pi.getThinkingLevel() as ThinkingLevel);
	});
}
