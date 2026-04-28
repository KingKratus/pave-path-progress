
SELECT cron.schedule(
  'scheduled-sync-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://imaonsekdeanmwmhvzeh.supabase.co/functions/v1/scheduled-sync',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltYW9uc2VrZGVhbm13bWh2emVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTM4NDQsImV4cCI6MjA4Nzc4OTg0NH0.aA_Dan4BWc75dNznzCcf0LuV09ycCJ2KKhCivKfaOzQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
