import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dataRegistrySchema, uiSpecificationSchema, type UINode } from "@banorte/contracts";
import { maskFinancialIdentifier } from "../src/features/generative-ui/data-binding/formatting/mask-financial-identifier.ts";
import { formatDataValue, localizeDisplayValue } from "../src/features/generative-ui/data-binding/formatting/format-data-value.ts";
import {
  availableBalanceScenario,
  monthlySpendingScenario,
  periodComparisonScenario,
  personalBankingScenarios,
  recentTransactionsScenario,
} from "../src/features/generative-ui/fixtures/f5-personal-banking-fixtures.ts";

function collectNodes(value: unknown, nodes: UINode[] = []): UINode[] {
  if (!value || typeof value !== "object") return nodes;
  if ("type" in value && typeof value.type === "string") nodes.push(value as UINode);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => collectNodes(item, nodes));
    else if (child && typeof child === "object") collectNodes(child, nodes);
  }
  return nodes;
}

function dataAt(data: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((value, segment) => (
    value && typeof value === "object" ? (value as Record<string, unknown>)[segment] : undefined
  ), data);
}

test("las cuatro consultas obligatorias tienen una composición contractual válida", () => {
  assert.deepEqual(personalBankingScenarios.map((scenario) => scenario.prompt), [
    "¿Cuánto tengo disponible?",
    "Muéstrame mis últimos movimientos.",
    "¿En qué gasté más este mes?",
    "Compáralo con el mes anterior y quita la tabla.",
  ]);
  for (const scenario of personalBankingScenarios) {
    assert.equal(uiSpecificationSchema.safeParse(scenario.specification).success, true, scenario.id);
    assert.equal(dataRegistrySchema.safeParse(scenario.data).success, true, scenario.id);
  }
});

test("cada respuesta declara periodo y evidencia con IDs consistentes", () => {
  for (const scenario of personalBankingScenarios) {
    const nodes = collectNodes(scenario.specification.root);
    const period = nodes.find((node) => node.id?.endsWith("-period"));
    const evidence = nodes.find((node) => node.id?.endsWith("-evidence"));
    assert.equal(period?.type, "text", `${scenario.id}: periodo`);
    assert.equal(evidence?.type, "text", `${scenario.id}: evidencia`);
    if (period?.type === "text") assert.match(period.content, /^Periodo consultado:/u);
    if (evidence?.type === "text") assert.match(evidence.content, /^Evidencia:/u);
  }
});

test("la pregunta simple genera una UI pequeña, no un dashboard", () => {
  const nodes = collectNodes(availableBalanceScenario.specification.root);
  assert.equal(nodes.some((node) => node.type === "table" || node.type === "visualization"), false);
  assert.ok(nodes.length <= 8);
});

test("movimientos pagina localmente más de una página sin evento remoto", () => {
  const nodes = collectNodes(recentTransactionsScenario.specification.root);
  const table = nodes.find((node) => node.type === "table");
  assert.equal(table?.type, "table");
  if (table?.type !== "table") return;
  assert.equal(table.pagination?.pageSize, 10);
  assert.equal(table.selection, undefined);
  assert.ok(Array.isArray(recentTransactionsScenario.data.movements));
  assert.ok((recentTransactionsScenario.data.movements as unknown[]).length > 10);
});

test("la exploración incluye controles, visualización y observación no acusatoria", () => {
  const nodes = collectNodes(monthlySpendingScenario.specification.root);
  assert.ok(nodes.filter((node) => ["select", "multiSelect"].includes(node.type)).length >= 3);
  assert.ok(nodes.some((node) => node.type === "visualization"));
  const observation = nodes.find((node) => node.id === "spending-observation");
  assert.equal(observation?.type, "alert");
  if (observation?.type === "alert") {
    assert.match(observation.title ?? "", /Observación estadística/u);
    assert.doesNotMatch(observation.message, /fraude|fraudulento/iu);
  }
});

test("la comparación elimina tablas y compara periodos homogéneos", () => {
  const nodes = collectNodes(periodComparisonScenario.specification.root);
  assert.equal(nodes.some((node) => node.type === "table"), false);
  const chart = nodes.find((node) => node.id === "comparison-chart");
  assert.equal(chart?.type, "visualization");
  if (chart?.type === "visualization") assert.equal(chart.mark, "grouped-bar");
});

test("ninguna serie mezcla cuenta o moneda y los identificadores quedan enmascarados", () => {
  for (const scenario of personalBankingScenarios) {
    for (const scope of scenario.seriesScopes) {
      const rows = dataAt(scenario.data, scope.binding);
      assert.ok(Array.isArray(rows), `${scenario.id}:${scope.binding}`);
      for (const row of rows as Record<string, unknown>[]) {
        assert.equal(row.accountId, scope.accountId);
        assert.equal(row.currency, scope.currency);
      }
    }
  }
  assert.equal(maskFinancialIdentifier("accountNumber", availableBalanceScenario.data.accountNumber), "•••• 4567");
});

test("el compositor de texto permanece disponible junto a cualquier resultado", () => {
  const shell = readFileSync(new URL("../src/features/workspace/components/AppShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /<GenerativeCanvas\b[^>]*\/>[\s\S]*<PromptComposer\s*\/>/u);
});

test("BP0 presenta exclusivamente la propuesta de banca personal", () => {
  const header = readFileSync(new URL("../src/features/workspace/components/WorkspaceHeader.tsx", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("../src/features/workspace/components/GenerativeCanvas.tsx", import.meta.url), "utf8");
  const composer = readFileSync(new URL("../src/features/workspace/components/PromptComposer.tsx", import.meta.url), "utf8");

  assert.match(header, />Banca personal</u);
  assert.match(canvas, /Entiende qué cambia en tu dinero/u);
  assert.match(canvas, /Compara mis gastos de julio y agosto/u);
  assert.match(canvas, /movimientos que más cambiaron mis gastos/u);
  assert.match(composer, /Pregunta sobre tus cuentas/u);
  assert.doesNotMatch(`${header}\n${canvas}`, /educación financiera|prepara un pago|simula un préstamo/iu);
});

test("BP0 oculta diagnósticos y laboratorios fuera del entorno de desarrollo", () => {
  const shell = readFileSync(new URL("../src/features/workspace/components/AppShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /diagnosticsEnabled \? <SystemStatusBar \/>/u);
  assert.match(shell, /showDeveloperDiagnostics = false/u);

  for (const route of [
    "payment-safety-harness",
    "financial-education-harness",
    "ui-interaction-harness",
  ]) {
    const page = readFileSync(new URL(`../src/app/dev/${route}/page.tsx`, import.meta.url), "utf8");
    assert.match(page, /process\.env\.NODE_ENV !== "development"\) notFound\(\)/u, route);
  }
});

test("BP4 reserva una fila real para el compositor sin cubrir el resultado", () => {
  const styles = readFileSync(new URL("../src/features/workspace/styles/workspace.css", import.meta.url), "utf8");
  assert.match(styles, /\.workspace\s*\{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/u);
  assert.match(styles, /grid-template-rows: 4\.5rem minmax\(0, 1fr\)/u);
  assert.match(styles, /\.workspace__main\s*\{[\s\S]*?grid-template-rows: minmax\(0, 1fr\) auto;[\s\S]*?overflow: hidden;/u);
  assert.match(styles, /\.canvas__runtime\s*\{[\s\S]*?min-height: 0;/u);
  assert.match(styles, /\.composer-region\s*\{[\s\S]*?position: relative;/u);
});

test("BP4 presenta valores financieros en español con moneda explícita", () => {
  const options = { locale: "es-MX", currency: "MXN" };
  assert.match(formatDataValue("750.00", "currency", options) ?? "", /MXN/u);
  assert.match(formatDataValue(0.337, "percent", options) ?? "", /33[.,]7\s*%/u);
  assert.equal(localizeDisplayValue("checking"), "Cuenta de cheques");
  assert.equal(localizeDisplayValue("active"), "Activa");
  assert.equal(localizeDisplayValue("restaurantes"), "restaurantes");
});
