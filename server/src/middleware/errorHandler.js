// Express requires a 4-arg signature to treat this as an error handler.
export function errorHandler(err, req, res, next) {
  void next
  const status = err.status || err.statusCode || 500
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error'

  if (status >= 500) {
    console.error(err)
  }

  const body = { error: message }
  if (err.code && typeof err.code === 'string') body.code = err.code
  if (Array.isArray(err.issues)) body.issues = err.issues
  if (Array.isArray(err.failures)) body.failures = err.failures
  res.status(status).json(body)
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not Found' })
}
