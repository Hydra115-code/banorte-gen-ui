import type { ListNode } from "../../schemas/content-node";

type ListProps = Omit<ListNode, "type">;

export function List({ ordered = false, items }: ListProps) {
  const Component = ordered ? "ol" : "ul";

  return (
    <Component className={`ui-list ui-list--${ordered ? "ordered" : "unordered"}`}>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          <span className="ui-list__label">{item.label}</span>
          {item.supportingText ? <span className="ui-list__supporting">{item.supportingText}</span> : null}
        </li>
      ))}
    </Component>
  );
}
