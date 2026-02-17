
function setupEventListeners() {
    const sidebarToggleButton = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleButton) {
        sidebarToggleButton.addEventListener('click', () => {
            document.getElementById('sidebar-placeholder').classList.toggle('sidebar-hidden');
            document.getElementById('main-content').classList.toggle('main-content-expanded');
        });
    }

    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const { error } = await supabaseClient.auth.signOut();
            if (error) console.error('Error logging out:', error);
            else window.location.replace('/login.html');
        });
    }
}

/**
 * ฟังก์ชันสำหรับดึงข้อมูลโปรไฟล์ผู้ใช้และอัปเดต UI
 */
const loadProfileData = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('/login.html');
        return;
    }
    const user = session.user;

    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') window.location.replace('/setup-profile.html');
        else console.error('Error fetching profile:', error);
        return;
    }
    
    console.log('Profile data from Supabase:', profile);
    console.log('User role is:', profile.role);

    const userNameElement = document.getElementById('user-full-name');
    if (userNameElement) userNameElement.innerText = profile.full_name || user.email;

    const adminMenuItem = document.getElementById('admin-menu-item');
    if (adminMenuItem && (profile.role === 'admin' || profile.role === 'super_admin')) {
        adminMenuItem.style.display = 'block';
    }
};

/**
 * 🚀 ฟังก์ชันเริ่มต้นการทำงานทั้งหมดของแอปพลิเคชัน
 */
async function initializeApp() {
    // ✅ [แก้ไข] สร้าง Supabase Client ที่นี่
    //supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. รอให้ "แม่แบบ" ทั้งหมด (Header, Sidebar) โหลดเสร็จก่อน
    await Promise.all([
        loadComponent('/_header.html', 'header-placeholder'),
        loadComponent('/_sidebar.html', 'sidebar-placeholder')
    ]);

    // 2. เมื่อแม่แบบพร้อมแล้ว ค่อยผูก Event ให้กับปุ่มต่างๆ ที่อยู่ในนั้น
    setupEventListeners();

    // 3. จากนั้นค่อยโหลดข้อมูลโปรไฟล์มาแสดง
    await loadProfileData();
}

// --- 3. START THE APP ---
// สั่งให้ฟังก์ชันเริ่มต้นทำงานทันทีที่หน้าเว็บโหลด DOM หลักเสร็จ
document.addEventListener('DOMContentLoaded', initializeApp);