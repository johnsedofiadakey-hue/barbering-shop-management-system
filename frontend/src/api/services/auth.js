import api from '@api';
import { ENDPOINTS } from '@api/endpoints';
import {
  beginFirebasePhoneVerification,
  completeFirebasePhoneVerification,
  firebasePhoneAuthEnabled,
  signInWithFirebaseEmail,
  signOutFirebase,
} from '../../lib/firebase';

/**
 * Keys used for storing authentication tokens in localStorage.
 */
const STORAGE_KEYS = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
};

/**
 * Retrieves the access token from localStorage.
 */
export function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.ACCESS);
}

/**
 * Retrieves the refresh token from localStorage.
 */
export function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.REFRESH);
}

/**
 * Stores the access and refresh tokens in localStorage.
 */
export function setTokens({ access, refresh }) {
  localStorage.setItem(STORAGE_KEYS.ACCESS, access);
  localStorage.setItem(STORAGE_KEYS.REFRESH, refresh);
}

/**
 * Removes the access and refresh tokens from localStorage.
 */
export function removeTokens() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS);
  localStorage.removeItem(STORAGE_KEYS.REFRESH);
}

/**
 * Retrieves the current users's information.
 */
export async function getCurrentUser() {
  const { data } = await api.instance.get(ENDPOINTS.auth.me);
  return data;
}

/**
 * Logs out the user by invalidating the refresh token on the server
 */
export async function logout() {
  const refresh = getRefreshToken();
  try {
    if (refresh) {
      await api.instance.post(ENDPOINTS.auth.logout, { refresh_token: refresh });
    }
  } catch {
    // ignore API errors during logout
  }
  try {
    await signOutFirebase();
  } catch {
    // Django logout must still complete if the Firebase SDK is unavailable.
  }
  removeTokens();
}

/**
 * Refreshes the access token using the refresh token.
 */
export async function refreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token');

  const { data } = await api.instance.post(ENDPOINTS.auth.refresh, { refresh_token: refresh });

  localStorage.setItem(STORAGE_KEYS.ACCESS, data.access_token);

  return data.access_token;
}

/**
 * Requests a one-time login code sent via SMS to the given phone number.
 */
export async function requestOtp(phoneNumber) {
  if (firebasePhoneAuthEnabled) {
    await beginFirebasePhoneVerification(phoneNumber);
    return { detail: 'Verification code sent.' };
  }

  const { data } = await api.instance.post(ENDPOINTS.auth.requestOtp, { phone_number: phoneNumber });
  return data;
}

/**
 * Verifies a one-time code and logs the client in.
 * Creates the client account on first login. Stores the received tokens in localStorage.
 */
export async function verifyOtp(phoneNumber, code) {
  let data;

  if (firebasePhoneAuthEnabled) {
    const idToken = await completeFirebasePhoneVerification(code);
    const response = await api.instance.post(ENDPOINTS.auth.firebasePhone, { id_token: idToken });
    data = response.data;
  } else {
    const response = await api.instance.post(ENDPOINTS.auth.verifyOtp, { phone_number: phoneNumber, code });
    data = response.data;
  }

  const { user, token } = data;

  setTokens({
    access: token.access_token,
    refresh: token.refresh_token,
  });

  return { user, token, requires_profile_setup: Boolean(data.requires_profile_setup) };
}

/**
 * Signs in a staff (admin/barber) account that has been explicitly linked to a Firebase
 * identity (via the `create_firebase_admin` management command). Stores the received tokens.
 */
export async function loginWithFirebaseEmail(email, password) {
  const idToken = await signInWithFirebaseEmail(email, password);
  const { data } = await api.instance.post(ENDPOINTS.auth.firebaseStaff, { id_token: idToken });
  const { user, token } = data;

  setTokens({
    access: token.access_token,
    refresh: token.refresh_token,
  });

  return user;
}

/**
 * Registers a new barber account using a verification token and UID.
 */
export async function registerBarber(uidb64, token, barberData) {
  const { data } = await api.instance.post(ENDPOINTS.auth.registerBarber(uidb64, token), barberData);
  return data;
}

/**
 *  Gets the email associated to the user from the given uid64 and token, if valid
 */
export async function getEmailFromToken(uidb64, token) {
  const { data } = await api.instance.get(ENDPOINTS.auth.emailFromToken(uidb64, token));
  return data;
}
