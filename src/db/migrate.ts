import { getPool } from './index.ts';

/**
 * Automatically creates all PostgreSQL tables if they don't already exist.
 * This runs seamlessly when DATABASE_URL is supplied (e.g. Neon, Supabase, Cloud SQL).
 */
export async function initializePostgresTables() {
  const pool = getPool();
  if (!pool) return;

  const client = await pool.connect();
  try {
    console.log('[Postgres Init] Verifying and creating database tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL DEFAULT '',
        role TEXT DEFAULT 'USER',
        is_email_verified INTEGER DEFAULT 1,
        is_age_verified INTEGER DEFAULT 1,
        is_banned INTEGER DEFAULT 0,
        subscription_tier TEXT DEFAULT 'FREE',
        subscription_expires_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        source_type TEXT DEFAULT 'native',
        provider_id TEXT,
        provider_name TEXT,
        external_profile_id TEXT,
        external_profile_url TEXT,
        last_synced_at TEXT,
        attribution_requirement TEXT,
        name TEXT NOT NULL,
        age INTEGER NOT NULL DEFAULT 25,
        date_of_birth TEXT DEFAULT '1999-01-01',
        gender TEXT DEFAULT 'OTHER',
        country TEXT DEFAULT '',
        city TEXT DEFAULT '',
        region TEXT DEFAULT '',
        approx_distance_km REAL DEFAULT 15,
        bio TEXT DEFAULT '',
        cover_photo TEXT DEFAULT '',
        username TEXT,
        social_links_json TEXT DEFAULT '{}',
        website TEXT DEFAULT '',
        photos_json TEXT DEFAULT '[]',
        interests_json TEXT DEFAULT '[]',
        languages_json TEXT DEFAULT '[]',
        relationship_goal TEXT DEFAULT 'Relationship',
        education TEXT,
        profession TEXT,
        height INTEGER,
        smoking TEXT,
        drinking TEXT,
        children TEXT,
        compatibility_score INTEGER DEFAULT 85,
        is_online INTEGER DEFAULT 0,
        last_active TEXT,
        is_verified INTEGER DEFAULT 1,
        is_boosted INTEGER DEFAULT 0,
        boost_expires_at TEXT,
        is_visible INTEGER DEFAULT 1,
        show_age INTEGER DEFAULT 1,
        show_approx_location INTEGER DEFAULT 1,
        allow_calls INTEGER DEFAULT 1,
        allow_messages INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS follows (
        id TEXT PRIMARY KEY,
        follower_id TEXT NOT NULL,
        following_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      );

      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        blocker_id TEXT NOT NULL,
        blocked_id TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data_json TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        match_id TEXT,
        user_a_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        user_b_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
        sender_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        content TEXT,
        message_type TEXT DEFAULT 'text',
        attachment_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,
        is_read INTEGER DEFAULT 0,
        read_at TEXT,
        translated_text TEXT,
        translated_lang TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        caller_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        duration INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS likes (
        id TEXT PRIMARY KEY,
        sender_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        is_super_like INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(sender_id, receiver_id)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        user_a_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        user_b_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_a_id, user_b_id)
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        reported_user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        reported_user_name TEXT,
        category TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscription_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tier TEXT DEFAULT 'VIP' NOT NULL,
        description TEXT DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'USDT',
        duration INTEGER NOT NULL DEFAULT 1,
        duration_unit TEXT DEFAULT 'months' NOT NULL,
        features_json TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT,
        user_name TEXT,
        plan_id TEXT NOT NULL,
        plan_name TEXT,
        plan_tier TEXT DEFAULT 'VIP',
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USDT',
        crypto_currency TEXT DEFAULT '',
        payment_id TEXT,
        order_id TEXT NOT NULL,
        payment_status TEXT DEFAULT 'waiting' NOT NULL,
        payment_address TEXT,
        transaction_hash TEXT,
        nowpayments_response_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        plan_name TEXT,
        tier TEXT DEFAULT 'VIP' NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        started_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        payment_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_settings (
        id TEXT PRIMARY KEY,
        api_key TEXT DEFAULT '',
        ipn_secret TEXT DEFAULT '',
        is_sandbox INTEGER DEFAULT 0,
        is_enabled INTEGER DEFAULT 1,
        payout_currency TEXT DEFAULT 'USDT',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_members (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'SUB_ADMIN',
        permissions_json TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_by TEXT DEFAULT 'Super Admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS boost_packages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        multiplier TEXT DEFAULT '10x',
        price NUMERIC(10,2) NOT NULL DEFAULT 4.99,
        currency TEXT DEFAULT 'USDT',
        description TEXT DEFAULT '',
        is_popular INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS legal_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        version TEXT DEFAULT '1.0',
        last_updated_by TEXT DEFAULT 'Administrator',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payment_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payment_transactions(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payment_transactions(payment_id);
      CREATE INDEX IF NOT EXISTS idx_user_subs_user_id ON user_subscriptions(user_id);

      -- Safe Alter statements for upgrades
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links_json TEXT DEFAULT '{}';
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_photo TEXT DEFAULT '';
      CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

      -- Ensure follows, blocks, and notifications never crash on hybrid/new user IDs
      ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
      ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
      ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_users_id_fk;
      ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_users_id_fk;
      ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_blocker_id_fkey;
      ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_blocked_id_fkey;
      ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_blocker_id_users_id_fk;
      ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_blocked_id_users_id_fk;
      ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
      ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_users_id_fk;
    `);

    console.log('[Postgres Init] All tables are ready in PostgreSQL database.');
  } catch (error) {
    console.error('[Postgres Init Error]:', error);
  } finally {
    client.release();
  }
}
