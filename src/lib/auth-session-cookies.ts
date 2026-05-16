export const AUTH_METHOD_COOKIE = 'sa_auth_method'
export const DEPT_CONTEXT_COOKIE = 'sa_dept_ctx'
export const WEBAUTHN_CHALLENGE_COOKIE = 'sa_wauthn_challenge'

type ResponseWithCookies = {
  cookies: {
    delete: (name: string) => void
  }
}

export function clearAuthContextCookies(response: ResponseWithCookies) {
  response.cookies.delete(AUTH_METHOD_COOKIE)
  response.cookies.delete(DEPT_CONTEXT_COOKIE)
  response.cookies.delete(WEBAUTHN_CHALLENGE_COOKIE)
}
