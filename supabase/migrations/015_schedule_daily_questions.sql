-- 015_schedule_daily_questions.sql

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'generate-daily-questions',
  '55 19 * * *', -- Runs every day at 7:55 PM
  $$
    select net.http_post(
      url:='https://isoxoayrkcnmmvulskhv.supabase.co/functions/v1/generate-daily-questions',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_CCHpVZCLusI7jy_5mQqbOA_LolCTl1l"}'::jsonb
    );
  $$
);
