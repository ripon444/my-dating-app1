import { db } from './index.ts';
import { users, profiles } from './schema.ts';
import { SqlHelper } from '../../server/db.ts';

/**
 * Bi-directional PostgreSQL <-> SQLite user and profile sync
 * Ensures data in Neon PostgreSQL (such as registered users, profiles, follows)
 * is seamlessly accessible in the SQLite caching layer and vice-versa.
 */
export async function syncPostgresToSqlite() {
  try {
    const pgUsers = await db.select().from(users);
    if (pgUsers && pgUsers.length > 0) {
      for (const u of pgUsers) {
        await SqlHelper.execute(
          `INSERT OR REPLACE INTO users (
            id, email, password, role, is_email_verified, is_age_verified, is_banned,
            subscription_tier, subscription_expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            u.id,
            u.email,
            u.password || '',
            u.role || 'USER',
            u.isEmailVerified ?? 1,
            u.isAgeVerified ?? 1,
            u.isBanned ?? 0,
            u.subscriptionTier || 'FREE',
            u.subscriptionExpiresAt || null,
            u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
            u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString(),
          ]
        );
      }
      console.log(`[Sync Engine] Successfully synced ${pgUsers.length} users from PostgreSQL to SQLite.`);
    }

    const pgProfiles = await db.select().from(profiles);
    if (pgProfiles && pgProfiles.length > 0) {
      for (const p of pgProfiles) {
        await SqlHelper.execute(
          `INSERT OR REPLACE INTO profiles (
            id, user_id, source_type, provider_id, provider_name, external_profile_id, external_profile_url,
            last_synced_at, attribution_requirement, name, age, date_of_birth, gender, country, city, region,
            approx_distance_km, bio, cover_photo, username, social_links_json, website, photos_json,
            interests_json, languages_json, relationship_goal, education, profession, height, smoking,
            drinking, children, compatibility_score, is_online, last_active, is_verified, is_boosted,
            boost_expires_at, is_visible, show_age, show_approx_location, allow_calls, allow_messages,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?
          )`,
          [
            p.id,
            p.userId,
            p.sourceType || 'native',
            p.providerId || null,
            p.providerName || null,
            p.externalProfileId || null,
            p.externalProfileUrl || null,
            p.lastSyncedAt || null,
            p.attributionRequirement || null,
            p.name,
            p.age || 25,
            p.dateOfBirth || '1999-01-01',
            p.gender || 'OTHER',
            p.country || '',
            p.city || '',
            p.region || '',
            p.approxDistanceKm || 15,
            p.bio || '',
            p.coverPhoto || '',
            p.username || null,
            p.socialLinksJson || '{}',
            p.website || '',
            p.photosJson || '[]',
            p.interestsJson || '[]',
            p.languagesJson || '[]',
            p.relationshipGoal || 'Relationship',
            p.education || null,
            p.profession || null,
            p.height || null,
            p.smoking || null,
            p.drinking || null,
            p.children || null,
            p.compatibilityScore || 85,
            p.isOnline || 0,
            p.lastActive || null,
            p.isVerified || 1,
            p.isBoosted || 0,
            p.boostExpiresAt || null,
            p.isVisible !== 0 ? 1 : 0,
            p.showAge !== 0 ? 1 : 0,
            p.showApproxLocation !== 0 ? 1 : 0,
            p.allowCalls !== 0 ? 1 : 0,
            p.allowMessages !== 0 ? 1 : 0,
            p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
            p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
          ]
        );
      }
      console.log(`[Sync Engine] Successfully synced ${pgProfiles.length} profiles from PostgreSQL to SQLite.`);
    }
  } catch (err) {
    console.warn('[Sync Engine] PostgreSQL to SQLite sync warning (non-fatal):', err);
  }
}

export async function syncSqliteWithPostgres() {
  // First pull down any data from PostgreSQL into SQLite
  await syncPostgresToSqlite();

  try {
    const sqliteUsers = await SqlHelper.queryAll<any>('SELECT * FROM users');
    if (!sqliteUsers || sqliteUsers.length === 0) return;

    for (const u of sqliteUsers) {
      await db.insert(users).values({
        id: u.id,
        email: u.email,
        password: u.password || '',
        role: u.role || 'USER',
        isEmailVerified: Number(u.is_email_verified) || 1,
        isAgeVerified: Number(u.is_age_verified) || 1,
        isBanned: Number(u.is_banned) || 0,
        subscriptionTier: u.subscription_tier || 'FREE',
        subscriptionExpiresAt: u.subscription_expires_at,
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          email: u.email,
          role: u.role || 'USER',
        }
      }).catch((e: any) => {
        // Ignore duplicate email if ID differed
      });
    }

    const sqliteProfiles = await SqlHelper.queryAll<any>('SELECT * FROM profiles');
    if (sqliteProfiles && sqliteProfiles.length > 0) {
      for (const p of sqliteProfiles) {
        await db.insert(profiles).values({
          id: p.id,
          userId: p.user_id,
          sourceType: p.source_type || 'native',
          providerId: p.provider_id,
          providerName: p.provider_name,
          externalProfileId: p.external_profile_id,
          externalProfileUrl: p.external_profile_url,
          lastSyncedAt: p.last_synced_at,
          attributionRequirement: p.attribution_requirement,
          name: p.name,
          age: Number(p.age) || 25,
          dateOfBirth: p.date_of_birth || '1999-01-01',
          gender: p.gender || 'OTHER',
          country: p.country || '',
          city: p.city || '',
          region: p.region || '',
          approxDistanceKm: Number(p.approx_distance_km) || 15,
          bio: p.bio || '',
          coverPhoto: p.cover_photo || '',
          username: p.username || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : null),
          socialLinksJson: p.social_links_json || '{}',
          website: p.website || '',
          photosJson: p.photos_json || '[]',
          interestsJson: p.interests_json || '[]',
          languagesJson: p.languages_json || '[]',
          relationshipGoal: p.relationship_goal || 'Relationship',
          education: p.education,
          profession: p.profession,
          height: p.height ? Number(p.height) : null,
          smoking: p.smoking,
          drinking: p.drinking,
          children: p.children,
          compatibilityScore: Number(p.compatibility_score) || 85,
          isOnline: Number(p.is_online) || 0,
          lastActive: p.last_active,
          isVerified: Number(p.is_verified) || 1,
          isBoosted: Number(p.is_boosted) || 0,
          boostExpiresAt: p.boost_expires_at,
          isVisible: p.is_visible !== 0 ? 1 : 0,
          showAge: p.show_age !== 0 ? 1 : 0,
          showApproxLocation: p.show_approx_location !== 0 ? 1 : 0,
          allowCalls: p.allow_calls !== 0 ? 1 : 0,
          allowMessages: p.allow_messages !== 0 ? 1 : 0,
        }).onConflictDoUpdate({
          target: profiles.id,
          set: {
            name: p.name,
            username: p.username || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : null),
            socialLinksJson: p.social_links_json || '{}',
            website: p.website || '',
            coverPhoto: p.cover_photo || '',
            bio: p.bio || '',
            city: p.city || '',
            country: p.country || '',
          }
        }).catch((e: any) => {
          // Ignore duplicate username
        });
      }
    }
    console.log(`[Sync Engine] Successfully synchronized ${sqliteUsers.length} users and ${sqliteProfiles?.length || 0} profiles from SQLite to PostgreSQL.`);
  } catch (error) {
    console.warn('[Sync Engine] Sync warning (non-fatal):', error);
  }
}

/**
 * Synchronize a single user and their profile from SQLite to PostgreSQL immediately
 */
export async function syncSingleUser(userId: string) {
  try {
    const u = await SqlHelper.queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (u) {
      await db.insert(users).values({
        id: u.id,
        email: u.email,
        password: u.password || '',
        role: u.role || 'USER',
        isEmailVerified: Number(u.is_email_verified) || 1,
        isAgeVerified: Number(u.is_age_verified) || 1,
        isBanned: Number(u.is_banned) || 0,
        subscriptionTier: u.subscription_tier || 'FREE',
        subscriptionExpiresAt: u.subscription_expires_at,
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          email: u.email,
          role: u.role || 'USER',
        }
      }).catch(() => {});
    }

    const p = await SqlHelper.queryOne<any>('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (p) {
      await db.insert(profiles).values({
        id: p.id,
        userId: p.user_id,
        sourceType: p.source_type || 'native',
        providerId: p.provider_id,
        providerName: p.provider_name,
        externalProfileId: p.external_profile_id,
        externalProfileUrl: p.external_profile_url,
        lastSyncedAt: p.last_synced_at,
        attributionRequirement: p.attribution_requirement,
        name: p.name,
        age: Number(p.age) || 25,
        dateOfBirth: p.date_of_birth || '1999-01-01',
        gender: p.gender || 'OTHER',
        country: p.country || '',
        city: p.city || '',
        region: p.region || '',
        approxDistanceKm: Number(p.approx_distance_km) || 15,
        bio: p.bio || '',
        coverPhoto: p.cover_photo || '',
        username: p.username || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : null),
        socialLinksJson: p.social_links_json || '{}',
        website: p.website || '',
        photosJson: p.photos_json || '[]',
        interestsJson: p.interests_json || '[]',
        languagesJson: p.languages_json || '[]',
        relationshipGoal: p.relationship_goal || 'Relationship',
        education: p.education,
        profession: p.profession,
        height: p.height ? Number(p.height) : null,
        smoking: p.smoking,
        drinking: p.drinking,
        children: p.children,
        compatibilityScore: Number(p.compatibility_score) || 85,
        isOnline: Number(p.is_online) || 0,
        lastActive: p.last_active,
        isVerified: Number(p.is_verified) || 1,
        isBoosted: Number(p.is_boosted) || 0,
        boostExpiresAt: p.boost_expires_at,
        isVisible: p.is_visible !== 0 ? 1 : 0,
        showAge: p.show_age !== 0 ? 1 : 0,
        showApproxLocation: p.show_approx_location !== 0 ? 1 : 0,
        allowCalls: p.allow_calls !== 0 ? 1 : 0,
        allowMessages: p.allow_messages !== 0 ? 1 : 0,
      }).onConflictDoUpdate({
        target: profiles.id,
        set: {
          name: p.name,
          username: p.username || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : null),
          socialLinksJson: p.social_links_json || '{}',
          website: p.website || '',
          coverPhoto: p.cover_photo || '',
          bio: p.bio || '',
          city: p.city || '',
          country: p.country || '',
        }
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Sync Engine] syncSingleUser notice:', err);
  }
}
