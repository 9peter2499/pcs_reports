// /js/supabase-client.js

const SUPABASE_URL = 'https://fhnprrlmlhleomfqqvpp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobnBycmxtbGhsZW9tZnFxdnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MTAyMjIsImV4cCI6MjA2NjQ4NjIyMn0.WA-_yNFWxpFnJBA3oh5UlOtq89KBm5hqsb51oi04hMk'; // <-- 🚨 ใส่ Anon Key ของคุณที่นี่

// สร้าง Supabase Client และส่งออกไปให้ไฟล์อื่นใช้งาน
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);