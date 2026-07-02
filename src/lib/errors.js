export function appError(message, statusCode = 400) {
  return {
    isAppError: true,
    message,
    statusCode,
  }
}

export function isAppError(error) {
  return typeof error === 'object' && error !== null && 'isAppError' in error
}

export function mapBetterAuthError(error) {
  const message =
    typeof error === 'object' && error !== null
      ? error.message?.toLowerCase?.()
      : ''

  if (message.includes('already') || message.includes('exists')) {
    return appError('Já existe uma conta com este email ou usuário', 400)
  }

  if (message.includes('email') && message.includes('invalid')) {
    return appError('Email inválido', 400)
  }

  if (message.includes('password')) {
    return appError('A senha não atende aos requisitos mínimos', 400)
  }

  if (message.includes('username')) {
    return appError('Nome de usuário já está em uso', 400)
  }

  if (message.includes('rate')) {
    return appError('Muitas tentativas. Tente novamente em instantes.', 429)
  }

  return null
}
