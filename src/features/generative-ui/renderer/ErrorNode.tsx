import type { UIValidationError } from "../schemas/ui-specification";

interface ErrorNodeProps {
  title?: string;
  message?: string;
  errors?: UIValidationError[];
  isRecovering?: boolean;
  onRegenerate?: () => void;
  onRetry?: () => void;
}

export function ErrorNode({
  title = "No se pudo mostrar este contenido",
  message,
  errors = [],
  isRecovering = false,
  onRegenerate,
  onRetry,
}: ErrorNodeProps) {
  return (
    <div className="ui-renderer-message ui-renderer-message--error" role="alert">
      <p className="ui-renderer-message__title">{title}</p>
      {message ? <p className="ui-renderer-message__body">{message}</p> : null}
      {errors.length > 0 ? (
        <ul className="ui-renderer-message__details">
          {errors.slice(0, 3).map((error, index) => (
            <li key={`${error.code}-${error.path.join(".")}-${index}`}>{error.message}</li>
          ))}
        </ul>
      ) : null}
      {onRetry || onRegenerate ? (
        <div className="ui-renderer-message__actions">
          {onRetry ? <button type="button" onClick={onRetry}>Reintentar</button> : null}
          {onRegenerate ? (
            <button type="button" disabled={isRecovering} onClick={onRegenerate}>
              {isRecovering ? "Reconstruyendo…" : "Regenerar sección"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
