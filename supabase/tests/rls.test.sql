-- pgTAP Tests for RLS
begin;

-- Plan the tests
select plan(8);

-- Insert dummy users for testing
insert into auth.users (id, email) values 
('11111111-1111-1111-1111-111111111111', 'alice@test.com'),
('22222222-2222-2222-2222-222222222222', 'bob@test.com');

insert into profiles (id, email) values 
('11111111-1111-1111-1111-111111111111', 'alice@test.com'),
('22222222-2222-2222-2222-222222222222', 'bob@test.com');

insert into rooms (id, name) values ('99999999-9999-9999-9999-999999999999', 'Alice Room');
insert into memberships (user_id, room_id, role) values ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'abbot');

-- Test 1: Bob should not see Alice's room
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$ select * from rooms where id = '99999999-9999-9999-9999-999999999999' $$,
  'Bob cannot see rooms he does not belong to'
);

-- Test 2: Alice can see her room
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$ select id from rooms where id = '99999999-9999-9999-9999-999999999999' $$,
  $$ values ('99999999-9999-9999-9999-999999999999'::uuid) $$,
  'Alice can see her own room'
);

-- Test 3: Alice can insert an event
select lives_ok(
  $$ insert into events (room_id, day, time, title, kind, color) values ('99999999-9999-9999-9999-999999999999', 1, '06:00', 'Test', 'งานวัด', 'green') $$,
  'Alice (abbot) can insert events'
);

-- Test 4: Bob cannot insert an event in Alice's room
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select throws_ok(
  $$ insert into events (room_id, day, time, title, kind, color) values ('99999999-9999-9999-9999-999999999999', 1, '06:00', 'Test', 'งานวัด', 'green') $$,
  'new row violates row-level security policy for table "events"',
  'Bob cannot insert events in Alice room'
);

select * from finish();
rollback;
