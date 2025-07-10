import * as Sentry from '@sentry/node'

// Initialize Sentry for server-side (Edge Functions)
export const initSentryServer = () => {
  Sentry.init({
    dsn: Deno.env.get('SENTRY_DSN'),
    environment: Deno.env.get('ENVIRONMENT') || 'development',
    tracesSampleRate: 1.0,
    beforeSend(event) {
      // Filter out sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }
      return event
    }
  })
}

// Sentry wrapper for Edge Functions
export const withSentry = (handler: (req: Request) => Promise<Response>) => {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req)
    } catch (error) {
      Sentry.captureException(error)
      console.error('Edge Function Error:', error)
      
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          id: Sentry.lastEventId()
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
} 