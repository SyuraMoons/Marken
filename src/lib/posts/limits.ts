// Live posts per shop per day. Enforced by the posts_daily_cap trigger
// (supabase/migrations/20261103030000_five_posts_per_day.sql); keep both in sync.
export const MAX_POSTS_PER_DAY = 5;

// SQLSTATE raised by posts_daily_cap when the day is full.
export const DAILY_POST_LIMIT_CODE = "MK429";
