import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'notification_log',
  'push_subscriptions',
  'newspaper_archives',
  'weekly_stats',
  'bucket_media',
  'bucket_todos',
  'dictionary_entries',
  'bucket_items',
  'capture_events',
  'ledger_entries',
  'rules',
  'board_card_messages',
  'board_cards',
  'dynamic_questions',
  'question_responses',
  'questions',
  'energy_logs',
  'skip_requests',
  'task_completions',
  'tasks',
  'feed_events',
  'spaces'
];

async function clearData() {
  console.log("Starting data clear...");

  // Try to delete from each table multiple times to get around foreign key constraints if they are out of order
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`\n--- Attempt ${attempt} to delete table data ---`);
    for (const table of tables) {
      // First try deleting where id is not null
      let { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error && error.message.includes('id')) {
        // If it fails because of 'id' not existing, try space_id
        const res = await supabase.from(table).delete().not('space_id', 'is', null);
        error = res.error;
      }
      if (error && error.message.includes('space_id')) {
         // If it fails because of 'space_id' not existing, try user_id
         const res = await supabase.from(table).delete().not('user_id', 'is', null);
         error = res.error;
      }

      if (error) {
        console.error(`Attempt ${attempt}: Error clearing ${table}:`, error.message);
      } else {
        console.log(`Attempt ${attempt}: Cleared ${table}`);
      }
    }
  }

  console.log("\n--- Clearing auth users ---");
  // Delete all users
  let hasMore = true;
  let page = 1;
  while (hasMore) {
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (authError) {
      console.error('Error fetching users:', authError);
      break;
    }
    
    if (users && users.length > 0) {
      for (const user of users) {
        const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
        if (delError) {
          console.error(`Error deleting user ${user.id}:`, delError);
        } else {
          console.log(`Deleted user ${user.id} (${user.email || 'no email'})`);
        }
      }
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log("\nFinished clearing data.");
}

clearData().catch(console.error);
