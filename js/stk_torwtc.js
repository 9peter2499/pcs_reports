// =================================================================
// PCS Test Case - Stakeholder View Script (User Only)
// File: js/stk_torwtc.js
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // รับค่า Group ID และ Module ID จาก URL
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('group');
    const urlModuleId = urlParams.get('module'); // 🔥 รับค่า Module ID

    // --- 1. GLOBAL VARIABLES ---
    let allTorsData = []; 
    let allReportViewData = []; 
    let allTestCasesMap = new Map(); 
    let allModulesOptions = []; 

    const tordataContainer = document.getElementById('tordata-container');
    const moduleFilter = document.getElementById('module-filter'); 
    const searchInput = document.getElementById('search-input'); 
    const backBtn = document.getElementById('btn-back-stakeholder');

    // --- 2. DATA FETCHING ---

    async function fetchPageData() {
        tordataContainer.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">กำลังโหลดข้อมูล...</p></div>';
        
        try {
            // 1. Fetch TORs
            let { data: tors, error: torError } = await supabaseClient
                .from('TORs')
                .select('tor_id, tor_name, Modules (module_id, module_name)')
                .eq('module_id', urlModuleId) // 🔥 เพิ่ม Filter ตรงนี้เลยเพื่อความเร็ว
                .order('tor_id');
            
            if (torError) throw new Error(torError.message);

            // 🔥 LOGIC DUAL MODE:
            if (groupId) {
                // [MODE 1] มี Group ID -> กรองเฉพาะที่กลุ่มนี้เกี่ยว
                console.log("Mode: Stakeholder Filtered (Group ID provided)");
                const { data: allowedLinks, error: linkErr } = await supabaseClient
                    .from('stakeholder_tor_links')
                    .select('tor_id')
                    .eq('group_id', groupId);
                
                if (!linkErr && allowedLinks) {
                    const allowedIds = new Set(allowedLinks.map(l => l.tor_id));
                    tors = tors.filter(t => allowedIds.has(t.tor_id));
                } else {
                    tors = [];
                }
            } else {
                // [MODE 2] ไม่มี Group ID -> แสดงทั้งหมด (Overview Mode)
                console.log("Mode: Module Overview (No Group ID) - Showing ALL");
                // ไม่ต้องทำอะไร ปล่อย tors ผ่านไปได้เลย
            }

            // 2. Fetch Links
            const { data: linksData } = await supabaseClient
                .from('tor_test_case_links')
                .select('tor_id, test_case_id');

            // 3. Fetch View Data
            const { data: reportViewData } = await supabaseClient
                .from('test_case_report_view')
                .select('*');
            allReportViewData = reportViewData || [];

            // 4. Fetch Modules
            try {
                const { data: modules } = await supabaseClient.from('MasterOptions').select('option_id, option_label, display_order').eq('option_group', 'PCSMODULE').order('display_order');
                allModulesOptions = modules || [];
            } catch (e) {}

            // 5. Group Data Logic
            allTestCasesMap.clear();
            for (const row of allReportViewData) {
                if (!row.test_case_id) continue;
                if (!allTestCasesMap.has(row.test_case_id)) {
                    allTestCasesMap.set(row.test_case_id, {
                        test_case_id: row.test_case_id,
                        test_id_code: row.test_id_code,
                        test_case_name: row.test_case_name,
                        module_name: row.module_name,
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

            // 6. Assemble
            const linksMap = new Map();
            if (linksData) {
                linksData.forEach(link => {
                    if (!linksMap.has(link.tor_id)) linksMap.set(link.tor_id, []);
                    const fullTestCaseData = allTestCasesMap.get(link.test_case_id);
                    if (fullTestCaseData) linksMap.get(link.tor_id).push(fullTestCaseData);
                });
            }

            allTorsData = tors.map(tor => ({
                tor_id: tor.tor_id,
                tor_name: tor.tor_name,
                module: tor.Modules, 
                linked_test_cases: linksMap.get(tor.tor_id) || []
            }));

            return true;

        } catch (error) {
            console.error(error);
            tordataContainer.innerHTML = `<div class="alert alert-danger m-4">Error loading data: ${error.message}</div>`;
            return false;
        }
    }

    // --- 3. UI RENDERING ---

    function renderData(tors, searchTerm = '', selectedPhase = 'all') {
        if (!tordataContainer) return;

        let html = `
            <table class="table table-bordered table-hover align-middle shadow-sm">
                <thead class="table-light text-center">
                    <tr>
                        <th style="width: 35%;">ข้อกำหนด (TOR)</th>
                        <th style="width: 15%;">Module</th> 
                        <th style="width: 25%;">Test Objective</th>
                        <th style="width: 25%;">Test Name (Scenario)</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (!tors || tors.length === 0) {
            html += `<tr><td colspan="4" class="text-center p-5 text-muted fst-italic">
                <i class="bi bi-search display-6 d-block mb-3 opacity-50"></i>
                ไม่พบข้อมูลที่ตรงกับเงื่อนไข
            </td></tr>`;
        } else {
            tors.forEach((tor) => {
                const isTorMatch = searchTerm === '' || (tor.tor_name && tor.tor_name.toLowerCase().includes(searchTerm));
                let visibleTestCases = tor.linked_test_cases || [];

                visibleTestCases = visibleTestCases.filter(tc => {
                    const nameMatch = tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchTerm);
                    const codeMatch = tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchTerm);
                    const isPhaseMatch = (selectedPhase === 'all') || (String(tc.test_phase_id) === String(selectedPhase));
                    if (isTorMatch) return isPhaseMatch; 
                    else return (nameMatch || codeMatch) && isPhaseMatch;
                });
                
                if (visibleTestCases.length === 0 && !isTorMatch) return;

                const torNameWithBadge = tor.tor_name.replace(/^([\d\.]+)\s/, `<span class="badge bg-primary-subtle text-primary-emphasis fs-6 me-2">$1</span>`);
                const torDisplay = `<div class="text-break fw-medium">${torNameWithBadge}</div>`;

                if (visibleTestCases.length === 0) {
                    html += `
                        <tr class="tor-row bg-light">
                            <td class="ps-3" style="vertical-align: top;">${torDisplay}</td>
                            <td colspan="3" class="text-center text-muted fst-italic p-3">
                                <span class="opacity-50">ยังไม่มี Test Scenario</span>
                            </td>
                        </tr>`;
                } else {
                    const totalTorRowSpan = visibleTestCases.reduce((sum, tc) => sum + Math.max(1, (tc.scenarios ? tc.scenarios.length : 0)), 0);
                    let isFirstRowOfTor = true;

                    visibleTestCases.forEach(tc => {
                        const moduleName = tc.module_name || '-';
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
                            phaseBadgeHTML = `<span class="badge ${badgeClass} me-1" style="font-size: 0.7em;">${phaseName}</span>`;
                        }

                        const tcIdBadge = tcCode ? `<span class="badge bg-info-subtle text-primary-emphasis me-1" style="font-size: 0.75em;">${tcCode}</span>` : '';
                        const tcContent = `<div class="text-break">${phaseBadgeHTML}${tcIdBadge} <span class="ms-1">${tcName}</span></div>`;

                        const tcRowSpan = Math.max(1, scenarios.length);

                        if (scenarios.length === 0) {
                            html += `<tr class="scenario-row">`;
                            if (isFirstRowOfTor) {
                                html += `<td class="ps-3 bg-white" rowspan="${totalTorRowSpan}" style="vertical-align: top;">${torDisplay}</td>`;
                                isFirstRowOfTor = false;
                            }
                            html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${moduleName}</td>`;
                            html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${tcContent}</td>`; 
                            html += `<td class="text-muted fst-italic opacity-50 text-center">- No Scenario -</td>`;
                            html += `</tr>`;
                        } else {
                            scenarios.forEach((sc, index) => {
                                html += `<tr class="scenario-row">`;
                                if (isFirstRowOfTor) {
                                    html += `<td class="ps-3 bg-white" rowspan="${totalTorRowSpan}" style="vertical-align: top;">${torDisplay}</td>`;
                                    isFirstRowOfTor = false;
                                }
                                if (index === 0) {
                                    html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${moduleName}</td>`;
                                    html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${tcContent}</td>`; 
                                }

                                const scName = sc.name || '-';
                                const scCodeStr = sc.scenario_id_code || '';
                                const scBadge = scCodeStr ? `<span class="badge bg-success-subtle text-success-emphasis me-1" style="font-size: 0.75em;">${scCodeStr}</span>` : '';
                                const scType = sc.scenario_type ? `<span class="fw-light fst-italic text-secondary ms-1" style="font-size:10px;">[${sc.scenario_type}]</span>` : '';

                                // Link ไป Detail (User View)
                                const nextLink = `/stk_scendt.html?sc_id=${sc.id}${groupId ? '&group=' + groupId : ''}`;

                                const scenarioDisplay = `
                                    <a href="${nextLink}" class="text-decoration-none d-block text-start text-dark icon-link icon-link-hover py-1" title="คลิกเพื่อดูรายละเอียด">
                                        <i class="bi bi-box-arrow-up-right text-muted small me-2"></i>
                                        ${scBadge}${scName} ${scType}
                                    </a>`;

                                html += `<td>${scenarioDisplay}</td>`;
                                html += `</tr>`;
                            });
                        }
                    });
                }
            });
        }
        html += `</tbody></table>`;
        tordataContainer.innerHTML = html;
    }

    // --- 4. SETUP UI & EVENTS ---

    function setupBackButton() {
        if (!backBtn) return; // ตัดเงื่อนไข !groupId ออก เพราะโหมด Overview ไม่มี group
        
        const urlParams = new URLSearchParams(window.location.search);
        const fromPage = urlParams.get('from');

        backBtn.onclick = () => {
            if (fromPage === 'module') {
                window.location.href = `/modules.html`; // กลับไปหน้า Module Dashboard
            } else if (groupId) {
                window.location.href = `/stakeholder-detail.html?id=${groupId}`;
            } else {
                history.back(); // กันเหนียว
            }
        };
        backBtn.style.display = 'inline-block';
    }

    function populateMainModuleFilter(tors) {
        const modules = new Map();
        tors.forEach(tor => {
            // เช็คทั้ง module (ใหม่) และ Modules (เก่า) เพื่อความชัวร์
            const mod = tor.module || tor.Modules;
            if (mod && mod.module_id) {
                modules.set(mod.module_id, mod.module_name);
            }
        });

        if (moduleFilter) {
            moduleFilter.innerHTML = '<option value="all" selected>แสดงทุก Module</option>';
            const sortedModules = new Map([...modules.entries()].sort((a, b) => a[0].localeCompare(b[0])));
            sortedModules.forEach((name, id) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                moduleFilter.appendChild(option);
            });
        }
    }

    async function fetchAndPopulateTestPhases() {
        const phaseFilterEl = document.getElementById('phase-filter');
        if (!phaseFilterEl) return;
        try {
            const { data: phases } = await supabaseClient.from('test_phases').select('id, name').order('name');
            phaseFilterEl.innerHTML = '<option value="all" selected>ทุก Phase</option>';
            if(phases) phases.forEach(phase => {
                const option = document.createElement('option');
                option.value = phase.id; option.textContent = phase.name;
                phaseFilterEl.appendChild(option);
            });
        } catch (err) {}
    }

    // 🔥 LOGIC FILTER: ให้ความสำคัญกับ URL Parameter > Session Storage
    function loadAndApplyFilterState() {
        // 1. ถ้ามี URL Param (Module) ให้ใช้ตัวนั้นก่อนเลย (Override ทุกอย่าง)
        if (urlModuleId && moduleFilter) {
            moduleFilter.value = urlModuleId;
            return; // จบการทำงาน ไม่ต้องไปโหลด Session
        }

        // 2. ถ้าไม่มี URL Param ค่อยไปดู Session Storage
        try {
            const savedFilters = sessionStorage.getItem('stkTorFilters'); // แยกชื่อ Session key กัน Admin
            if (!savedFilters) return;
            const filters = JSON.parse(savedFilters);
            
            if (filters.module && moduleFilter) moduleFilter.value = filters.module;
            if (filters.search && searchInput) searchInput.value = filters.search;
            if (filters.phase && document.getElementById('phase-filter')) {
                document.getElementById('phase-filter').value = filters.phase;
            }
        } catch (e) { 
            sessionStorage.removeItem('stkTorFilters'); 
        }
    }

    function applyFiltersAndRender() {
        const selectedModule = moduleFilter.value;
        const selectedPhase = document.getElementById('phase-filter') ? document.getElementById('phase-filter').value : 'all';
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        // Save state (แยก key กับ Admin เพื่อไม่ให้ตีกัน)
        try {
            const filterState = { module: selectedModule, search: searchInput.value, phase: selectedPhase };
            sessionStorage.setItem('stkTorFilters', JSON.stringify(filterState));
        } catch (e) {}

        let filteredData = allTorsData;

        // 1. Module Filter
        if (selectedModule !== 'all') {
            filteredData = filteredData.filter(tor => {
                const mod = tor.module || tor.Modules;
                return mod && mod.module_id === selectedModule;
            });
        }

        // 2. Search Filter
        if (searchTerm) {
            filteredData = filteredData.filter(tor => {
                const isTorMatch = tor.tor_name && tor.tor_name.toLowerCase().includes(searchTerm);
                const hasChildMatch = tor.linked_test_cases && tor.linked_test_cases.some(tc => {
                    const nameMatch = tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchTerm);
                    const codeMatch = tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchTerm);
                    return nameMatch || codeMatch;
                });
                return isTorMatch || hasChildMatch;
            });
        }

        // 3. Phase Filter
        if (selectedPhase !== 'all') {
            filteredData = filteredData.filter(tor => {
                if (!tor.linked_test_cases) return false;
                return tor.linked_test_cases.some(tc => String(tc.test_phase_id) === String(selectedPhase));
            });
        }

        renderData(filteredData, searchTerm, selectedPhase);
    }

    // --- Events ---
    moduleFilter.addEventListener('change', applyFiltersAndRender);
    searchInput.addEventListener('input', applyFiltersAndRender);
    const phaseFilter = document.getElementById('phase-filter');
    if (phaseFilter) phaseFilter.addEventListener('change', applyFiltersAndRender);

    // --- INIT ---
    async function initializePage() {
        await fetchAndPopulateTestPhases();
        const dataLoaded = await fetchPageData(); 
        
        if (dataLoaded) {
            setupBackButton(); 
            populateMainModuleFilter(allTorsData); // สร้างตัวเลือกใน Dropdown ให้ครบก่อน
            
            loadAndApplyFilterState(); // 🔥 ตั้งค่า Filter ตาม URL หรือ Session
            applyFiltersAndRender(); // วาดตารางตาม Filter นั้น
        }
    }

    initializePage();
});