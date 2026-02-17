// =================================================================
// PCS Test Case - Activity View Script
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const tabsContainer = document.getElementById('activity-tabs');
    
    // Left Column
    const actTitle = document.getElementById('act-title');
    const actDesc = document.getElementById('act-desc');
    const actBgIcon = document.getElementById('act-bg-icon');
    // const actScenariosList = document.getElementById('act-scenarios-list'); // ❌ ลบออกแล้วตามแผน

    // Center Column
    const torListContainer = document.getElementById('tor-list-container');
    const torCountBadge = document.getElementById('tor-count');

    // Right Column
    const roleContainer = document.getElementById('stakeholder-roles-container');
    const companySection = document.getElementById('company-section');
    const companyListContainer = document.getElementById('company-list-container');
    const tcContainer = document.getElementById('test-case-container');
    const tcCountBadge = document.getElementById('tc-count');

    let allActivities = [];
    let currentActivityId = null;

    // --- 1. Initial Load ---
    async function init() {
        if (typeof supabaseClient === 'undefined') return;
        await fetchActivities();
    }

    // --- 2. Fetch Activities Master Data ---
    async function fetchActivities() {
        try {
            const { data, error } = await supabaseClient
                .from('project_activities')
                .select('*')
                .order('display_order');

            if (error) throw error;
            allActivities = data || [];
            renderTabs();

            // Auto-select first tab
            if (allActivities.length > 0) {
                // ---------------------------------------------------------
                // 🔥 จุดสำคัญที่ต้องแก้: ต้องใส่  เพื่อเลือกตัวแรก 🔥
                // ---------------------------------------------------------
                const firstActivityId = allActivities.id; 
                
                console.log("✅ First Activity ID:", firstActivityId); // ดูใน Console ว่าค่ามาไหม
                loadActivityDetails(firstActivityId);
            }

        } catch (err) {
            console.error('Error fetching activities:', err);
            if(tabsContainer) tabsContainer.innerHTML = '<span class="text-danger small">Failed to load activities.</span>';
        }
    }

    // --- 3. Render Tabs ---
    function renderTabs() {
        if(!tabsContainer) return;
        tabsContainer.innerHTML = '';
        allActivities.forEach((act, index) => {
            const li = document.createElement('li');
            li.className = 'nav-item';
            
            const btn = document.createElement('button');
            btn.className = `nav-link ${index === 0 ? 'active' : ''}`;
            btn.innerHTML = `<i class="bi ${act.icon_class || 'bi-activity'} me-2"></i>${act.name}`;
            btn.onclick = () => {
                // Update Active State
                document.querySelectorAll('#activity-tabs .nav-link').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Load Data
                loadActivityDetails(act.id);
            };
            
            li.appendChild(btn);
            tabsContainer.appendChild(li);
        });
    }

    // --- 4. Load & Render Activity Details (Core Logic) ---
    async function loadActivityDetails(activityId) {
        currentActivityId = activityId;
        
        // Show Loading State
        if(torListContainer) torListContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary"></div></div>';
        if(roleContainer) roleContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-secondary"></div></div>';
        if(tcContainer) tcContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-secondary"></div></div>';
        if(companySection) companySection.style.display = 'none';

        try {
            // 4.1 Update Static Info (Left Column)
            const activity = allActivities.find(a => a.id === activityId);
            if (activity) {
                if(actTitle) actTitle.innerText = activity.name;
                // ใช้ innerHTML เพื่อรองรับ Rich Text
                if(actDesc) actDesc.innerHTML = activity.description || '<p class="text-muted fst-italic">ไม่มีข้อมูลรายละเอียด</p>';
                if(actBgIcon) actBgIcon.className = `bi ${activity.icon_class || 'bi-activity'} activity-icon-large`;
            }

            // 4.2 Fetch TORs linked to this Activity
            const { data: torLinks, error: torError } = await supabaseClient
                .from('activity_tor_links')
                .select(`
                    tor_id,
                    TORs (
                        tor_id, 
                        tor_name, 
                        Modules (module_name)
                    )
                `)
                .eq('activity_id', activityId)
                .order('tor_id'); 

            if (torError) throw torError;
            
            // Clean up data
            const tors = torLinks.map(link => link.TORs).filter(t => t !== null);
            renderTORs(tors);

            // 4.3 Fetch Stakeholder Roles linked to this Activity
            const { data: roles, error: roleError } = await supabaseClient
                .from('activity_stakeholder_roles')
                .select(`
                    *,
                    stakeholder_groups (id, name)
                `)
                .eq('activity_id', activityId)
                .order('display_order');

            if (roleError) throw roleError;
            renderRoles(roles);

            // 4.4 Fetch Test Cases associated with these TORs
            const torIds = tors.map(t => t.tor_id);
            if (torIds.length > 0) {
                const { data: testCases, error: tcError } = await supabaseClient
                    .from('test_cases')
                    .select('id, test_id_code, name, tor_id')
                    .in('tor_id', torIds)
                    .order('test_id_code');
                
                if (tcError) throw tcError;
                renderTestCases(testCases);
            } else {
                renderTestCases([]);
            }

        } catch (err) {
            console.error('Error loading details:', err);
            if(torListContainer) torListContainer.innerHTML = `<div class="alert alert-danger p-2 small">Error: ${err.message}</div>`;
            if(roleContainer) roleContainer.innerHTML = `<div class="text-muted small p-2">Failed to load roles.</div>`;
            if(tcContainer) tcContainer.innerHTML = `<div class="text-muted small p-2">Failed to load tests.</div>`;
        }
    }

    // --- 5. Render Functions ---

    function renderTORs(tors) {
        if(torCountBadge) torCountBadge.innerText = `${tors.length} Items`;
        
        if (tors.length === 0) {
            if(torListContainer) torListContainer.innerHTML = '<div class="text-muted text-center p-3">No TORs mapped to this activity.</div>';
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        tors.forEach(tor => {
            const torName = tor.tor_name.replace(/^([\d\.]+)/, '<strong>$1</strong>');
            
            html += `
                <div class="list-group-item px-0 py-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <span class="badge bg-light text-dark border me-2">${tor.Modules?.module_name || '-'}</span>
                    </div>
                    <div class="tor-list-item text-dark">${torName}</div>
                </div>
            `;
        });
        html += '</div>';
        if(torListContainer) torListContainer.innerHTML = html;
    }

    function renderRoles(roles) {
        if (roles.length === 0) {
            if(roleContainer) roleContainer.innerHTML = '<div class="text-muted text-center p-3">No specific roles defined.</div>';
            return;
        }

        let html = '';
        roles.forEach(role => {
            const groupName = role.stakeholder_groups?.name || 'Unknown Group';
            const groupID = role.stakeholder_groups?.id;
            
            html += `
                <div class="card mb-2 shadow-sm border-0 role-card" onclick="fetchCompaniesForGroup('${groupID}', '${groupName}', this)">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center">
                            <div class="flex-shrink-0 bg-primary-subtle text-primary rounded p-2 me-3">
                                <i class="bi bi-person-badge fs-4"></i>
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="mb-0 fw-bold text-primary">${role.role_name || groupName}</h6>
                                <small class="text-muted d-block">${role.specific_entity || groupName}</small>
                                ${role.selection_reason ? `<small class="text-secondary fst-italic" style="font-size: 0.75rem;">"${role.selection_reason}"</small>` : ''}
                            </div>
                            <i class="bi bi-chevron-right text-muted small"></i>
                        </div>
                    </div>
                </div>
            `;
        });
        if(roleContainer) roleContainer.innerHTML = html;
    }

    // Global function to be called from HTML onclick
    window.fetchCompaniesForGroup = async (groupId, groupName, cardElement) => {
        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
        cardElement.classList.add('active');

        if(companySection) companySection.style.display = 'block';
        if(companyListContainer) companyListContainer.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary"></span> Loading...';

        try {
            const { data, error } = await supabaseClient
                .from('stakeholder_company_links')
                .select(`company (company_name)`)
                .eq('group_id', groupId);

            if (error) throw error;

            if (!data || data.length === 0) {
                if(companyListContainer) companyListContainer.innerHTML = '<small class="text-muted">No companies found in this group.</small>';
                return;
            }

            const companies = data.map(link => link.company?.company_name).filter(n => n);
            if(companyListContainer) {
                companyListContainer.innerHTML = companies.map(name => 
                    `<span class="badge bg-white text-dark border shadow-sm py-2 px-3 mb-1"><i class="bi bi-building me-1"></i>${name}</span>`
                ).join('');
            }

        } catch (err) {
            console.error(err);
            if(companyListContainer) companyListContainer.innerHTML = '<small class="text-danger">Error loading companies.</small>';
        }
    };

    function renderTestCases(testCases) {
        if(tcCountBadge) tcCountBadge.innerText = testCases.length;

        if (testCases.length === 0) {
            if(tcContainer) tcContainer.innerHTML = '<div class="text-muted text-center p-3">No test objectives found.</div>';
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        testCases.forEach(tc => {
            html += `
                <div class="list-group-item px-0 py-2 border-bottom-0">
                    <div class="d-flex align-items-start">
                        <i class="bi bi-check-circle text-success mt-1 me-2" style="font-size: 0.8rem;"></i>
                        <div>
                            <div class="small fw-bold text-dark">${tc.name}</div>
                            <div class="text-muted" style="font-size: 0.75rem;">
                                <span class="me-2"><i class="bi bi-qr-code"></i> ${tc.test_id_code || '-'}</span>
                                <span><i class="bi bi-link-45deg"></i> Ref: ${tc.tor_id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        if(tcContainer) tcContainer.innerHTML = html;
    }

    // Init
    init();
});