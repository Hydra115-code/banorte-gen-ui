import { createElement } from "react";
import type { HeadingNode } from "../../schemas/content-node";
import { cleanGeneratedCopy } from "./clean-generated-copy";

type HeadingProps = Omit<HeadingNode, "type">;

export function Heading({ content, level = 2, size = "title", align = "start" }: HeadingProps) {
  return createElement(
    `h${level}`,
    { className: `ui-heading ui-heading--${size} ui-heading--align-${align}` },
    cleanGeneratedCopy(content),
  );
}
