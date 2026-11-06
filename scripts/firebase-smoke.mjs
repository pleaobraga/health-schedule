// Checks that the Firebase project answers, with no login and no writes. It expects refusals:
// a refused read proves Firestore is up with its rules active, and a refused sign-in proves
// the API key and Auth work. Keep the key out of every message printed here.

const apiKey = process.env.VITE_FIREBASE_API_KEY
const projectId = process.env.VITE_FIREBASE_PROJECT_ID
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN

// Web API keys are usually restricted by referrer, so call as the app would
const headers = authDomain ? { Referer: `https://${authDomain}/` } : {}

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/schedules/_smoke_check?key=${apiKey}`
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`
const REFUSED_LOGINS = ['INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND']

async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  return { status: response.status, error: body.error ?? {} }
}

async function checkFirestore() {
  const { status, error } = await readResponse(await fetch(FIRESTORE_URL, { headers }))
  const refusedByRules =
    status === 403 && /insufficient permissions/i.test(error.message ?? '')

  return refusedByRules
    ? { ok: true, detail: 'responds, and the rules refuse anonymous reads' }
    : { ok: false, detail: `expected a refusal from the rules, got HTTP ${status} ${error.status ?? ''}` }
}

async function checkAuth() {
  const { status, error } = await readResponse(
    await fetch(AUTH_URL, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'firebase-smoke-check@example.com',
        password: 'not-a-real-password',
        returnSecureToken: false,
      }),
    }),
  )
  const reason = String(error.message ?? '').split(' ')[0]

  return REFUSED_LOGINS.includes(reason)
    ? { ok: true, detail: 'responds, and the API key is valid' }
    : { ok: false, detail: `expected a refused login, got HTTP ${status} ${reason}` }
}

async function run(name, check) {
  try {
    const { ok, detail } = await check()
    console.log(`${ok ? '✅' : '❌'} ${name}: ${detail}`)
    return ok
  } catch (error) {
    console.log(`❌ ${name}: request failed (${error.cause?.code ?? error.name})`)
    return false
  }
}

if (!apiKey || !projectId) {
  console.error('❌ Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID.')
  process.exit(1)
}

const results = [await run('Firestore', checkFirestore), await run('Auth', checkAuth)]
process.exit(results.every(Boolean) ? 0 : 1)
