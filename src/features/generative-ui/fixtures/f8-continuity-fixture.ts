import type { UIPatch, UISpecification } from "@banorte/contracts";

export const continuitySpecification: UISpecification = {
  version: "1",
  root: {
    type: "container",
    id: "continuity-root",
    size: "lg",
    padding: "md",
    children: [
      { type: "heading", id: "continuity-title", content: "Vista antes del patch", level: 2, size: "title" },
      { type: "input", id: "continuity-input", label: "Nota en edición", event: "analysis.note.changed", initialValue: "Texto original" },
      {
        type: "tabs",
        id: "continuity-tabs",
        ariaLabel: "Secciones persistentes",
        defaultValue: "summary",
        items: [
          { value: "summary", label: "Resumen", children: [{ type: "text", id: "continuity-summary", content: "Resumen inicial" }] },
          { value: "detail", label: "Detalle", children: [{ type: "text", id: "continuity-detail", content: "Detalle que debe permanecer activo" }] },
        ],
      },
      {
        type: "accordion",
        id: "continuity-accordion",
        mode: "multiple",
        items: [
          { value: "evidence", label: "Evidencia", children: [{ type: "text", id: "continuity-evidence", content: "Contenido expandido que no debe cerrarse" }] },
        ],
      },
      {
        type: "scrollable",
        id: "continuity-scroll",
        ariaLabel: "Historial desplazable",
        axis: "vertical",
        maxSize: "sm",
        children: [{
          type: "list",
          id: "continuity-list",
          items: Array.from({ length: 18 }, (_, index) => ({ label: `Movimiento de prueba ${index + 1}` })),
        }],
      },
    ],
  },
};

export const continuityTitlePatch: UIPatch = {
  version: "1",
  baseRevision: 0,
  revision: 1,
  op: "update",
  target: "continuity-title",
  changes: { content: "Vista después del patch" },
};
