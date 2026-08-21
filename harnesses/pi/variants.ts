/**
 * Claude-style /models picker for pi: model + effort + fast mode.
 *
 * Pi has no native "fast mode" — some providers expose a sibling model
 * (`grok-4.6-fast`, `*-highspeed`, `*-turbo`). Those are grouped onto the
 * base model and toggled like Claude Code's Fast mode.
 *
 * Usage:
 *   /models                 open picker (model list, ←→ effort, tab fast)
 *   /models grok-4.6        switch model (optional :effort, e.g. grok-4.6:high)
 *   /effort                 pick effort for the current model
 *   /effort medium          set effort directly
 *   /fast                   toggle fast sibling for the current model
 *   /fast on|off
 *   /variants, /variant     aliases for /models
 *
 * Status chips: effort:<level> and fast (when on).
 *
 * Install via Agentfolio pi setup (copies to ~/.pi/agent/extensions/variants.ts).
 * Restart pi so the commands are registered.
 */

import type { Model } from "@earendil-works/pi-ai";
import { clampThinkingLevel, getSupportedThinkingLevels, modelsAreEqual } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import {
	Container,
	type Focusable,
	fuzzyFilter,
	getKeybindings,
	Input,
	Key,
	matchesKey,
	type SelectItem,
	SelectList,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

type Theme = {
	fg(color: string, text: string): string;
	bold(text: string): string;
};

type PickerResult = {
	model: Model;
	thinkingLevel: ThinkingLevel;
};

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
const FAST_SUFFIXES = ["-fast", "-highspeed", "-turbo"] as const;
const THINKING_COLORS: Record<ThinkingLevel, string> = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
	max: "thinkingMax",
};

function isThinkingLevel(value: string): value is ThinkingLevel {
	return (ALL_LEVELS as string[]).includes(value);
}

function levelsFor(model: Model | undefined): ThinkingLevel[] {
	if (!model) return ["off"];
	return getSupportedThinkingLevels(model) as ThinkingLevel[];
}

function supportsEffort(model: Model | undefined): boolean {
	const levels = levelsFor(model);
	return Boolean(model?.reasoning) && levels.some((level) => level !== "off");
}

function fastSuffixOf(id: string): (typeof FAST_SUFFIXES)[number] | undefined {
	return FAST_SUFFIXES.find((suffix) => id.endsWith(suffix));
}

function baseModelId(id: string): string {
	const suffix = fastSuffixOf(id);
	return suffix ? id.slice(0, -suffix.length) : id;
}

function isFastModelId(id: string): boolean {
	return fastSuffixOf(id) !== undefined;
}

type ModelRow = {
	key: string;
	model: Model;
	fastModel?: Model;
	searchText: string;
};

type RowDraft = {
	effort: ThinkingLevel;
	fast: boolean;
};

function modelKey(model: Model): string {
	return `${model.provider}/${model.id}`;
}

function rowSearchText(row: ModelRow): string {
	const ids = [row.model.id, row.fastModel?.id].filter(Boolean).join(" ");
	const name = row.model.name ? ` ${row.model.name}` : "";
	const fastName = row.fastModel?.name ? ` ${row.fastModel.name}` : "";
	return `${row.model.provider} ${row.model.provider}/${row.model.id} ${ids}${name}${fastName}`;
}

function buildRows(models: readonly Model[]): ModelRow[] {
	const grouped = new Map<string, ModelRow>();

	for (const model of models) {
		const baseId = baseModelId(model.id);
		const key = `${model.provider}/${baseId}`;
		const existing = grouped.get(key);
		const fast = isFastModelId(model.id);

		if (!existing) {
			grouped.set(key, {
				key,
				model,
				fastModel: fast ? model : undefined,
				searchText: "",
			});
			continue;
		}

		if (fast) {
			if (!existing.fastModel || existing.fastModel.id === existing.model.id) {
				existing.fastModel = model;
			}
			if (isFastModelId(existing.model.id)) existing.model = model;
		} else {
			existing.model = model;
		}
	}

	const rows = [...grouped.values()].filter((row) => {
		// A fast-only id with no standard sibling still shows as its own row.
		if (isFastModelId(row.model.id) && row.fastModel && row.fastModel.id === row.model.id) {
			row.fastModel = undefined;
		}
		return true;
	});

	for (const row of rows) row.searchText = rowSearchText(row);
	return rows;
}

function sortRows(rows: ModelRow[], current: Model | undefined): ModelRow[] {
	return [...rows].sort((a, b) => {
		const aCurrent = isCurrentRow(a, current);
		const bCurrent = isCurrentRow(b, current);
		if (aCurrent && !bCurrent) return -1;
		if (!aCurrent && bCurrent) return 1;
		const provider = a.model.provider.localeCompare(b.model.provider);
		if (provider !== 0) return provider;
		return a.model.id.localeCompare(b.model.id);
	});
}

function isCurrentRow(row: ModelRow, current: Model | undefined): boolean {
	if (!current) return false;
	return modelsAreEqual(row.model, current) || (row.fastModel ? modelsAreEqual(row.fastModel, current) : false);
}

function targetModel(row: ModelRow, fast: boolean): Model {
	return fast && row.fastModel ? row.fastModel : row.model;
}

function defaultDraft(row: ModelRow, current: Model | undefined, currentEffort: ThinkingLevel): RowDraft {
	const onFast = Boolean(current && row.fastModel && modelsAreEqual(row.fastModel, current));
	const model = targetModel(row, onFast);
	return {
		effort: clampThinkingLevel(model, currentEffort) as ThinkingLevel,
		fast: onFast,
	};
}

function catalogModels(ctx: ExtensionContext, scope: "scoped" | "all"): Model[] {
	if (scope === "scoped" && ctx.scopedModels.length > 0) {
		return ctx.scopedModels.map((item) => item.model);
	}
	return ctx.modelRegistry.getAvailable();
}

function findModel(models: readonly Model[], query: string): Model | undefined {
	const needle = query.trim();
	if (!needle) return undefined;

	const exact = models.find((model) => modelKey(model) === needle || model.id === needle);
	if (exact) return exact;

	const matches = fuzzyFilter(models, needle, (model) =>
		`${model.provider} ${model.provider}/${model.id} ${model.id} ${model.name ?? ""}`,
	);
	return matches[0];
}

function parseModelArg(raw: string): { query: string; effort?: ThinkingLevel } {
	const trimmed = raw.trim();
	const split = trimmed.lastIndexOf(":");
	if (split > 0) {
		const maybeLevel = trimmed.slice(split + 1).toLowerCase();
		if (isThinkingLevel(maybeLevel)) {
			return { query: trimmed.slice(0, split), effort: maybeLevel };
		}
	}
	return { query: trimmed };
}

function updateStatus(ctx: ExtensionContext, pi: ExtensionAPI) {
	const theme = ctx.ui.theme;
	const level = pi.getThinkingLevel() as ThinkingLevel;
	ctx.ui.setStatus("effort", theme.fg("accent", `effort:${level}`));

	const fast = ctx.model ? isFastModelId(ctx.model.id) : false;
	ctx.ui.setStatus("fast", fast ? theme.fg("accent", "fast") : undefined);
}

async function applySelection(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext | ExtensionContext,
	model: Model,
	effort: ThinkingLevel,
): Promise<void> {
	const previousModel = ctx.model;
	const previousEffort = pi.getThinkingLevel() as ThinkingLevel;
	const previousFast = previousModel ? isFastModelId(previousModel.id) : false;
	const nextFast = isFastModelId(model.id);

	if (!previousModel || !modelsAreEqual(previousModel, model)) {
		const ok = await pi.setModel(model);
		if (!ok) {
			ctx.ui.notify(`No API key for ${model.provider}/${model.id}`, "error");
			return;
		}
	}

	if (supportsEffort(model)) {
		pi.setThinkingLevel(effort);
	}

	const applied = pi.getThinkingLevel() as ThinkingLevel;
	updateStatus(ctx, pi);

	const modelChanged = !previousModel || !modelsAreEqual(previousModel, model);
	const effortChanged = applied !== previousEffort;
	const fastChanged = previousFast !== nextFast;

	if (!modelChanged && !effortChanged && !fastChanged) {
		ctx.ui.notify(`Already on ${model.id} (${applied})`, "info");
		return;
	}

	const bits = [model.id];
	if (supportsEffort(model) && applied !== "off") bits.push(applied);
	else if (supportsEffort(model)) bits.push("thinking off");
	if (nextFast) bits.push("fast");
	ctx.ui.notify(`Using ${bits.join(" · ")}`, "info");
}

class ModelsPicker extends Container implements Focusable {
	private searchInput = new Input();
	private listContainer = new Container();
	private scopeText?: Text;
	private scopeHintText?: Text;
	private titleText: Text;
	private subtitleText: Text;
	private currentText: Text;
	private helpText: Text;
	private allRows: ModelRow[];
	private scopedRows: ModelRow[];
	private activeRows: ModelRow[];
	private filtered: ModelRow[] = [];
	private selectedIndex = 0;
	private drafts = new Map<string, RowDraft>();
	private scope: "scoped" | "all";
	private closed = false;
	private _focused = false;

	constructor(
		private theme: Theme,
		private currentModel: Model | undefined,
		private currentEffort: ThinkingLevel,
		scopedModels: readonly Model[],
		allModels: readonly Model[],
		private onSelect: (result: PickerResult) => void,
		private onCancel: () => void,
		private requestRender: () => void,
		initialQuery?: string,
	) {
		super();
		this.scopedRows = sortRows(buildRows(scopedModels), currentModel);
		this.allRows = sortRows(buildRows(allModels), currentModel);
		this.scope = this.scopedRows.length > 0 ? "scoped" : "all";
		this.activeRows = this.scope === "scoped" ? this.scopedRows : this.allRows;

		for (const row of [...this.allRows, ...this.scopedRows]) {
			if (!this.drafts.has(row.key)) this.drafts.set(row.key, defaultDraft(row, currentModel, currentEffort));
		}

		this.addChild(new DynamicBorder((str: string) => this.theme.fg("accent", str)));
		this.titleText = new Text("", 1, 0);
		this.subtitleText = new Text("", 1, 0);
		this.currentText = new Text("", 1, 0);
		this.addChild(this.titleText);
		this.addChild(this.subtitleText);
		this.addChild(this.currentText);

		if (this.scopedRows.length > 0) {
			this.scopeText = new Text("", 1, 0);
			this.scopeHintText = new Text("", 1, 0);
			this.addChild(this.scopeText);
			this.addChild(this.scopeHintText);
		}

		this.addChild(new Spacer(1));
		this.searchInput.onSubmit = () => this.confirm();
		this.addChild(this.searchInput);
		this.addChild(new Spacer(1));
		this.addChild(this.listContainer);
		this.addChild(new Spacer(1));
		this.helpText = new Text("", 1, 0);
		this.addChild(this.helpText);
		this.addChild(new DynamicBorder((str: string) => this.theme.fg("accent", str)));

		if (initialQuery) this.searchInput.setValue(initialQuery);
		this.rebuildStatic();
		this.filterModels(this.searchInput.getValue());
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.searchInput.focused = value;
	}

	override invalidate(): void {
		super.invalidate();
		this.rebuildStatic();
		this.updateList();
	}

	handleInput(keyData: string): void {
		if (this.closed) return;
		const kb = getKeybindings();

		if (kb.matches(keyData, "tui.input.tab")) {
			const row = this.filtered[this.selectedIndex];
			if (row?.fastModel) this.toggleFast(row);
			else if (this.scopedRows.length > 0) this.toggleScope();
			this.requestRender();
			return;
		}

		if (matchesKey(keyData, Key.left) || matchesKey(keyData, Key.right)) {
			const row = this.filtered[this.selectedIndex];
			if (row) this.cycleEffort(row, matchesKey(keyData, Key.right) ? 1 : -1);
			this.requestRender();
			return;
		}

		if (kb.matches(keyData, "tui.select.up")) {
			if (this.filtered.length === 0) return;
			this.selectedIndex = this.selectedIndex === 0 ? this.filtered.length - 1 : this.selectedIndex - 1;
			this.updateList();
			this.requestRender();
			return;
		}

		if (kb.matches(keyData, "tui.select.down")) {
			if (this.filtered.length === 0) return;
			this.selectedIndex = this.selectedIndex === this.filtered.length - 1 ? 0 : this.selectedIndex + 1;
			this.updateList();
			this.requestRender();
			return;
		}

		if (kb.matches(keyData, "tui.select.pageUp")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 10);
			this.updateList();
			this.requestRender();
			return;
		}

		if (kb.matches(keyData, "tui.select.pageDown")) {
			this.selectedIndex = Math.min(this.filtered.length - 1, this.selectedIndex + 10);
			this.updateList();
			this.requestRender();
			return;
		}

		if (kb.matches(keyData, "tui.select.confirm")) {
			this.confirm();
			return;
		}

		if (kb.matches(keyData, "tui.select.cancel")) {
			this.closed = true;
			this.onCancel();
			return;
		}

		this.searchInput.handleInput(keyData);
		this.filterModels(this.searchInput.getValue());
		this.requestRender();
	}

	private draft(row: ModelRow): RowDraft {
		return this.drafts.get(row.key) ?? defaultDraft(row, this.currentModel, this.currentEffort);
	}

	private toggleScope(): void {
		this.scope = this.scope === "all" ? "scoped" : "all";
		this.activeRows = this.scope === "scoped" ? this.scopedRows : this.allRows;
		const currentIndex = this.activeRows.findIndex((row) => isCurrentRow(row, this.currentModel));
		this.selectedIndex = currentIndex >= 0 ? currentIndex : 0;
		this.rebuildStatic();
		this.filterModels(this.searchInput.getValue());
	}

	private toggleFast(row: ModelRow): void {
		if (!row.fastModel) return;
		const draft = this.draft(row);
		draft.fast = !draft.fast;
		draft.effort = clampThinkingLevel(targetModel(row, draft.fast), draft.effort) as ThinkingLevel;
		this.drafts.set(row.key, draft);
		this.updateList();
	}

	private cycleEffort(row: ModelRow, direction: 1 | -1): void {
		const draft = this.draft(row);
		const model = targetModel(row, draft.fast);
		const levels = levelsFor(model).filter((level) => (model.reasoning ? true : level === "off"));
		if (!supportsEffort(model) || levels.length === 0) return;
		const currentIndex = Math.max(0, levels.indexOf(draft.effort));
		const next = levels[(currentIndex + direction + levels.length) % levels.length];
		if (!next) return;
		draft.effort = next;
		this.drafts.set(row.key, draft);
		this.updateList();
	}

	private confirm(): void {
		const row = this.filtered[this.selectedIndex];
		if (!row) return;
		const draft = this.draft(row);
		this.closed = true;
		this.onSelect({
			model: targetModel(row, draft.fast),
			thinkingLevel: draft.effort,
		});
	}

	private filterModels(query: string): void {
		this.filtered = query ? fuzzyFilter(this.activeRows, query, (row) => row.searchText) : this.activeRows;
		this.selectedIndex = query ? 0 : Math.min(this.selectedIndex, Math.max(0, this.filtered.length - 1));
		if (!query) {
			const currentIndex = this.filtered.findIndex((row) => isCurrentRow(row, this.currentModel));
			if (currentIndex >= 0) this.selectedIndex = currentIndex;
		}
		this.updateList();
	}

	private rebuildStatic(): void {
		this.titleText.setText(this.theme.fg("accent", this.theme.bold("Select model")));
		this.subtitleText.setText(
			this.theme.fg(
				"muted",
				"Switch models. Your pick applies to this session. For other IDs, pass /models provider/id.",
			),
		);

		const current = this.currentModel
			? `Currently using ${this.currentModel.id}${this.currentModel.reasoning ? ` · ${this.currentEffort} effort` : ""}${this.currentModel && isFastModelId(this.currentModel.id) ? " · Fast mode ON" : ""}.`
			: "No model selected.";
		this.currentText.setText(this.theme.fg("muted", current));

		if (this.scopeText && this.scopeHintText) {
			const allText = this.scope === "all" ? this.theme.fg("accent", "all") : this.theme.fg("muted", "all");
			const scopedText = this.scope === "scoped" ? this.theme.fg("accent", "scoped") : this.theme.fg("muted", "scoped");
			this.scopeText.setText(`${this.theme.fg("muted", "Scope: ")}${allText}${this.theme.fg("muted", " | ")}${scopedText}`);
			this.scopeHintText.setText(this.theme.fg("dim", "tab cycles scope when the highlighted model has no fast sibling"));
		}

		this.helpText.setText(
			this.theme.fg("dim", "type to filter · ↑↓ select · ←→ effort · tab fast/scope · enter confirm · esc cancel"),
		);
	}

	private updateList(): void {
		this.listContainer.clear();
		const maxVisible = 10;
		const startIndex = Math.max(
			0,
			Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.filtered.length - maxVisible),
		);
		const endIndex = Math.min(startIndex + maxVisible, this.filtered.length);

		for (let i = startIndex; i < endIndex; i++) {
			const row = this.filtered[i];
			if (!row) continue;
			const selected = i === this.selectedIndex;
			const current = isCurrentRow(row, this.currentModel);
			const draft = this.draft(row);
			const prefix = selected ? this.theme.fg("accent", "→ ") : "  ";
			const id = selected ? this.theme.fg("accent", row.model.id) : row.model.id;
			const provider = this.theme.fg("muted", `[${row.model.provider}]`);
			const check = current ? this.theme.fg("success", " ✓") : "";
			const fastBadge = draft.fast ? this.theme.fg("accent", " fast") : "";
			this.listContainer.addChild(new Text(`${prefix}${id} ${provider}${check}${fastBadge}`, 1, 0));
		}

		if (startIndex > 0 || endIndex < this.filtered.length) {
			this.listContainer.addChild(
				new Text(this.theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filtered.length})`), 1, 0),
			);
		}

		if (this.filtered.length === 0) {
			const query = this.searchInput.getValue();
			this.listContainer.addChild(
				new Text(this.theme.fg("warning", query ? `No models match "${query}"` : "  No matching models"), 1, 0),
			);
			return;
		}

		const row = this.filtered[this.selectedIndex];
		if (!row) return;
		const draft = this.draft(row);
		const model = targetModel(row, draft.fast);

		this.listContainer.addChild(new Spacer(1));
		this.listContainer.addChild(new Text(this.theme.fg("muted", `  Model Name: ${model.name || model.id}`), 1, 0));

		if (supportsEffort(model)) {
			const icon = this.theme.fg(THINKING_COLORS[draft.effort], "●");
			const label = draft.effort === "xhigh" ? "xHigh" : draft.effort;
			const isDefault = draft.effort === this.currentEffort && isCurrentRow(row, this.currentModel);
			this.listContainer.addChild(
				new Text(
					this.theme.fg(
						"muted",
						`${icon} ${label} effort${isDefault ? " (current)" : ""}  ${this.theme.fg("dim", "← → adjust")}`,
					),
					1,
					0,
				),
			);
		} else {
			this.listContainer.addChild(
				new Text(this.theme.fg("dim", `○ Effort not supported for ${model.id}`), 1, 0),
			);
		}

		if (row.fastModel) {
			if (draft.fast) {
				this.listContainer.addChild(
					new Text(
						this.theme.fg(
							"muted",
							`Fast mode is ${this.theme.bold("ON")} and available with ${row.fastModel.id}. Tab toggles. Switching to other models turns off fast mode.`,
						),
						1,
						0,
					),
				);
			} else {
				this.listContainer.addChild(
					new Text(
						this.theme.fg("muted", `Use Tab to turn on Fast mode (${row.fastModel.id}).`),
						1,
						0,
					),
				);
			}
		}
	}
}

async function showModelsPicker(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	initialQuery?: string,
): Promise<void> {
	const allModels = ctx.modelRegistry.getAvailable();
	const scopedModels = ctx.scopedModels.map((item) => item.model);

	if (allModels.length === 0 && scopedModels.length === 0) {
		ctx.ui.notify("No models available. Use /login to add providers.", "warning");
		return;
	}

	const result = await ctx.ui.custom<PickerResult | null>((tui, theme, _kb, done) => {
		return new ModelsPicker(
			theme,
			ctx.model,
			pi.getThinkingLevel() as ThinkingLevel,
			scopedModels,
			allModels,
			(selection) => done(selection),
			() => done(null),
			() => tui.requestRender(),
			initialQuery,
		);
	});

	if (!result) return;
	await applySelection(pi, ctx, result.model, result.thinkingLevel);
}

async function showEffortSelector(
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
		container.addChild(new DynamicBorder((str: string) => theme.fg("accent", str)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Effort level")), 1, 0));
		container.addChild(
			new Text(theme.fg("muted", "Reasoning depth for the current model."), 1, 0),
		);

		const selectList = new SelectList(items, Math.min(items.length, 10), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		const currentIndex = items.findIndex((item) => item.value === current);
		if (currentIndex >= 0) selectList.setSelectedIndex(currentIndex);

		selectList.onSelect = (item) => done(item.value);
		selectList.onCancel = () => done(null);
		container.addChild(selectList);
		container.addChild(new Text(theme.fg("dim", "↑↓ navigate · enter select · esc cancel"), 1, 0));
		container.addChild(new DynamicBorder((str: string) => theme.fg("accent", str)));

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	});

	if (!result || !isThinkingLevel(result) || !ctx.model) return;
	await applySelection(pi, ctx, ctx.model, result);
}

async function handleModelsCommand(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	args: string | undefined,
): Promise<void> {
	const raw = args?.trim();
	if (!raw) {
		await showModelsPicker(pi, ctx);
		return;
	}

	const parsed = parseModelArg(raw);
	if (!parsed.query) {
		await showModelsPicker(pi, ctx);
		return;
	}

	if (isThinkingLevel(parsed.query) && !parsed.effort) {
		if (!ctx.model) {
			ctx.ui.notify("No model selected", "error");
			return;
		}
		await applySelection(pi, ctx, ctx.model, parsed.query);
		return;
	}

	const models = [...catalogModels(ctx, "all"), ...catalogModels(ctx, "scoped")];
	const unique = new Map(models.map((model) => [modelKey(model), model]));
	const model = findModel([...unique.values()], parsed.query);
	if (!model) {
		ctx.ui.notify(`No model matches "${parsed.query}"`, "error");
		return;
	}

	const effort = parsed.effort ?? (pi.getThinkingLevel() as ThinkingLevel);
	await applySelection(pi, ctx, model, effort);
}

async function handleEffortCommand(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	args: string | undefined,
): Promise<void> {
	if (!ctx.model) {
		ctx.ui.notify("No model selected", "error");
		return;
	}
	if (!ctx.model.reasoning) {
		ctx.ui.notify("Effort is not supported by the current model", "warning");
		return;
	}

	const levels = levelsFor(ctx.model);
	const raw = args?.trim().toLowerCase();
	if (!raw) {
		await showEffortSelector(pi, ctx, levels);
		return;
	}
	if (!isThinkingLevel(raw)) {
		ctx.ui.notify(`Unknown effort "${raw}". Available: ${levels.join(", ")}`, "error");
		return;
	}
	if (!levels.includes(raw)) {
		ctx.ui.notify(`Effort "${raw}" not supported. Available: ${levels.join(", ")}`, "error");
		return;
	}
	await applySelection(pi, ctx, ctx.model, raw);
}

async function handleFastCommand(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	args: string | undefined,
): Promise<void> {
	if (!ctx.model) {
		ctx.ui.notify("No model selected", "error");
		return;
	}

	const rows = buildRows(catalogModels(ctx, "all"));
	const row = rows.find((item) => isCurrentRow(item, ctx.model));
	if (!row?.fastModel) {
		ctx.ui.notify(`Fast mode is not available for ${ctx.model.id}`, "warning");
		return;
	}

	const currentlyFast = modelsAreEqual(ctx.model, row.fastModel);
	const raw = args?.trim().toLowerCase();
	let nextFast = !currentlyFast;
	if (raw === "on" || raw === "true" || raw === "1") nextFast = true;
	else if (raw === "off" || raw === "false" || raw === "0") nextFast = false;
	else if (raw && raw !== "toggle") {
		ctx.ui.notify('Usage: /fast [on|off]', "error");
		return;
	}

	const model = nextFast ? row.fastModel : row.model;
	await applySelection(pi, ctx, model, pi.getThinkingLevel() as ThinkingLevel);
}

function modelCompletions(ctx: ExtensionCommandContext | undefined, prefix: string) {
	if (!ctx) {
		return ALL_LEVELS.filter((level) => level.startsWith(prefix.toLowerCase())).map((level) => ({
			value: level,
			label: level,
			description: LEVEL_DESCRIPTIONS[level],
		}));
	}

	const models = catalogModels(ctx, ctx.scopedModels.length > 0 ? "scoped" : "all");
	const needle = prefix.trim().toLowerCase();
	return models
		.filter((model) => `${model.provider}/${model.id}`.toLowerCase().includes(needle) || model.id.toLowerCase().includes(needle))
		.slice(0, 25)
		.map((model) => ({
			value: `${model.provider}/${model.id}`,
			label: model.id,
			description: model.provider,
		}));
}

export default function variantsExtension(pi: ExtensionAPI) {
	pi.registerCommand("models", {
		description: "Select model, effort, and fast mode (Claude-style)",
		getArgumentCompletions: (prefix) => modelCompletions(undefined, prefix),
		handler: async (args, ctx) => handleModelsCommand(pi, ctx, args),
	});

	pi.registerCommand("variants", {
		description: "Alias for /models",
		getArgumentCompletions: (prefix) => modelCompletions(undefined, prefix),
		handler: async (args, ctx) => handleModelsCommand(pi, ctx, args),
	});

	pi.registerCommand("variant", {
		description: "Alias for /models",
		getArgumentCompletions: (prefix) => modelCompletions(undefined, prefix),
		handler: async (args, ctx) => handleModelsCommand(pi, ctx, args),
	});

	pi.registerCommand("effort", {
		description: "Set effort level for the current model",
		getArgumentCompletions: (prefix) => {
			const needle = prefix.trim().toLowerCase();
			return ALL_LEVELS.filter((level) => level.startsWith(needle)).map((level) => ({
				value: level,
				label: level,
				description: LEVEL_DESCRIPTIONS[level],
			}));
		},
		handler: async (args, ctx) => handleEffortCommand(pi, ctx, args),
	});

	pi.registerCommand("fast", {
		description: "Toggle fast mode when the current model has a fast sibling",
		getArgumentCompletions: (prefix) => {
			const options = ["on", "off", "toggle"];
			const needle = prefix.trim().toLowerCase();
			return options
				.filter((value) => value.startsWith(needle))
				.map((value) => ({ value, label: value }));
		},
		handler: async (args, ctx) => handleFastCommand(pi, ctx, args),
	});

	pi.on("session_start", async (_event, ctx) => {
		updateStatus(ctx, pi);
	});

	pi.on("thinking_level_select", async (_event, ctx) => {
		updateStatus(ctx, pi);
	});

	pi.on("model_select", async (_event, ctx) => {
		updateStatus(ctx, pi);
	});
}
