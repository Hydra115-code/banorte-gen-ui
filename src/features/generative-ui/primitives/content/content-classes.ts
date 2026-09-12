export function semanticStateClass(state: string) {
  return `ui-semantic--${state.replace(".", "-")}`;
}
