// =================================================================
// PCS Test Case - User & Test Cases Page Script (usrwtc.js)
// (Updated: Add Position & Role to User Column)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL VARIABLES & DOM ELEMENTS ---
    let allUsersData = []; 
    let allReportViewData = []; 
    let allTestCasesMap = new Map(); 
    
    let allModulesOptions = []; 
    let allSubModulesOptions = []; 
    let allCompanyGroupOptions = []; 

    let currentModalBaseData = [];

    // DOM Elements
    const usrdataContainer = document.getElementById('usrdata-container');
    const companyGroupFilter = document.getElementById('company-group-filter'); 
    const moduleFilter = document.getElementById('main-module-filter'); 
    const subModuleFilter = document.getElementById('sub-module-filter');
    const searchInput = document.getElementById('search-input'); 
    const phaseFilter = document.getElementById('phase-filter'); 

    // Modal Elements
    const linkScenarioModalEl = document.getElementById('linkScenarioModal');
    const linkScenarioModal = new bootstrap.Modal(linkScenarioModalEl);
    const modalTitle = document.getElementById('linkScenarioModalLabel');
    const modalBody = document.getElementById('modal-scenarios-tbody');
    const modalLinkingIdInput = document.getElementById('modal-linking-user-id'); 
    const saveLinksBtn = document.getElementById('save-links-btn');
    
    const modalModuleFilter = document.getElementById('modal-module-filter');
    const modalSubModuleFilter = document.getElementById('modal-submodule-filter');
    const modalSearchInput = document.getElementById('modal-search-input');
    const modalSelectAll = document.getElementById('modal-select-all');
    const modalPhaseFilter = document.getElementById('modal-phase-filter');


    // --- 2. DATA FETCHING ---

    async function fetchPageData() {
        if (usrdataContainer) {
            usrdataContainer.innerHTML = '<p class="text-center p-5">กำลังโหลดข้อมูล...</p>';
        } else {
            console.error("Error: Element 'usrdata-container' not found in HTML!");
            return false; 
        }
        
        try {
            // 1. Fetch Users
            const { data: users, error: userError } = await supabaseClient
                .from('profiles')
                .select(`
                    id, 
                    full_name, 
                    position, 
                    role,
                    undisplay, 
                    company_id, 
                    company:company_id (company_name, company_group)
                `)
                // เงื่อนไขพื้นฐาน (ชื่อต้องไม่ว่าง)
                .neq('full_name', 'No Name')
                .neq('full_name', '')
                .not('full_name', 'is', null);
            
            if (userError) throw new Error(`Failed to fetch Users: ${userError.message}`);

            // ✨ Filter & Sort ใน JS
            // 1. กรองคนที่ undisplay = 'Y' ออก (แสดงเฉพาะ NULL หรือ ค่าอื่นๆ ที่ไม่ใช่ 'Y')
            const activeUsers = users.filter(u => u.undisplay !== 'Y');

            // 2. เรียงลำดับ (Company -> Name)
            activeUsers.sort((a, b) => {
                const companyA = (a.company?.company_name || '').toLowerCase();
                const companyB = (b.company?.company_name || '').toLowerCase();
                if (companyA < companyB) return -1;
                if (companyA > companyB) return 1;

                const nameA = (a.full_name || '').toLowerCase();
                const nameB = (b.full_name || '').toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });

            // 2. Fetch Links
            const { data: linksData, error: linkError } = await supabaseClient
                .from('user_test_case_links')
                .select('user_id, test_case_id');
            
            if (linkError) console.warn("Link fetch error:", linkError.message);

            // 3. Fetch View
            const { data: reportViewData, error: viewError } = await supabaseClient
                .from('test_case_report_view')
                .select('*');
            if (viewError) throw new Error(`Failed to fetch report view: ${viewError.message}`);
            allReportViewData = reportViewData || [];

            // 4. Fetch MasterOptions
            await fetchMasterOptions();

            // 5. Process Data
            processTestCasesMap();
            
            // ส่ง activeUsers ที่กรองแล้วไปใช้งานต่อ
            assembleUserData(activeUsers, linksData || []); 

            // 6. Populate UI
            populateMainFilters();
            
            return true;

        } catch (error) {
            console.error('Error fetchPageData:', error);
            if (usrdataContainer) {
                usrdataContainer.innerHTML = `<p class="text-danger p-5">${error.message}</p>`;
            }
            return false;
        }
    }

    async function fetchMasterOptions() {
        try {
            const { data: modules } = await supabaseClient.from('MasterOptions').select('option_id, option_label, display_order').eq('option_group', 'PCSMODULE').order('display_order');
            allModulesOptions = modules || [];
            
            const { data: submodules } = await supabaseClient.from('MasterOptions').select('option_id, option_label, option_relation').eq('option_group', 'PCSSUBMOD').order('display_order');
            allSubModulesOptions = submodules || [];

            const { data: comGroups } = await supabaseClient.from('MasterOptions').select('option_id, option_label').eq('option_group', 'COMGRP').order('display_order');
            allCompanyGroupOptions = comGroups || [];

        } catch (e) { console.warn("Failed to load master options", e); }
    }

    function processTestCasesMap() {
        allTestCasesMap.clear();
        for (const row of allReportViewData) {
            if (!row.test_case_id) continue;

            if (!allTestCasesMap.has(row.test_case_id)) {
                allTestCasesMap.set(row.test_case_id, {
                    test_case_id: row.test_case_id,
                    test_id_code: row.test_id_code,
                    test_case_name: row.test_case_name,
                    module_name: row.module_name,
                    module_subgroup: row.module_subgroup,
                    module_group_id: row.module_group,
                    test_phase_id: row.test_phase_id,
                    test_phase: row.test_phase || 'N/A',
                    scenarios: [] 
                });
            }
            if (row.scenario_id) {
                allTestCasesMap.get(row.test_case_id).scenarios.push({
                    id: row.scenario_id,
                    scenario_id_code: row.scenario_id_code,
                    name: row.scenario_name,
                    scenario_type: row.scenario_type
                });
            }
        }
    }

    function assembleUserData(users, linksData) {
        const linksMap = new Map();
        if (linksData) {
            linksData.forEach(link => {
                if (!linksMap.has(link.user_id)) {
                    linksMap.set(link.user_id, []);
                }
                const fullTestCaseData = allTestCasesMap.get(link.test_case_id);
                if (fullTestCaseData) {
                    linksMap.get(link.user_id).push(fullTestCaseData);
                }
            });
        }
        allUsersData = users.map(user => ({
            user_id: user.id,
            full_name: user.full_name || 'No Name',
            position: user.position || '-', // ✨ เพิ่ม Position
            role: user.role || '-',         // ✨ เพิ่ม Role
            company_id: user.company_id,
            company_name: user.company?.company_name || '-',
            company_group: user.company?.company_group || '', 
            linked_test_cases: linksMap.get(user.id) || []
        }));
    }


    // --- 3. UI & FILTERING ---

    async function fetchAndPopulateTestPhases() {
        if (!phaseFilter) return; 
        try {
            const { data: phases, error } = await supabaseClient.from('test_phases').select('id, name').order('name');
            if (error) throw error;
            phaseFilter.innerHTML = '<option value="all" selected>ทุก Phase</option>';
            phases.forEach(phase => {
                const option = document.createElement('option');
                option.value = phase.id;
                option.textContent = phase.name;
                phaseFilter.appendChild(option);
            });
        } catch (err) { console.error(err); }
    }

    function populateMainFilters() {
        if (companyGroupFilter) {
            companyGroupFilter.innerHTML = '<option value="all" selected>ทุกกลุ่มบริษัท</option>';
            allCompanyGroupOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.option_id;
                option.textContent = opt.option_label;
                companyGroupFilter.appendChild(option);
            });
        }

        if (moduleFilter) {
            moduleFilter.innerHTML = '<option value="all" selected>ทุก Module หลัก</option>';
            allModulesOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.option_id;
                option.textContent = opt.option_label;
                moduleFilter.appendChild(option);
            });

            moduleFilter.addEventListener('change', () => {
                const selectedMain = moduleFilter.value;
                if (subModuleFilter) {
                    subModuleFilter.innerHTML = '<option value="all" selected>ทุก Sub Module</option>';
                    if (selectedMain === 'all') {
                        subModuleFilter.disabled = true;
                    } else {
                        subModuleFilter.disabled = false;
                        allSubModulesOptions.filter(s => s.option_relation === selectedMain).forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt.option_id;
                            option.textContent = opt.option_label;
                            subModuleFilter.appendChild(option);
                        });
                    }
                }
                applyFiltersAndRender(); 
            });
        }
    }

    function applyFiltersAndRender() {
        const selectedGroup = companyGroupFilter ? companyGroupFilter.value : 'all';
        const selectedModule = moduleFilter ? moduleFilter.value : 'all';
        const selectedSubModule = subModuleFilter ? subModuleFilter.value : 'all'; 
        const selectedPhase = phaseFilter ? phaseFilter.value : 'all';
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let filteredData = allUsersData;

        if (selectedGroup && selectedGroup !== 'all') {
            filteredData = filteredData.filter(u => u.company_group === selectedGroup);
        }

        if (selectedModule && selectedModule !== 'all') {
            filteredData = filteredData.filter(user => {
                if (!user.linked_test_cases) return false;
                return user.linked_test_cases.some(tc => tc.module_group_id === selectedModule);
            });
        }

        if (selectedSubModule && selectedSubModule !== 'all') {
            filteredData = filteredData.filter(user => {
                if (!user.linked_test_cases) return false;
                return user.linked_test_cases.some(tc => tc.module_subgroup === selectedSubModule);
            });
        }

        if (searchTerm) {
            filteredData = filteredData.filter(user => {
                const isUserMatch = user.full_name.toLowerCase().includes(searchTerm);
                const isComMatch = user.company_name.toLowerCase().includes(searchTerm);
                const hasChildMatch = user.linked_test_cases && user.linked_test_cases.some(tc => {
                    const nameMatch = tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchTerm);
                    const codeMatch = tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchTerm);
                    return nameMatch || codeMatch;
                });
                return isUserMatch || isComMatch || hasChildMatch;
            });
        }

        renderData(filteredData, searchTerm, selectedPhase, selectedModule, selectedSubModule);
    }


    // --- 4. RENDER DATA ---

    function renderData(users, searchTerm = '', selectedPhase = 'all', selectedModule = 'all', selectedSubModule = 'all') {
        if (!usrdataContainer) return;

        let html = `
            <table class="table table-bordered table-hover align-middle">
                <thead class="table-light text-center">
                    <tr>
                        <th style="width: 25%;">ผู้ใช้งานระบบ (User)</th> <!-- ขยาย Width นิดนึง -->
                        <th style="width: 15%;">บริษัท</th>
                        <th style="width: 20%;">Test Objective</th>
                        <th style="width: 35%;">Test Name (Scenario)</th>
                        <th style="width: 5%;">Action</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (!users || users.length === 0) {
            html += `<tr><td colspan="5" class="text-center p-4 text-muted">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
        } else {
            users.forEach((user) => {
                const isUserMatch = searchTerm === '' || 
                                    user.full_name.toLowerCase().includes(searchTerm) || 
                                    user.company_name.toLowerCase().includes(searchTerm);
                
                let visibleTestCases = user.linked_test_cases || [];

                visibleTestCases = visibleTestCases.filter(tc => {
                    const nameMatch = tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchTerm);
                    const codeMatch = tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchTerm);
                    const isPhaseMatch = (selectedPhase === 'all') || (String(tc.test_phase_id) === String(selectedPhase));
                    const isModuleMatch = (selectedModule === 'all') || (tc.module_group_id === selectedModule);
                    const isSubModuleMatch = (selectedSubModule === 'all') || (tc.module_subgroup === selectedSubModule);
                    const filtersPass = isPhaseMatch && isModuleMatch && isSubModuleMatch;

                    if (isUserMatch) return filtersPass; 
                    else return (nameMatch || codeMatch) && filtersPass; 
                });

                if (visibleTestCases.length === 0 && !isUserMatch) return;

                // --- ✨ HTML Cosmetic Update: เพิ่ม Position & Role ---
                const userNameBlock = `
                    <div class="d-flex align-items-start">
                        <span class="user-badge flex-shrink-0 mt-1"><i class="bi bi-person-fill"></i></span>
                        <div>
                            <div class="fw-bold">${user.full_name}</div>
                            <div class="text-secondary" style="font-size: 0.8rem;">
                                ${user.position} <span class="mx-1">|</span> <span class="text-uppercase">${user.role}</span>
                            </div>
                        </div>
                    </div>`;
                
                const companyDisplay = `<small class="text-muted">${user.company_name}</small>`;
                
                const linkBtn = `
                    <button class="btn btn-sm btn-link p-0 open-link-modal-btn float-end" 
                            data-user-id="${user.user_id}" 
                            data-user-name="${user.full_name}"
                            title="จับคู่ Test Scenario">
                        <i class="bi bi-plus-circle fs-5 text-primary"></i>
                    </button>`;
                
                const userDisplay = `<div class="d-flex justify-content-between align-items-start h-100">
                                        <div class="text-break w-100 me-2">${userNameBlock}</div>
                                        <div class="flex-shrink-0">${linkBtn}</div>
                                     </div>`;

                if (visibleTestCases.length === 0) {
                    html += `
                        <tr class="user-row">
                            <td class="ps-3" style="vertical-align: top;">${userDisplay}</td>
                            <td style="vertical-align: top;">${companyDisplay}</td>
                            <td colspan="3" class="text-center text-muted fst-italic p-3">
                                <span class="opacity-50"><i class="bi bi-link-45deg"></i> ยังไม่มี Test Scenario ที่ผูกไว้</span>
                            </td>
                        </tr>`;
                } else {
                    const totalRowSpan = visibleTestCases.reduce((sum, tc) => sum + Math.max(1, (tc.scenarios ? tc.scenarios.length : 0)), 0);
                    let isFirstRow = true;

                    visibleTestCases.forEach(tc => {
                        const tcName = tc.test_case_name || '-';
                        const tcCode = tc.test_id_code || '';
                        const scenarios = tc.scenarios || [];
                        const phaseName = tc.test_phase || '';

                        let phaseBadgeHTML = '';
                        if (phaseName && phaseName !== 'N/A') {
                            let badgeClass = 'badge-phase-default';
                            const p = phaseName.toUpperCase();
                            if (p.includes('SIT')) badgeClass = 'badge-phase-sit';
                            else if (p.includes('UAT')) badgeClass = 'badge-phase-uat';
                            else if (p.includes('UNIT')) badgeClass = 'badge-phase-unit';
                            phaseBadgeHTML = `<span class="badge ${badgeClass} me-1">${phaseName}</span>`;
                        }
                        const tcIdBadge = tcCode ? `<span class="badge bg-info-subtle text-info-emphasis">${tcCode}</span>` : '';
                        
                        const tcContent = `
                            <div class="d-flex align-items-start"> 
                                <div class="d-flex align-items-center flex-shrink-0 me-2 mt-1"> 
                                    ${phaseBadgeHTML}
                                    ${tcIdBadge}
                                </div>
                                <div class="text-break"> 
                                    ${tcName}
                                </div>
                            </div>`;

                        const unlinkButton = `<button class="btn btn-sm btn-link text-danger p-0 unlink-tc-btn" data-user-id="${user.user_id}" data-tc-id="${tc.test_case_id}" title="นำออก"><i class="bi bi-dash-circle fs-5"></i></button>`;
                        const tcRowSpan = Math.max(1, scenarios.length);

                        if (scenarios.length === 0) {
                            html += `<tr class="scenario-row">`;
                            if (isFirstRow) { 
                                html += `<td class="ps-3" rowspan="${totalRowSpan}" style="vertical-align: top;">${userDisplay}</td>`;
                                html += `<td rowspan="${totalRowSpan}" style="vertical-align: top;">${companyDisplay}</td>`;
                                isFirstRow = false; 
                            }
                            html += `<td rowspan="${tcRowSpan}">${tcContent}</td>`;
                            html += `<td class="text-center text-muted fst-italic opacity-50">- No Scenario -</td><td class="text-center" rowspan="${tcRowSpan}">${unlinkButton}</td></tr>`;
                        } else {
                            scenarios.forEach((sc, idx) => {
                                html += `<tr class="scenario-row">`;
                                if (isFirstRow) { 
                                    html += `<td class="ps-3" rowspan="${totalRowSpan}" style="vertical-align: top;">${userDisplay}</td>`;
                                    html += `<td rowspan="${totalRowSpan}" style="vertical-align: top;">${companyDisplay}</td>`;
                                    isFirstRow = false; 
                                }
                                if (idx === 0) { html += `<td rowspan="${tcRowSpan}">${tcContent}</td>`; }
                                const scBadge = sc.scenario_id_code ? `<span class="badge bg-success-subtle text-success-emphasis">${sc.scenario_id_code || ''}</span>` : '';
                                const scType = sc.scenario_type ? `<span class="fw-light fst-italic text-secondary ms-1" style="font-size:11px;">[ ${sc.scenario_type} ]</span>` : '';
                                const scenarioDisplay = `<a href="/scendt.html?sc_id=${sc.id}" class="text-decoration-none text-dark">${scBadge}${sc.name || '-'} ${scType}</a>`;
                                html += `<td>${scenarioDisplay}</td>`;
                                if (idx === 0) { html += `<td class="text-center" rowspan="${tcRowSpan}">${unlinkButton}</td>`; }
                                html += `</tr>`;
                            });
                        }
                    });
                }
            });
        }
        html += `</tbody></table>`;
        usrdataContainer.innerHTML = html;
    }


    // --- 5. MODAL LOGIC ---

    async function openLinkModal(userId, userName) {
        modalTitle.textContent = `จับคู่ Test Objective กับ: ${userName}`;
        modalLinkingIdInput.value = userId;
        
        populateModalFilters(); 
        
        // Sync Phase Filter
        const mainPhase = document.getElementById('phase-filter');
        if (modalPhaseFilter && mainPhase) {
            modalPhaseFilter.innerHTML = mainPhase.innerHTML;
            modalPhaseFilter.value = 'all';
        }
        
        // Safety Load
        if (allTestCasesMap.size === 0) await fetchPageData(); 

        // 1. หาข้อมูล User ปัจจุบัน
        const currentUser = allUsersData.find(u => String(u.user_id) === String(userId));
        
        if (!currentUser) {
            console.error("User not found:", userId);
            return;
        }

        // 2. หา Links เดิมของ User (เพื่อติ๊กถูก Checkbox)
        const currentLinks = currentUser.linked_test_cases || [];
        const currentLinkIds = new Set(currentLinks.map(tc => tc.test_case_id));

        // ✨ 3. [Logic ใหม่] กรอง Test Case ตามสิทธิ์ของบริษัท (Company)
        const companyId = currentUser.company_id; 
        console.log(`User: ${userName}, Company ID: ${companyId}`);

        let allowedTestCaseIds = null;

        if (companyId) {
            // ไปดึงสิทธิ์ของบริษัทมา
            allowedTestCaseIds = await fetchCompanyAllowedTestCases(companyId);
            console.log(`Company allowed TCs:`, allowedTestCaseIds);
        } else {
            console.warn("User has no company assigned.");
        }

        // 4. สร้างรายการ Test Case ที่จะแสดงใน Modal
        let testCasesToShow = [];

        if (allowedTestCaseIds && allowedTestCaseIds.size > 0) {
            // ถ้ามีรายการสิทธิ์ -> กรองเอาเฉพาะที่มีในสิทธิ์
            const allTCs = Array.from(allTestCasesMap.values());
            testCasesToShow = allTCs.filter(tc => allowedTestCaseIds.has(tc.test_case_id));
        } else {
            // ถ้าไม่มีบริษัท หรือ บริษัทไม่มีสิทธิ์อะไรเลย -> ไม่แสดงอะไรเลย
            testCasesToShow = []; 
        }

        // เก็บลงตัวแปร Global เพื่อใช้ตอน Filter ใน Modal
        currentModalBaseData = testCasesToShow;

        // Reset Modal Filters
        modalModuleFilter.value = 'all';
        modalSubModuleFilter.value = 'all';
        modalSubModuleFilter.disabled = true;
        modalSearchInput.value = '';
        
        // Render
        renderModalTable(testCasesToShow, currentLinkIds);
        linkScenarioModal.show();
    }

    // ✨ ฟังก์ชันช่วยดึงสิทธิ์ของบริษัท (คืนค่าเป็น Set ของ ID)
    async function fetchCompanyAllowedTestCases(companyId) {
        try {
            const { data, error } = await supabaseClient
                .from('company_test_case_links')
                .select('test_case_id')
                .eq('company_id', companyId);
            
            if (error) throw error;
            
            // แปลงเป็น Set เพื่อความเร็ว และมั่นใจว่าไม่ซ้ำ
            return new Set(data.map(item => item.test_case_id));
        } catch (err) {
            console.error("Error fetching company allowed TCs:", err);
            return new Set(); 
        }
    }

    function populateModalFilters() {
        modalModuleFilter.innerHTML = '<option value="all" selected>ทุก Module หลัก</option>';
        allModulesOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.option_id; 
            option.textContent = opt.option_label;
            modalModuleFilter.appendChild(option);
        });

        if (modalPhaseFilter) {
            modalPhaseFilter.onchange = applyModalFilters;
        }

        modalModuleFilter.onchange = () => {
            const selectedVal = modalModuleFilter.value;
            modalSubModuleFilter.innerHTML = '<option value="all" selected>ทุก Sub Module</option>';
            if (selectedVal === 'all') {
                modalSubModuleFilter.disabled = true;
            } else {
                modalSubModuleFilter.disabled = false;
                allSubModulesOptions.filter(s => s.option_relation === selectedVal).forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.option_id;
                    option.textContent = opt.option_label;
                    modalSubModuleFilter.appendChild(option);
                });
            }
            applyModalFilters();
        };
        
        modalSubModuleFilter.onchange = applyModalFilters;
        modalSearchInput.oninput = applyModalFilters;
    }

    function applyModalFilters() {
        const modVal = modalModuleFilter.value;
        const subVal = modalSubModuleFilter.value;
        const searchVal = modalSearchInput.value.toLowerCase().trim();
        const phaseVal = modalPhaseFilter ? modalPhaseFilter.value : 'all';

        const checkedIds = new Set();
        modalBody.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => checkedIds.add(cb.dataset.testCaseId));
        
        const userId = modalLinkingIdInput.value;
        const currentLinks = allUsersData.find(u => String(u.user_id) === String(userId))?.linked_test_cases || [];
        const currentLinkIds = new Set(currentLinks.map(tc => tc.test_case_id));
        const combined = new Set([...checkedIds, ...currentLinkIds]);

        let data = currentModalBaseData && currentModalBaseData.length > 0 
                   ? [...currentModalBaseData] // Clone array มาเพื่อไม่ให้กระทบตัวจริง
                   : Array.from(allTestCasesMap.values());

        if (modVal !== 'all') data = data.filter(tc => tc.module_group_id === modVal);
        if (subVal !== 'all') data = data.filter(tc => tc.module_subgroup === subVal);
        if (phaseVal && phaseVal !== 'all') data = data.filter(tc => String(tc.test_phase_id) === String(phaseVal));
        
        if (searchVal) {
            data = data.filter(tc => {
                return (tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchVal)) || 
                       (tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchVal));
            });
        }
        renderModalTable(data, combined);
    }

    function renderModalTable(testCases, checkedTestCaseIds) {
        if (testCases.length === 0) {
            modalBody.innerHTML = '<tr><td colspan="4" class="text-center p-3 text-muted">ไม่พบ Test Cases ที่ตรงกับเงื่อนไข</td></tr>';
            modalSelectAll.checked = false;
            return;
        }

        let html = '';
        let allVisibleAreChecked = true;

        testCases.forEach(tc => {
            const isChecked = checkedTestCaseIds.has(tc.test_case_id);
            if (!isChecked) allVisibleAreChecked = false;
            
            const rowClass = isChecked ? 'row-selected' : '';
            const groupId = tc.test_case_id;
            const scenarios = tc.scenarios || [];
            const rowSpan = Math.max(1, scenarios.length); 

            const checkboxCell = `<td class="text-center align-middle" rowspan="${rowSpan}"><input class="form-check-input modal-tc-checkbox" type="checkbox" data-test-case-id="${tc.test_case_id}" ${isChecked ? 'checked' : ''}></td>`;
            const moduleName = tc.module_name || 'N/A';
            const moduleCell = `<td class="align-middle" rowspan="${rowSpan}">${moduleName}</td>`;

            const tcName = tc.test_case_name || 'N/A';
            const tcCode = tc.test_id_code || 'N/A';
            const phaseName = tc.test_phase || ''; 
            let phaseBadgeHTML = '';
            if (phaseName && phaseName !== 'N/A') {
                let badgeClass = 'badge-phase-default';
                const p = phaseName.toUpperCase();
                if (p.includes('SIT')) badgeClass = 'badge-phase-sit';
                else if (p.includes('UAT')) badgeClass = 'badge-phase-uat';
                else if (p.includes('UNIT')) badgeClass = 'badge-phase-unit';
                phaseBadgeHTML = `<span class="badge ${badgeClass} me-1">${phaseName}</span>`;
            }
            const tcCodeBadge = `<span class="badge bg-info-subtle text-info-emphasis">${tcCode}</span>`;
            
            const testObjectiveCell = `<td class="align-middle" rowspan="${rowSpan}">
                <div class="d-flex align-items-start h-100">
                    <div class="d-flex align-items-center flex-shrink-0 me-2 mt-1">
                        ${phaseBadgeHTML}
                        ${tcCodeBadge}
                    </div>
                    <div class="text-break">
                        ${tcName}
                    </div>
                </div>
            </td>`;

            if (scenarios.length === 0) {
                html += `<tr class="${rowClass}" data-tc-group-id="${groupId}">${checkboxCell}${moduleCell}${testObjectiveCell}<td class="align-middle text-danger fst-italic">(ไม่มี Scenarios)</td></tr>`;
            } else {
                scenarios.forEach((sc, index) => {
                    html += `<tr class="${rowClass}" data-tc-group-id="${groupId}">`;
                    if (index === 0) { html += checkboxCell + moduleCell + testObjectiveCell; }
                    const scBadge = `<span class="badge bg-success-subtle text-success-emphasis">${sc.scenario_id_code || ''}</span>`;
                    html += `<td class="align-middle">${scBadge} ${sc.name || ''}</td></tr>`;
                });
            }
        });
        modalBody.innerHTML = html;
        modalSelectAll.checked = allVisibleAreChecked;
    }


    // --- 6. SAVE & UNLINK ---

    async function saveLinks() {
        const userId = modalLinkingIdInput.value;
        if (!userId) return;
        
        const spinner = saveLinksBtn.querySelector('.spinner-border');
        if (spinner) spinner.style.display = 'inline-block';
        saveLinksBtn.disabled = true;

        const selectedIds = [];
        modalBody.querySelectorAll('.modal-tc-checkbox:checked').forEach(cb => selectedIds.push(cb.dataset.testCaseId));
        
        const linksToInsert = selectedIds.map(tcId => ({ test_case_id: tcId }));

        try {
            const { error } = await supabaseClient.rpc('delete_and_insert_user_links', {
                p_user_id: userId,
                p_links: linksToInsert
            });
            if (error) throw error;
            linkScenarioModal.hide();
            await initializePage();
        } catch (err) {
            console.error(err);
            alert('Error saving: ' + err.message);
        } finally {
            if (spinner) spinner.style.display = 'none';
            saveLinksBtn.disabled = false;
        }
    }

    async function unlinkTestCase(userId, tcId, btn) {
        if (!confirm('ลบการจับคู่นี้?')) return;
        btn.disabled = true;
        try {
            const { error } = await supabaseClient
                .from('user_test_case_links')
                .delete()
                .match({ user_id: userId, test_case_id: tcId });
            if (error) throw error;
            await initializePage();
        } catch (err) {
            alert('Error: ' + err.message);
            btn.disabled = false;
        }
    }


    // --- 7. EVENT LISTENERS ---

    if (companyGroupFilter) companyGroupFilter.addEventListener('change', applyFiltersAndRender);
    if (moduleFilter) moduleFilter.addEventListener('change', applyFiltersAndRender);
    if (subModuleFilter) subModuleFilter.addEventListener('change', applyFiltersAndRender);
    
    if (phaseFilter) {
        phaseFilter.addEventListener('change', applyFiltersAndRender);
    }

    if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);

    if (usrdataContainer) {
        usrdataContainer.addEventListener('click', (e) => {
            const openBtn = e.target.closest('.open-link-modal-btn');
            if (openBtn) openLinkModal(openBtn.dataset.userId, openBtn.dataset.userName);

            const unlinkBtn = e.target.closest('.unlink-tc-btn');
            if (unlinkBtn) unlinkTestCase(unlinkBtn.dataset.userId, unlinkBtn.dataset.tcId, unlinkBtn);
        });
    }

    if (saveLinksBtn) saveLinksBtn.addEventListener('click', saveLinks);
    
    if (modalSelectAll) {
        modalSelectAll.addEventListener('change', () => {
            modalBody.querySelectorAll('.modal-tc-checkbox').forEach(checkbox => {
                checkbox.checked = modalSelectAll.checked;
            });
        });
    }
    
    if (modalBody) {
        modalBody.addEventListener('change', (event) => {
            if (event.target.classList.contains('modal-tc-checkbox')) {
                const checkbox = event.target;
                const groupId = checkbox.dataset.testCaseId;
                const isChecked = checkbox.checked;
                modalBody.querySelectorAll(`tr[data-tc-group-id="${groupId}"]`).forEach(row => {
                    row.classList.toggle('row-selected', isChecked);
                });
            }
        });
    }

    async function initializePage() {
        await Promise.all([fetchAndPopulateTestPhases()]);
        const loaded = await fetchPageData();
        if (loaded) {
            applyFiltersAndRender();
        }
    }

    initializePage();
});