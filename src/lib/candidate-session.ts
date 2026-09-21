import { cookies } from 'next/headers';

export const CANDIDATE_SESSION_COOKIE = 'za_candidate_session';
export const CANDIDATE_SESSION_SECONDS = 30 * 60;

export async function candidateSessionToken() {
  return (await cookies()).get(CANDIDATE_SESSION_COOKIE)?.value ?? '';
}

export async function setCandidateSession(token: string) {
  (await cookies()).set(CANDIDATE_SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/track', maxAge: CANDIDATE_SESSION_SECONDS,
  });
}

export async function clearCandidateSession() {
  (await cookies()).set(CANDIDATE_SESSION_COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/track', maxAge: 0,
  });
}
