
// Function 1: Sidebar & Logout Logic
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

// Function 2: Load Profile
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
    
    const userNameElement = document.getElementById('user-full-name');
    if (userNameElement) userNameElement.innerText = profile.full_name || user.email;

    const adminMenuItem = document.getElementById('admin-menu-item');
    if (adminMenuItem && (profile.role === 'admin' || profile.role === 'super_admin')) {
        adminMenuItem.style.display = 'block';
    }
};

// Function 3: Load Dashboard Stats (🔥 NEW)
const loadDashboardStats = async () => {
    try {
        const queries = [
            supabaseClient.from('Modules').select('*', { count: 'exact', head: true }),
            supabaseClient.from('pcs_module').select('*', { count: 'exact', head: true }),
            supabaseClient.from('company').select('*', { count: 'exact', head: true }),
            supabaseClient.from('stakeholder_groups').select('*', { count: 'exact', head: true }),
            supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
            supabaseClient.from('TORs').select('*', { count: 'exact', head: true }),
            supabaseClient.from('test_cases').select('*', { count: 'exact', head: true }),
            supabaseClient.from('scenarios').select('*', { count: 'exact', head: true }),
        ];

        const torBreakdownPromise = supabaseClient
            .from('TORs')
            .select('module_id, Modules(module_name)');

        const [
            resModules, resScreens, resCompanies, resGroups, resUsers, 
            resTors, resTestCases, resScenarios, 
            resTorBreakdown
        ] = await Promise.all([...queries, torBreakdownPromise]);

        const animateValue = (id, value) => {
            const el = document.getElementById(id);
            if(el) el.innerText = value || 0;
        };

        animateValue('count-modules', resModules.count);
        animateValue('count-screens', resScreens.count);
        animateValue('count-stakeholders', resCompanies.count);
        animateValue('count-groups', resGroups.count);
        //animateValue('count-users', resUsers.count);
        animateValue('count-tors', resTors.count);
        animateValue('count-testcases', resTestCases.count);
        animateValue('count-scenarios', resScenarios.count);
        
        document.getElementById('last-update').innerText = `Last updated: ${new Date().toLocaleTimeString('th-TH')}`;

        if (resTorBreakdown.data) {
            renderTorChart(resTorBreakdown.data);
        }

    } catch (error) {
        console.error("Dashboard Load Error:", error);
    }
};

// Helper: Render Chart
function renderTorChart(torData) {
    const ctx = document.getElementById('torChart');
    if (!ctx) return;

    // 1. Group Data by Module Name (English Only)
    const counts = {};
    torData.forEach(item => {
        const fullName = item.Modules?.module_name || 'Unknown';
        
        // 🔥 Regex: ดึงเฉพาะข้อความในวงเล็บ (...)
        const match = fullName.match(/\(([^)]+)\)/);
        const englishName = match ? match[1] : fullName; // ถ้าไม่มีวงเล็บใช้ชื่อเดิม

        counts[englishName] = (counts[englishName] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const dataValues = Object.values(counts);

    // 🔥 Register Plugin
    Chart.register(ChartDataLabels);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of TORs',
                data: dataValues,
                backgroundColor: 'rgba(13, 110, 253, 0.8)', // สีน้ำเงินเข้มนิดนึงให้ตัดกับตัวหนังสือสีขาว
                borderColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 1,
                borderRadius: 6,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                // 🔥 Config Datalabels (ตัวเลขในแท่ง)
                datalabels: {
                    color: '#ffffff',
                    anchor: 'end',    // ยึดตำแหน่งท้ายแท่ง
                    align: 'bottom',  // แสดงด้านในแท่ง (ล่างจากจุด anchor)
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: (value) => value // แสดงตัวเลขตรงๆ
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' },
                    ticks: { precision: 0 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}
// --- Main Init ---
async function initializeApp() {
    // 1. Load Layout
    await Promise.all([
        loadComponent('/_header.html', 'header-placeholder'),
        loadComponent('/_sidebar.html', 'sidebar-placeholder')
    ]);

    // 2. Setup Events
    setupEventListeners();

    // 3. Load Data
    await loadProfileData();
    await loadDashboardStats(); // เรียก Dashboard Function
}

document.addEventListener('DOMContentLoaded', initializeApp);