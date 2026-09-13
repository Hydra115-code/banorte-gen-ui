import type { EChartsOption } from "echarts";
import type { DataValue } from "../data-binding/schemas/data-registry-schema";
import type { VisualizationNode } from "../schemas/visualization-node";
import { readDataField } from "../data-binding/resolver/read-data-field";
import { maskFinancialIdentifier } from "../data-binding/formatting/mask-financial-identifier";
import { formatDataValue } from "../data-binding/formatting/format-data-value";

export interface VisualizationDataRow {
  [key: string]: DataValue;
}

export interface VisualizationTheme {
  palette: string[];
  text: string;
  mutedText: string;
  border: string;
  surface: string;
}

interface CompileVisualizationOptions {
  reducedMotion?: boolean;
}

function asCategory(value: DataValue | undefined, field: string) {
  if (value !== undefined) {
    const masked = maskFinancialIdentifier(field, value);
    if (masked) return masked;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "—";
}

function aggregate(values: Array<DataValue | undefined>, operation = "none") {
  if (operation === "count") return values.filter((value) => value !== undefined && value !== null).length;
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numbers.length === 0) return null;
  if (operation === "sum") return numbers.reduce((total, value) => total + value, 0);
  if (operation === "average") return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  if (operation === "min") return Math.min(...numbers);
  if (operation === "max") return Math.max(...numbers);
  return numbers[0];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function formatTemporalCategories(values: string[], declaredTemporal: boolean) {
  const containsOnlyDates = values.every((value) => /^\d{4}-\d{2}(?:-\d{2})?$/u.test(value));
  if (!declaredTemporal && !containsOnlyDates) return values;

  const usesMonthlyPeriods = values.every((value) => /^\d{4}-\d{2}(?:-01)?$/u.test(value));
  const formatter = new Intl.DateTimeFormat("es-MX", usesMonthlyPeriods
    ? { month: "short", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return values.map((value) => {
    const normalized = /^\d{4}-\d{2}$/u.test(value) ? `${value}-01` : value;
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return value;
    const date = new Date(`${normalized}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : formatter.format(date).replace(/\./gu, "");
  });
}

function positionLegend(position: "top" | "right" | "bottom" | undefined) {
  if (position === "right") return { right: 0, top: "middle", orient: "vertical" as const };
  if (position === "bottom") return { bottom: 0, left: "center" };
  return { top: 0, left: "center" };
}

function cartesianOption(spec: VisualizationNode, rows: VisualizationDataRow[]) {
  const x = spec.encoding.x;
  const y = spec.encoding.y;
  if (!x || !y) return {};

  let categories = unique(rows.map((row) => asCategory(readDataField(row, x.field), x.field)));
  const groupField = spec.encoding.group?.field;
  let groups = groupField
    ? unique(rows.map((row) => asCategory(readDataField(row, groupField), groupField)))
    : [y.label ?? y.field];

  const valuesByCategory = new Map<string, Map<string, Array<DataValue | undefined>>>();
  rows.forEach((row) => {
    const category = asCategory(readDataField(row, x.field), x.field);
    const group = groupField ? asCategory(readDataField(row, groupField), groupField) : groups[0]!;
    const groupedValues = valuesByCategory.get(category) ?? new Map<string, Array<DataValue | undefined>>();
    const values = groupedValues.get(group) ?? [];
    values.push(readDataField(row, y.field));
    groupedValues.set(group, values);
    valuesByCategory.set(category, groupedValues);
  });
  const aggregatedValues = new Map(categories.map((category) => [
    category,
    new Map(groups.map((group) => [group, aggregate(valuesByCategory.get(category)?.get(group) ?? [], y.aggregate)])),
  ]));
  const valueFor = (category: string, group: string) => aggregatedValues.get(category)?.get(group) ?? null;

  if (spec.sort?.by === "x") {
    categories = categories.toSorted((a, b) => a.localeCompare(b));
  } else if (spec.sort?.by === "y") {
    categories = categories.toSorted((a, b) => {
      const aTotal = groups.reduce((total, group) => total + (valueFor(a, group) ?? 0), 0);
      const bTotal = groups.reduce((total, group) => total + (valueFor(b, group) ?? 0), 0);
      return aTotal - bTotal;
    });
  }

  if (spec.sort?.by === "group") groups = groups.toSorted((a, b) => a.localeCompare(b));
  if (spec.sort?.direction === "descending") {
    if (spec.sort.by === "group") groups.reverse();
    else categories.reverse();
  }

  const seriesType = spec.mark === "scatter" ? "scatter" : spec.mark.includes("bar") || spec.mark === "bar" ? "bar" : "line";
  const series = groups.map((group) => ({
    name: group,
    type: seriesType,
    data: categories.map((category) => valueFor(category, group)),
    areaStyle: spec.mark === "area" ? {} : undefined,
    stack: spec.mark === "stacked-bar" ? "total" : undefined,
    symbol: spec.mark === "line" || spec.mark === "area" ? "circle" : undefined,
    symbolSize: spec.mark === "scatter" ? 8 : undefined,
  }));

  if (spec.mark === "scatter") {
    return {
      xAxis: { type: "value", name: x.label ?? x.field },
      yAxis: { type: "value", name: y.label ?? y.field },
      series: groups.map((group) => ({
        name: group,
        type: "scatter",
        data: rows
          .filter((row) => !groupField || asCategory(readDataField(row, groupField), groupField) === group)
          .map((row) => [readDataField(row, x.field), readDataField(row, y.field)])
          .filter(([xValue, yValue]) => typeof xValue === "number" && typeof yValue === "number"),
      })),
    };
  }

  return {
    xAxis: {
      type: "category",
      name: x.label,
      data: formatTemporalCategories(categories, x.type === "temporal"),
      boundaryGap: seriesType === "bar",
    },
    yAxis: { type: "value", name: y.label },
    series,
  };
}

function donutOption(spec: VisualizationNode, rows: VisualizationDataRow[]) {
  const group = spec.encoding.group;
  const value = spec.encoding.value;
  if (!group || !value) return {};

  const valuesByGroup = new Map<string, Array<DataValue | undefined>>();
  rows.forEach((row) => {
    const name = asCategory(readDataField(row, group.field), group.field);
    const values = valuesByGroup.get(name) ?? [];
    values.push(readDataField(row, value.field));
    valuesByGroup.set(name, values);
  });
  let data = [...valuesByGroup].map(([name, values]) => ({
    name,
    value: aggregate(values, value.aggregate ?? "sum") ?? 0,
  }));

  if (spec.sort) {
    data = data.toSorted((a, b) => spec.sort?.by === "group" ? a.name.localeCompare(b.name) : a.value - b.value);
    if (spec.sort.direction === "descending") data.reverse();
  }

  return {
    series: [{
      name: group.label ?? group.field,
      type: "pie",
      radius: ["48%", "72%"],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: { label: { show: true, formatter: "{b}: {d}%" } },
      data,
    }],
  };
}

function heatmapOption(spec: VisualizationNode, rows: VisualizationDataRow[]) {
  const { x, y, value } = spec.encoding;
  if (!x || !y || !value) return {};

  const xValues = unique(rows.map((row) => asCategory(readDataField(row, x.field), x.field)));
  const yValues = unique(rows.map((row) => asCategory(readDataField(row, y.field), y.field)));
  const xIndex = new Map(xValues.map((item, index) => [item, index]));
  const yIndex = new Map(yValues.map((item, index) => [item, index]));
  const data = rows.map((row) => [
    xIndex.get(asCategory(readDataField(row, x.field), x.field)) ?? -1,
    yIndex.get(asCategory(readDataField(row, y.field), y.field)) ?? -1,
    typeof readDataField(row, value.field) === "number" ? readDataField(row, value.field) : 0,
  ]);
  const numericValues = data.map((item) => item[2]).filter((item): item is number => typeof item === "number");

  return {
    xAxis: { type: "category", name: x.label, data: formatTemporalCategories(xValues, x.type === "temporal") },
    yAxis: { type: "category", name: y.label, data: formatTemporalCategories(yValues, y.type === "temporal") },
    visualMap: {
      min: numericValues.length ? Math.min(...numericValues) : 0,
      max: numericValues.length ? Math.max(...numericValues) : 0,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
    },
    series: [{ type: "heatmap", data }],
  };
}

function applyThemeToMarkOption(markOption: object, theme: VisualizationTheme) {
  const option = markOption as Record<string, unknown>;
  const axisTheme = {
    axisLabel: { color: theme.mutedText },
    axisLine: { lineStyle: { color: theme.border } },
    splitLine: { lineStyle: { color: theme.border } },
    nameTextStyle: { color: theme.mutedText },
  };
  const themed: Record<string, unknown> = { ...option };

  if (option.xAxis && typeof option.xAxis === "object") {
    themed.xAxis = { ...(option.xAxis as object), ...axisTheme };
  }
  if (option.yAxis && typeof option.yAxis === "object") {
    themed.yAxis = { ...(option.yAxis as object), ...axisTheme };
  }
  if (option.visualMap && typeof option.visualMap === "object") {
    themed.visualMap = {
      ...(option.visualMap as object),
      textStyle: { color: theme.mutedText },
      inRange: { color: theme.palette.toReversed() },
    };
  }

  return themed;
}

export function compileVisualizationOption(
  spec: VisualizationNode,
  rows: VisualizationDataRow[],
  theme: VisualizationTheme,
  options: CompileVisualizationOptions = {},
): EChartsOption {
  const markOption = spec.mark === "donut"
    ? donutOption(spec, rows)
    : spec.mark === "heatmap"
      ? heatmapOption(spec, rows)
      : cartesianOption(spec, rows);
  const themedMarkOption = applyThemeToMarkOption(markOption, theme);
  const quantitativeField = spec.encoding.value?.field ?? spec.encoding.y?.field;
  const isMonetary = quantitativeField !== undefined
    && /(?:^|_)(?:amount|balance|spending|expense|income|gasto|importe|monto)(?:$|_)/iu.test(quantitativeField);
  const firstCurrency = rows.find((row) => typeof row.currency === "string" && /^[A-Z]{3}$/u.test(row.currency))?.currency;
  const currency = typeof firstCurrency === "string" ? firstCurrency : "MXN";

  return {
    animation: !options.reducedMotion,
    aria: { enabled: true, description: spec.description ?? spec.ariaLabel },
    color: theme.palette,
    backgroundColor: "transparent",
    textStyle: { color: theme.text, fontFamily: "inherit" },
    grid: spec.mark === "donut" ? undefined : {
      top: 40,
      right: 24,
      bottom: 48,
      left: 56,
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel",
    },
    legend: {
      show: spec.legend?.show ?? Boolean(spec.encoding.group),
      textStyle: { color: theme.mutedText },
      ...positionLegend(spec.legend?.position),
    },
    tooltip: {
      trigger: spec.mark === "donut" ? "item" : "axis",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text },
      valueFormatter: isMonetary
        ? (value) => typeof value === "number"
          ? formatDataValue(value, "currency", { locale: "es-MX", currency }) ?? "—"
          : String(value ?? "—")
        : undefined,
    },
    ...themedMarkOption,
  } as EChartsOption;
}
