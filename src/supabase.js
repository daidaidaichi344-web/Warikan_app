import { createClient } from '@supabase/supabase-js';

// ▼▼▼ Supabaseダッシュボードで取得した値に書き換えてください ▼▼▼
// Supabaseダッシュボード → Settings → API
// で表示される「Project URL」と「anon public」キーをそのままコピーしてOKです。
const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_PUBLIC_KEY';
// ▲▲▲ ここまで ▲▲▲

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
