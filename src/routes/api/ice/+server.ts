import { TURN_CREDENTIALS_URL, TURN_CREDENTIALS_TOKEN } from '$app/env/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$app/env/public';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token || !PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY)
    return new Response('Unauthorized', { status: 401 });
  const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  const {
    data: { user },
    error
  } = await client.auth.getUser(token);
  if (error || !user) return new Response('Unauthorized', { status: 401 });
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!TURN_CREDENTIALS_URL)
    return Response.json(
      { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], relay: false },
      { headers }
    );
  try {
    const response = await fetch(TURN_CREDENTIALS_URL, {
      headers: TURN_CREDENTIALS_TOKEN ? { Authorization: `Bearer ${TURN_CREDENTIALS_TOKEN}` } : {},
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('TURN provider unavailable');
    const data = await response.json();
    if (!Array.isArray(data.iceServers) || !data.iceServers.length)
      throw new Error('Invalid TURN response');
    return Response.json({ iceServers: data.iceServers, relay: true }, { headers });
  } catch {
    return Response.json(
      { error: 'Layanan relay panggilan belum tersedia.' },
      { status: 503, headers }
    );
  }
};
