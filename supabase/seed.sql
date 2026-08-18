-- Seed data for testing purposes
-- Note: Requires some existing profiles from auth.users

insert into rooms (id, name) values ('00000000-0000-0000-0000-000000000001', 'วัดทดสอบ (Demo Temple)');

-- Assumes an auth.user with this ID exists or will be created
-- insert into memberships (user_id, room_id, role) values ('USER_ID_HERE', '00000000-0000-0000-0000-000000000001', 'abbot');

insert into events (id, room_id, day, time, title, kind, color) values 
('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 12, '05:30', 'บิณฑบาตสาย 1', 'บิณฑบาต', 'saffron'),
('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 12, '13:00', 'ทำความสะอาดศาลา', 'งานวัด', 'green');
