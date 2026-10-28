import { expect, test } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Real browser WebRTC and the actual SQL migration. The Supabase HTTP transport
// is replaced by a local bridge, so this test needs no external account or TURN.
test('two WebRTC peers exchange processed audio, video and chat, then disconnect on Next', async ({
  browser
}) => {
  test.setTimeout(60000);
  const db = new PGlite();
  const ids = ['b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'];
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    create publication supabase_realtime;`);
  await db.exec(readFileSync('supabase/migrations/001_callbate.sql', 'utf8'));
  for (const id of ids) await db.query('insert into auth.users(id) values ($1)', [id]);
  let serial = Promise.resolve();
  async function operation(index: number, action: string, args: Record<string, unknown>) {
    let result: unknown;
    const execute = serial.then(async () => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[index]]);
      await db.exec('set role authenticated');
      try {
        if (action === 'rpc') {
          const name = String(args.name);
          const params = args.params as Record<string, unknown> | undefined;
          let sql: string,
            values: unknown[] = [];
          if (name === 'join_queue') {
            sql = 'select public.join_queue($1::uuid,$2,$3::uuid) as data';
            values = [params?.p_topic, params?.p_side, params?.p_avoid];
          } else if (['leave_session', 'session_status'].includes(name))
            sql = `select public.${name}() as data`;
          else throw new Error('Unexpected RPC');
          result = {
            data: (await db.query<{ data: unknown }>(sql, values)).rows[0].data,
            error: null
          };
        } else if (args.table === 'room_messages' && args.mode === 'insert') {
          const row = args.row as Record<string, unknown>;
          const inserted = await db.query(
            'insert into public.room_messages(match_id,sender_id,kind,payload) values ($1,$2,$3,$4) returning *',
            [row.match_id, row.sender_id, row.kind, row.payload]
          );
          result = { data: inserted.rows[0], error: null };
        } else if (args.table === 'room_messages') {
          const filters = args.filters as Record<string, unknown>;
          const messages = await db.query(
            'select * from public.room_messages where match_id=$1 and id>$2 order by id limit 250',
            [filters.match_id, filters.id]
          );
          result = { data: messages.rows, error: null };
        } else throw new Error('Unexpected table');
      } catch (error) {
        result = { data: null, error: { message: String(error) } };
      }
    });
    serial = execute.catch(() => {});
    await execute;
    return result;
  }
  const shim = `
    export const configured = true;
    export const ensureParticipant = async () => ({id: window.__userId});
    function query(table) {
      const args = {table,mode:'select',filters:{}};
      const builder = {
        select() { return builder; }, insert(row) {args.mode='insert';args.row=row;return builder;},
        eq(key,value) {args.filters[key]=value;return builder;}, gt(key,value) {args.filters[key]=value;return builder;},
        order() {return builder;}, limit() {return builder;}, single() {return builder;},
        then(resolve,reject) {return window.__database('query',args).then(resolve,reject);}
      };
      return builder;
    }
    export const supabase = {
      auth:{getSession:async()=>({data:{session:{access_token:'local-test'}}})},
      rpc:(name,params)=>window.__database('rpc',{name,params}), from:query,
      channel:()=>({on(){return this;},subscribe(){return this;}}), removeChannel:async()=>{}
    };
  `;
  const contexts = await Promise.all(
    ids.map(() => browser.newContext({ permissions: ['microphone', 'camera'] }))
  );
  try {
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    for (let i = 0; i < pages.length; i++) {
      await pages[i].exposeFunction('__database', (action: string, args: Record<string, unknown>) =>
        operation(i, action, args)
      );
      await pages[i].addInitScript((id) => {
        (window as unknown as { __userId: string }).__userId = id;
      }, ids[i]);
      await pages[i].route('**/src/lib/supabase.ts', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: shim })
      );
      await pages[i].route('**/api/ice', (route) =>
        route.fulfill({ json: { iceServers: [], relay: false } })
      );
      await pages[i].goto('/panduan');
      await pages[i].evaluate(
        async (side) => {
          const modulePath = '/src/lib/room.ts';
          const { DebateRoom } = await import(/* @vite-ignore */ modulePath);
          const testWindow = window as unknown as {
            testRoom: InstanceType<typeof DebateRoom>;
            testState: { status: string };
          };
          testWindow.testRoom = new DebateRoom(
            'a0000000-0000-4000-8000-000000000001',
            side,
            (next: { status: string }) => (testWindow.testState = next)
          );
          await testWindow.testRoom.start();
        },
        i === 0 ? 'pro' : 'kontra'
      );
    }
    for (const page of pages) {
      await expect
        .poll(() => page.evaluate(() => (window as any).testState.status), { timeout: 20000 })
        .toBe('connected');
      await expect
        .poll(
          () =>
            page.evaluate(async () => {
              const stats = await (window as any).testRoom.pc.getStats();
              return [...stats.values()].some(
                (s: any) => s.type === 'inbound-rtp' && s.kind === 'audio' && s.packetsReceived > 0
              );
            }),
          { timeout: 10000 }
        )
        .toBe(true);
    }
    await pages[0].evaluate(async () => {
      (window as any).testRoom.voice.setPitch(-4);
      await (window as any).testRoom.sendChat('Saya punya perspektif berbeda.');
    });
    await expect
      .poll(
        () => pages[1].evaluate(() => (window as any).testState.messages.at(-1)?.payload.text),
        { timeout: 10000 }
      )
      .toBe('Saya punya perspektif berbeda.');
    await pages[0].evaluate(async () => {
      await (window as any).testRoom.toggleCamera();
    });
    await expect
      .poll(
        () =>
          pages[1].evaluate(() =>
            (window as any).testState.remote
              .getVideoTracks()
              .some((track: MediaStreamTrack) => !track.muted)
          ),
        { timeout: 10000 }
      )
      .toBe(true);
    await pages[0].evaluate(async () => {
      await (window as any).testRoom.next();
    });
    await expect
      .poll(() => pages[1].evaluate(() => (window as any).testState.status), { timeout: 10000 })
      .toBe('ended');
    expect(await pages[0].evaluate(() => (window as any).testState.status)).toBe('searching');
    for (const page of pages)
      await page.evaluate(() => {
        const room = (window as any).testRoom;
        const tracks = room.voice.raw.getTracks();
        room.dispose();
        if (tracks.some((track: MediaStreamTrack) => track.readyState !== 'ended'))
          throw new Error('Microphone not released');
      });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await serial;
    await db.close();
  }
});
