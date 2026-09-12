export interface AgentFailureInput {
  code: string;
  message?: string;
  recoverable: boolean;
  hasPartialData?: boolean;
}

export interface AgentFailurePresentation {
  code: string;
  title: string;
  message: string;
  canRetry: boolean;
  canContinue: boolean;
}

export function presentAgentFailure(input: AgentFailureInput): AgentFailurePresentation {
  const code = input.code.toLowerCase();
  const canContinue = input.hasPartialData === true;

  if (code.includes("session_expired") || code.includes("authentication_expired") || code.includes("auth_expired")) {
    return {
      code: input.code,
      title: "Tu sesión expiró",
      message: canContinue
        ? "Conservamos la información visible, pero necesitas iniciar una sesión nueva antes de consultar o confirmar otra operación."
        : "Inicia una sesión nueva antes de volver a consultar o confirmar una operación.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("insufficient_funds") || code.includes("saldo_insuficiente")) {
    return {
      code: input.code,
      title: "Saldo insuficiente",
      message: "El pago no se realizó. Conservamos los datos para que puedas corregir el monto o elegir otra cuenta.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("duplicate_payment") || code.includes("duplicate_action")) {
    return {
      code: input.code,
      title: "La operación ya fue recibida",
      message: "No enviaremos la operación otra vez. Verifica su estado autoritativo antes de intentar una acción nueva.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("revision_conflict")) {
    return {
      code: input.code,
      title: "La interfaz necesita sincronizarse",
      message: "Conservamos la última revisión válida. No repetiremos la operación; la integración debe recuperar el snapshot vigente antes de aceptar más patches.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("semantic-ui")) {
    return {
      code: input.code,
      title: "No encontramos una presentación que respetara tu solicitud",
      message: "Tus datos se consultaron correctamente, pero descartamos la interfaz porque contradecía una indicación explícita. Puedes reintentar o ajustar la forma solicitada.",
      canRetry: input.recoverable,
      canContinue: false,
    };
  }

  if (code.includes("financial-reasoning")) {
    return {
      code: input.code,
      title: "No pudimos respaldar el análisis con suficiente evidencia",
      message: "Descartamos una conclusión financiera que podía resultar engañosa. Puedes reintentar o precisar el periodo, la categoría o el escenario que quieres analizar.",
      canRetry: input.recoverable,
      canContinue: false,
    };
  }

  if (code.includes("mcp")) {
    return {
      code: input.code,
      title: "Los datos no están disponibles por el momento",
      message: canContinue
        ? "No pudimos consultar una de las fuentes necesarias. Puedes reintentar o continuar con la información recibida."
        : "No pudimos consultar una de las fuentes necesarias. Puedes intentarlo nuevamente.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("timeout") || code.includes("timed_out")) {
    return {
      code: input.code,
      title: "El análisis tardó más de lo esperado",
      message: "Detuvimos la espera de forma segura. Puedes intentarlo de nuevo sin modificar tu consulta.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("ui_") || code.includes("binding") || code.includes("visualization")) {
    return {
      code: input.code,
      title: "Una parte de la interfaz necesita reconstruirse",
      message: canContinue
        ? "Conservamos los elementos válidos mientras aislamos la parte que no pudo mostrarse."
        : "No pudimos construir una representación segura. Puedes intentarlo nuevamente.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("network") || code.includes("connection")) {
    return {
      code: input.code,
      title: "Se perdió la conexión con el agente",
      message: "Tu consulta sigue disponible. Revisa la conexión e inténtalo nuevamente.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("partial_data") || code.includes("partial_result")) {
    return {
      code: input.code,
      title: "La información llegó parcialmente",
      message: "Conservamos los datos disponibles. Puedes continuar con ellos o solicitar nuevamente la consulta.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  return {
    code: input.code,
    title: "No pudimos completar toda la consulta",
    message: canContinue
      ? "Puedes reintentar o continuar con la información que ya está disponible."
      : "La consulta se detuvo de forma segura. Puedes intentarlo nuevamente.",
    canRetry: input.recoverable,
    canContinue,
  };
}
