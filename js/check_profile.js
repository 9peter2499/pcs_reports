// dashboard.js

// --- Supabase Client Setup (เหมือนเดิม) ---
const SUPABASE_URL = 'https://fhnprrlmlhleomfqqvpp.supabase.co'; // <-- ใส่ Supabase URL ของคุณที่นี่
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobnBycmxtbGhsZW9tZnFxdnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MTAyMjIsImV4cCI6MjA2NjQ4NjIyMn0.WA-_yNFWxpFnJBA3oh5UlOtq89KBm5hqsb51oi04hMk';   // <-- ใส่ Supabase Anon Key ของคุณที่นี่

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * นี่คือฟังก์ชัน "Router" ของเรา
 * มันจะตรวจสอบโปรไฟล์และตัดสินใจว่าจะไปหน้าไหนต่อ
 */
const handlePostLoginRouting = async () => {
    // 1. ตรวจสอบว่าผู้ใช้ Login อยู่จริงหรือไม่
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
        // ถ้าไม่มี session (ยังไม่ได้ Login) ให้ส่งกลับไปหน้า Login
        window.location.replace('/index.html');
        return;
    }

    const user = session.user;

    // 2. ดึงข้อมูลโปรไฟล์จากตาราง 'profiles'
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('company_id') // เราสนใจแค่ว่า company_id มีค่าหรือยัง
        .eq('id', user.id)
        .single(); // .single() จะดึงข้อมูลมาแค่แถวเดียว

    if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 คือรหัส "ไม่พบข้อมูล" ซึ่งในกรณีนี้คือโปรไฟล์ยังไม่ถูกสร้าง (ถือว่าปกติ)
        // แต่ถ้าเป็น Error อื่น ให้แสดงใน Console
        console.error("Error fetching profile:", profileError);
        return;
    }

    // 3. ส่วนของการตัดสินใจ (The Logic)
    if (!profile || profile.company_id === null) {
        // **เงื่อนไข:** ถ้ายังไม่มีโปรไฟล์เลย หรือ มีโปรไฟล์แล้วแต่ company_id เป็นค่าว่าง (null)
        // **การตัดสินใจ:** ให้ส่งผู้ใช้ไปที่หน้ากรอกข้อมูล
        console.log('Profile is incomplete. Redirecting to setup page.');
        window.location.replace('/setup-profile.html');
    } else {
        // **เงื่อนไข:** ถ้ามีโปรไฟล์และ company_id มีค่าแล้ว
        // **การตัดสินใจ:** ให้ผู้ใช้เข้าสู่ Index ได้
        console.log('Profile is complete. Welcome to the Home page!');
        // ณ จุดนี้ คุณสามารถเริ่มโหลดข้อมูลสำหรับ Dashboard จริงๆ ได้
        // เช่น เปลี่ยนข้อความ "Loading..." เป็น "Welcome, [User's Name]!"
        window.location.replace('/index.html');
    }
};

// สั่งให้ฟังก์ชัน Router ทำงานทันทีที่หน้าเว็บโหลดเสร็จ
document.addEventListener('DOMContentLoaded', handlePostLoginRouting);