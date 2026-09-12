interface UnknownNodeProps {
  nodeType?: string;
}

export function UnknownNode({ nodeType }: UnknownNodeProps) {
  return (
    <div className="ui-renderer-message ui-renderer-message--unknown" role="status">
      <p className="ui-renderer-message__title">Elemento no compatible</p>
      {nodeType ? <p className="ui-renderer-message__details">Tipo: {nodeType}</p> : null}
    </div>
  );
}
