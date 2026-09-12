import type { UIPatch, UISpecification } from "@banorte/contracts";

export function buildPerformanceSpecification(groupCount = 20): UISpecification {
  return {
    version: "1",
    root: {
      type: "container",
      id: "performance-root",
      size: "lg",
      padding: "md",
      children: Array.from({ length: groupCount }, (_, groupIndex) => ({
        type: "section" as const,
        id: `performance-group-${groupIndex}`,
        ariaLabel: `Grupo ${groupIndex + 1}`,
        surface: "transparent" as const,
        children: Array.from({ length: 20 }, (_, itemIndex) => ({
          type: "text" as const,
          id: `performance-cell-${groupIndex}-${itemIndex}`,
          content: `Dato ${groupIndex + 1}.${itemIndex + 1}`,
        })),
      })),
    },
  };
}

export function buildPerformancePatches(count = 60, groupCount = 20): UIPatch[] {
  return Array.from({ length: count }, (_, index) => ({
    version: "1" as const,
    baseRevision: index,
    revision: index + 1,
    op: "update" as const,
    target: `performance-cell-${index % groupCount}-${(index * 7) % 20}`,
    changes: { content: `Dato actualizado ${index + 1}` },
  }));
}
