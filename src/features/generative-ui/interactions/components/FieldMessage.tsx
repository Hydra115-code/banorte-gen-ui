interface FieldMessageProps {
  id: string;
  helpText?: string;
  error?: string | null;
}

export function FieldMessage({ id, helpText, error }: FieldMessageProps) {
  const message = error ?? helpText;
  if (!message) return null;

  return (
    <p
      aria-live={error ? "polite" : undefined}
      className={error ? "ui-field__message ui-field__message--error" : "ui-field__message"}
      id={id}
    >
      {message}
    </p>
  );
}
