import type { TextNode } from "../../schemas/content-node";

type TextProps = Omit<TextNode, "type">;

export function Text({ content, variant = "body", tone = "primary", align = "start" }: TextProps) {
  return <p className={`ui-text ui-text--${variant} ui-text--tone-${tone} ui-text--align-${align}`}>{content}</p>;
}
