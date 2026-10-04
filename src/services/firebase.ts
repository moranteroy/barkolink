import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getDataConnect, type DataConnect } from 'firebase/data-connect'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'
import { connectorConfig as passengerConnector } from '../dataconnect-generated/passenger'
import { connectorConfig as staffConnector } from '../dataconnect-generated/staff'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
)

export const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
export const dataConnect: DataConnect | null = firebaseApp ? getDataConnect(firebaseApp, passengerConnector) : null
export const staffDataConnect: DataConnect | null = firebaseApp ? getDataConnect(firebaseApp, staffConnector) : null
export const functions: Functions | null = firebaseApp ? getFunctions(firebaseApp, 'asia-southeast1') : null
if (import.meta.env.DEV && functions) connectFunctionsEmulator(functions, '127.0.0.1', 5001)

export function requireAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured. Add the Firebase Web app values to .env.local.')
  return auth
}
