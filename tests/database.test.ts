import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const topicA = 'a0000000-0000-4000-8000-000000000001';
const topicB = 'a0000000-0000-4000-8000-000000000002';
const users = [1, 2, 3, 4].map((n) => `b0000000-0000-4000-8000-00000000000${n}`);
let db: PGlite;
async function asUser(index: number) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [users[index]]);
  await db.exec('set role authenticated');
}
async function join(index: number, side: string, topic = topicA, avoid: string | null = null) {
  await asUser(index);
  const result = await db.query<{
    match: { id: string; pro_user: string; kontra_user: string } | null;
  }>('select public.join_queue($1::uuid,$2,$3::uuid) as match', [topic, side, avoid]);
  return result.rows[0].match;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(readFileSync('supabase/migrations/001_callbate.sql', 'utf8'));
  for (const id of users) await db.query('insert into auth.users(id) values ($1)', [id]);
  await db.query('insert into public.admin_users(user_id) values ($1)', [users[3]]);
});
beforeEach(async () => {
  await db.exec(
    'reset role; truncate public.matches,public.match_queue,public.room_messages,public.reports cascade'
  );
  await db.exec('update public.topics set active = true');
});
afterAll(async () => {
  await db?.close();
});

describe('atomic matchmaking and lifecycle', () => {
  it('pairs opposite sides FIFO and never pairs two pro users', async () => {
    expect(await join(0, 'pro')).toBeNull();
    expect(await join(1, 'pro')).toBeNull();
    const match = await join(2, 'kontra');
    expect(match?.pro_user).toBe(users[0]);
    expect(match?.kontra_user).toBe(users[2]);
    await asUser(0);
    const result = await db.query<{ status: { id: string } }>(
      'select public.session_status() as status'
    );
    expect(result.rows[0].status.id).toBe(match!.id);
  });
  it('isolates topics and rejects invalid sides or inactive topics', async () => {
    await join(0, 'pro');
    expect(await join(1, 'kontra', topicB)).toBeNull();
    await expect(join(2, 'invalid')).rejects.toThrow('Invalid side');
    await db.exec(`reset role; update public.topics set active=false where id='${topicA}'`);
    await expect(join(2, 'kontra')).rejects.toThrow('Topic unavailable');
  });
  it('ends both participants sessions and avoids the previous partner on Next', async () => {
    await join(0, 'pro');
    const old = await join(1, 'kontra');
    await db.query('select public.leave_session()');
    await asUser(0);
    expect(
      (await db.query<{ status: unknown }>('select public.session_status() as status')).rows[0]
        .status
    ).toBeNull();
    expect(await join(0, 'pro', topicA, users[1])).toBeNull();
    expect(await join(1, 'kontra')).toBeNull();
    expect((await join(2, 'kontra'))?.id).not.toBe(old!.id);
  });
  it('does not match stale queue entries and expires abandoned calls', async () => {
    await join(0, 'pro');
    await db.exec(
      "reset role; update public.match_queue set seen_at = now() - interval '2 minutes'"
    );
    expect(await join(1, 'kontra')).toBeNull();
    const match = await join(2, 'pro');
    expect(match?.kontra_user).toBe(users[1]);
    await db.exec("reset role; update public.matches set kontra_seen=now()-interval '2 minutes'");
    await asUser(2);
    expect(
      (await db.query<{ status: unknown }>('select public.session_status() as status')).rows[0]
        .status
    ).toBeNull();
  });
});

describe('database authorization and reports', () => {
  it('restricts matches and messages to participants, rejects sender spoofing', async () => {
    await join(0, 'pro');
    const match = (await join(1, 'kontra'))!;
    await db.query(
      "insert into public.room_messages(match_id,kind,payload) values ($1,'chat',$2)",
      [match.id, { text: 'Argumen saya' }]
    );
    await expect(
      db.query(
        "insert into public.room_messages(match_id,sender_id,kind,payload) values ($1,$2,'chat',$3)",
        [match.id, users[0], { text: 'Spoof' }]
      )
    ).rejects.toThrow();
    await asUser(2);
    expect((await db.query('select * from public.matches')).rows).toHaveLength(0);
    expect((await db.query('select * from public.room_messages')).rows).toHaveLength(0);
    await expect(
      db.query("insert into public.room_messages(match_id,kind,payload) values ($1,'chat',$2)", [
        match.id,
        { text: 'Intruder' }
      ])
    ).rejects.toThrow();
    await expect(db.query('select * from public.match_queue')).rejects.toThrow();
    await asUser(0);
    expect((await db.query('select * from public.room_messages')).rows).toHaveLength(1);
  });
  it('allows topic mutations only for admins and hides inactive topics publicly', async () => {
    await asUser(0);
    expect(
      (await db.query('update public.topics set active=false returning id')).rows
    ).toHaveLength(0);
    await expect(
      db.query('insert into public.admin_users(user_id) values ($1)', [users[0]])
    ).rejects.toThrow();
    await asUser(3);
    const created = await db.query<{ id: string }>(
      "insert into public.topics(title,description,category,active) values ('Mosi admin untuk pengujian','Konteks yang cukup panjang untuk dibahas.','Politik',false) returning id"
    );
    const id = created.rows[0].id;
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false); set role anon");
    expect((await db.query('select * from public.topics where id=$1', [id])).rows).toHaveLength(0);
    await asUser(3);
    expect(
      (await db.query('delete from public.topics where id=$1 returning id', [id])).rows
    ).toHaveLength(1);
  });
  it('accepts only genuine participant reports and prevents rematching', async () => {
    await join(0, 'pro');
    const match = (await join(1, 'kontra'))!;
    await db.query(
      "insert into public.reports(match_id,reported_id,reason) values ($1,$2,'Spam')",
      [match.id, users[0]]
    );
    await asUser(2);
    await expect(
      db.query("insert into public.reports(match_id,reported_id,reason) values ($1,$2,'Spam')", [
        match.id,
        users[0]
      ])
    ).rejects.toThrow();
    expect((await db.query('select * from public.reports')).rows).toHaveLength(0);
    await asUser(1);
    await db.query('select public.leave_session()');
    await join(0, 'pro');
    expect(await join(1, 'kontra')).toBeNull();
    await asUser(3);
    expect((await db.query('select * from public.reports')).rows).toHaveLength(1);
    await db.query('update public.reports set resolved=true');
    expect(
      (await db.query<{ resolved: boolean }>('select resolved from public.reports')).rows[0]
        .resolved
    ).toBe(true);
  });
  it('rejects invalid chat content, ended session inserts and bursts', async () => {
    await join(0, 'pro');
    const match = (await join(1, 'kontra'))!;
    await expect(
      db.query("insert into public.room_messages(match_id,kind,payload) values ($1,'chat',$2)", [
        match.id,
        { text: '' }
      ])
    ).rejects.toThrow();
    for (let n = 0; n < 20; n++)
      await db.query(
        "insert into public.room_messages(match_id,kind,payload) values ($1,'chat',$2)",
        [match.id, { text: `Message ${n}` }]
      );
    await expect(
      db.query("insert into public.room_messages(match_id,kind,payload) values ($1,'chat',$2)", [
        match.id,
        { text: 'Too many' }
      ])
    ).rejects.toThrow('Terlalu banyak pesan');
    await db.query('select public.leave_session()');
    await asUser(0);
    await expect(
      db.query("insert into public.room_messages(match_id,kind,payload) values ($1,'chat',$2)", [
        match.id,
        { text: 'After exit' }
      ])
    ).rejects.toThrow();
  });
});
