import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSensitiveFinancialField,
  maskFinancialIdentifier,
} from "../src/features/generative-ui/data-binding/formatting/mask-financial-identifier.ts";
import {
  knownNodeTypes,
  nodeCapabilityMatrix,
} from "../src/features/generative-ui/runtime/node-capability-matrix.ts";

test("la matriz tiene una entrada única para los 33 nodos contractuales", () => {
  assert.equal(nodeCapabilityMatrix.length, 33);
  assert.equal(knownNodeTypes.size, nodeCapabilityMatrix.length);
  assert.equal(nodeCapabilityMatrix.every((item) => item.component.length > 0), true);
});

test("la matriz y el switch real del renderer permanecen sincronizados", () => {
  const source = readFileSync(new URL(
    "../src/features/generative-ui/runtime/LayoutRenderer.tsx",
    import.meta.url,
  ), "utf8");
  const renderedTypes = new Set([...source.matchAll(/case "([^"]+)":/gu)].map((match) => match[1]));
  assert.deepEqual([...renderedTypes].sort(), [...knownNodeTypes].sort());
});

test("enmascara cuentas, tarjetas, PAN, CLABE e IBAN conservando sólo cuatro caracteres", () => {
  const protectedPaths = [
    "accountNumber",
    "accounts.0.numero_cuenta",
    "transaction.card_number",
    "payment.numeroTarjeta",
    "recipient.clabe",
    "recipient.iban",
    "card.pan",
  ];
  for (const path of protectedPaths) {
    assert.equal(isSensitiveFinancialField(path), true, path);
    assert.equal(maskFinancialIdentifier(path, "0123-4567-8901-2345"), "•••• 2345", path);
  }
  assert.equal(maskFinancialIdentifier("accountType", "Débito"), undefined);
  assert.equal(maskFinancialIdentifier("amount", 12345), undefined);
  assert.equal(maskFinancialIdentifier("cardNumber", "1234"), "••••");
});

test("bindings, tablas y visualizaciones consumen la misma política de masking", () => {
  const consumers = [
    "../src/features/generative-ui/data-binding/resolver/BindingResolver.ts",
    "../src/features/generative-ui/table/table-model.ts",
    "../src/features/generative-ui/visualization/VisualizationCompiler.ts",
    "../src/features/generative-ui/visualization/VisualizationDataTable.tsx",
  ];
  for (const relativePath of consumers) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /maskFinancialIdentifier/u, relativePath);
  }
});
