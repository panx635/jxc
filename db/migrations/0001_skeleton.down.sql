-- 0001 回滚：按依赖顺序删掉应用骨架表。
drop table if exists user_session;
drop table if exists app_user;
drop table if exists warehouse;
drop table if exists unit;
drop table if exists shop_profile;
