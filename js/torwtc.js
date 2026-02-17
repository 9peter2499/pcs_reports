// =================================================================
// PCS Test Case - TORs & Test Cases Page Script
// (V5.1: Admin Mode Activated)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // 🔥 CONFIG: เปลี่ยนเป็น TRUE เพื่อเปิดโหมด Admin (เห็นปุ่ม + และ -)
    const isUserAdmin = true; 

    // รับค่า Group ID จาก URL (ถ้ามี)
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('group');

    // --- 1. GLOBAL VARIABLES & DOM ELEMENTS ---
    let allTorsData = []; 
    let allReportViewData = []; 
    let allTestCasesMap = new Map(); 
    let allModulesOptions = []; 
    let allSubModulesOptions = []; 
    
    let selectedTestCaseIdsInModal = new Set();

    const tordataContainer = document.getElementById('tordata-container');
    const moduleFilter = document.getElementById('module-filter'); 
    const searchInput = document.getElementById('search-input'); 
    
    // Modal Elements
    const linkScenarioModalEl = document.getElementById('linkScenarioModal');
    let linkScenarioModal = null;
    if (linkScenarioModalEl) {
        linkScenarioModal = new bootstrap.Modal(linkScenarioModalEl);
    }
    
    const modalTitle = document.getElementById('linkScenarioModalLabel');
    const modalBody = document.getElementById('modal-scenarios-tbody');
    const modalTorIdInput = document.getElementById('modal-linking-tor-id');
    const saveLinksBtn = document.getElementById('save-links-btn');
    const modalModuleFilter = document.getElementById('modal-module-filter');
    const modalSubModuleFilter = document.getElementById('modal-submodule-filter');
    const modalSearchInput = document.getElementById('modal-search-input');
    const modalSelectAll = document.getElementById('modal-select-all');


    // --- 2. DATA FETCHING ---

    async function fetchPageData() {
        if (tordataContainer) tordataContainer.innerHTML = '<p class="text-center p-5">กำลังโหลดข้อมูล...</p>';
        
        try {
            // 1. Fetch TORs
            let { data: tors, error: torError } = await supabaseClient
                .from('TORs')
                .select('tor_id, tor_name, Modules (module_id, module_name)')
                .order('tor_id');
            if (torError) throw new Error(`Failed to fetch TORs: ${torError.message}`);

            // 🔥 LOGIC FILTER: ถ้ามี Group ID ให้กรอง TOR เฉพาะที่เกี่ยวข้อง
            if (groupId) {
                const { data: allowedLinks, error: linkErr } = await supabaseClient
                    .from('stakeholder_tor_links')
                    .select('tor_id')
                    .eq('group_id', groupId);
                
                if (!linkErr && allowedLinks) {
                    const allowedIds = new Set(allowedLinks.map(l => l.tor_id));
                    tors = tors.filter(t => allowedIds.has(t.tor_id));
                }
            }

            // 2. Fetch Links
            const { data: linksData, error: linkError } = await supabaseClient
                .from('tor_test_case_links')
                .select('tor_id, test_case_id');
            if (linkError) throw new Error(`Failed to fetch links: ${linkError.message}`);

            // 3. Fetch View Data
            const { data: reportViewData, error: viewError } = await supabaseClient
                .from('test_case_report_view')
                .select('*');
            if (viewError) throw new Error(`Failed to fetch report view: ${viewError.message}`);
            allReportViewData = reportViewData || [];

            // 4. Fetch MasterOptions
            try {
                const { data: modules } = await supabaseClient.from('MasterOptions').select('option_id, option_label, display_order').eq('option_group', 'PCSMODULE').order('display_order');
                allModulesOptions = modules || [];
                const { data: submodules } = await supabaseClient.from('MasterOptions').select('option_id, option_label, option_relation').eq('option_group', 'PCSSUBMOD').order('display_order');
                allSubModulesOptions = submodules || [];
            } catch (e) { console.warn("Failed to load master options", e); }

            // 5. Group Data (View -> Map)
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

            // 6. Assemble links
            const linksMap = new Map();
            if (linksData) {
                linksData.forEach(link => {
                    if (!linksMap.has(link.tor_id)) {
                        linksMap.set(link.tor_id, []);
                    }
                    const fullTestCaseData = allTestCasesMap.get(link.test_case_id);
                    if (fullTestCaseData) {
                        linksMap.get(link.tor_id).push(fullTestCaseData);
                    }
                });
            }

            // 7. Final assembly
            allTorsData = tors.map(tor => ({
                tor_id: tor.tor_id,
                tor_name: tor.tor_name,
                module: tor.Modules, 
                linked_test_cases: linksMap.get(tor.tor_id) || []
            }));

            return true;

        } catch (error) {
            console.error('Error during page data fetch:', error);
            if (tordataContainer) tordataContainer.innerHTML = `<p class="text-danger p-5">${error.message}</p>`;
            return false;
        }
    }

    async function refreshDataOnly() {
        const scrollPos = window.scrollY;
        await fetchPageData(); 
        applyFiltersAndRender();
        window.scrollTo(0, scrollPos);
    }

    async function fetchAllTestCasesForModal() {
        if (allTestCasesMap.size > 0) return true;
        try {
            await fetchPageData();
            return allTestCasesMap.size > 0;
        } catch (e) { return false; }
    }

    async function fetchAndPopulateTestPhases() {
        const phaseFilterEl = document.getElementById('phase-filter');
        if (!phaseFilterEl) return;

        try {
            const { data: phases, error } = await supabaseClient
                .from('test_phases')
                .select('id, name')
                .order('name', { ascending: true });

            if (error) throw error;

            phaseFilterEl.innerHTML = '<option value="all" selected>ทุก Phase</option>';
            phases.forEach(phase => {
                const option = document.createElement('option');
                option.value = phase.id; 
                option.textContent = phase.name;
                phaseFilterEl.appendChild(option);
            });
        } catch (err) { console.error('Error fetching phases:', err); }
    }

    // --- 3. UI RENDERING ---

    function populateMainModuleFilter(tors) {
        const modules = new Map();
        tors.forEach(tor => {
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

    function renderData(tors, searchTerm = '', selectedPhase = 'all') {
        if (!tordataContainer) return;

        let html = `
            <table class="table table-bordered table-hover align-middle">
                <thead class="table-light text-center">
                    <tr>
                        <th style="width: 35%;">ข้อกำหนด (TOR)</th>
                        <th style="width: 15%;">Module</th> 
                        <th style="width: 20%;">Test Objective</th>
                        <th style="width: 25%;">Test Name (Scenario)</th>
                        <th style="width: 5%;">Action</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (!tors || tors.length === 0) {
            html += `<tr><td colspan="5" class="text-center p-4 text-muted">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
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
                
                // ✅ LOGIC: แสดงปุ่ม (+) เฉพาะ Admin
                let linkScenariosButton = '';
                if (isUserAdmin) {
                    linkScenariosButton = `
                        <button class="btn btn-sm btn-link p-0 open-link-modal-btn float-end" 
                                data-tor-id="${tor.tor_id}" 
                                data-tor-name="${tor.tor_name}"
                                title="จับคู่ Test Scenario">
                            <i class="bi bi-plus-circle fs-5 text-primary"></i>
                        </button>`;
                }
                
                const torDisplay = `<div class="d-flex justify-content-between align-items-start h-100">
                                        <div class="text-break">${torNameWithBadge}</div>
                                        ${linkScenariosButton}
                                    </div>`;

                if (visibleTestCases.length === 0) {
                    html += `
                        <tr class="tor-row">
                            <td class="ps-3" style="vertical-align: top;">${torDisplay}</td>
                            <td colspan="4" class="text-center text-muted fst-italic p-3">
                                <span class="opacity-50"><i class="bi bi-link-45deg"></i> ยังไม่มี Test Scenario ที่ผูกไว้ หรือ ไม่ตรงกับคำค้นหา</span>
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
                            phaseBadgeHTML = `<span class="badge ${badgeClass} me-1">${phaseName}</span>`;
                        }

                        const tcIdBadge = tcCode ? `<span class="badge bg-info-subtle text-primary-emphasis me-1">${tcCode}</span>` : '';
                        const tcContent = `<div class="text-break">${phaseBadgeHTML}${tcIdBadge} <span class="ms-1">${tcName}</span></div>`;

                        // ✅ LOGIC: แสดงปุ่ม (-) เฉพาะ Admin
                        let unlinkButton = '';
                        if (isUserAdmin) {
                            unlinkButton = `
                                <button class="btn btn-sm btn-link text-danger p-0 unlink-tc-btn"
                                        data-tor-id="${tor.tor_id}"
                                        data-tc-id="${tc.test_case_id}" 
                                        title="นำ Test Objective นี้ออก">
                                    <i class="bi bi-dash-circle fs-5"></i>
                                </button>`;
                        }

                        const tcRowSpan = Math.max(1, scenarios.length);

                        if (scenarios.length === 0) {
                            html += `<tr class="scenario-row">`;
                            if (isFirstRowOfTor) {
                                html += `<td class="ps-3" rowspan="${totalTorRowSpan}" style="vertical-align: top;">${torDisplay}</td>`;
                                isFirstRowOfTor = false;
                            }
                            html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${moduleName}</td>`;
                            html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${tcContent}</td>`; 
                            html += `<td class="text-muted fst-italic opacity-50 text-center">- No Scenario -</td>`;
                            html += `<td class="text-center" rowspan="${tcRowSpan}">${unlinkButton}</td>`;
                            html += `</tr>`;
                        } else {
                            scenarios.forEach((sc, index) => {
                                html += `<tr class="scenario-row">`;
                                if (isFirstRowOfTor) {
                                    html += `<td class="ps-3" rowspan="${totalTorRowSpan}" style="vertical-align: top;">${torDisplay}</td>`;
                                    isFirstRowOfTor = false;
                                }
                                if (index === 0) {
                                    html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${moduleName}</td>`;
                                    html += `<td rowspan="${tcRowSpan}" style="vertical-align: top;">${tcContent}</td>`; 
                                }

                                const scName = sc.name || '-';
                                const scCodeStr = sc.scenario_id_code || '';
                                const scBadge = scCodeStr ? `<span class="badge bg-success-subtle text-success-emphasis me-1">${scCodeStr}</span>` : '';
                                const scType = sc.scenario_type ? `<span class="fw-light fst-italic text-secondary ms-1" style="font-size:11px;">[ ${sc.scenario_type} ]</span>` : '';

                                // Link ไป Detail (ส่ง Group ID ไปด้วย)
                                const nextLink = `/scendt.html?sc_id=${sc.id}${groupId ? '&group=' + groupId : ''}`;

                                const scenarioDisplay = `
                                    <a href="${nextLink}" class="text-decoration-none d-block text-start text-dark icon-link icon-link-hover" title="View Details">
                                        <i class="bi bi-box-arrow-up-right text-muted small me-1" style="font-size: 0.75rem;"></i>
                                        ${scBadge}${scName} ${scType}
                                    </a>`;

                                html += `<td>${scenarioDisplay}</td>`;

                                if (index === 0) {
                                    html += `<td class="text-center" rowspan="${tcRowSpan}" style="vertical-align: top;">${unlinkButton}</td>`;
                                }
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

    // --- 4. FILTERING & BACK BUTTON ---
    
    function setupBackButton() {
        if (!groupId) return;

        const filterContainer = moduleFilter.closest('.d-flex') || moduleFilter.parentElement;
        if (filterContainer) {
            // เช็คว่ามีปุ่มอยู่แล้วหรือยัง
            if (document.getElementById('stakeholder-back-btn')) return;

            const backBtn = document.createElement('button');
            backBtn.id = 'stakeholder-back-btn';
            backBtn.className = 'btn btn-outline-primary me-3 mb-3 mb-md-0';
            backBtn.innerHTML = '<i class="bi bi-arrow-left me-1"></i> Back to Stakeholder';
            backBtn.onclick = () => {
                window.location.href = `/stakeholder-detail.html?id=${groupId}`;
            };
            filterContainer.insertBefore(backBtn, filterContainer.firstChild);
        }
    }

    function loadAndApplyFilterState() {
        try {
            const savedFilters = sessionStorage.getItem('torwtcFilters');
            if (!savedFilters) return;
            const filters = JSON.parse(savedFilters);
            if (filters.module && moduleFilter) moduleFilter.value = filters.module;
            if (filters.search && searchInput) searchInput.value = filters.search;
            if (filters.phase && document.getElementById('phase-filter')) document.getElementById('phase-filter').value = filters.phase;
        } catch (e) { sessionStorage.removeItem('torwtcFilters'); }
    }

    function applyFiltersAndRender() {
        const selectedModule = moduleFilter.value;
        const selectedPhase = document.getElementById('phase-filter') ? document.getElementById('phase-filter').value : 'all';
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        try {
            const filterState = { module: selectedModule, search: searchInput.value, phase: selectedPhase };
            sessionStorage.setItem('torwtcFilters', JSON.stringify(filterState));
        } catch (e) {}

        let filteredData = allTorsData;

        if (selectedModule !== 'all') {
            filteredData = filteredData.filter(tor => {
                const mod = tor.module || tor.Modules;
                return mod && mod.module_id === selectedModule;
            });
        }

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

        if (selectedPhase !== 'all') {
            filteredData = filteredData.filter(tor => {
                if (!tor.linked_test_cases) return false;
                return tor.linked_test_cases.some(tc => String(tc.test_phase_id) === String(selectedPhase));
            });
        }

        renderData(filteredData, searchTerm, selectedPhase);
    }

    // --- 5. MODAL LOGIC (Standard Functions) ---
    async function openLinkModal(torId, torName) {
        if (!linkScenarioModal) return;
        modalTitle.textContent = `จับคู่ Test Objective กับ TOR: ${torName}`;
        modalTorIdInput.value = torId;
        populateModalFilters(); 
        const mainPhaseFilter = document.getElementById('phase-filter');
        const modalPhaseFilter = document.getElementById('modal-phase-filter');
        if (mainPhaseFilter && modalPhaseFilter) {
            modalPhaseFilter.innerHTML = mainPhaseFilter.innerHTML; 
            modalPhaseFilter.value = 'all'; 
        }
        const ready = await fetchAllTestCasesForModal();
        if (!ready) {
            modalBody.innerHTML = '<tr><td colspan="4" class="text-danger p-5">Failed to load test cases for modal.</td></tr>';
            return;
        }
        const currentLinks = allTorsData.find(t => t.tor_id === torId)?.linked_test_cases || [];
        selectedTestCaseIdsInModal = new Set(currentLinks.map(tc => tc.test_case_id));
        modalModuleFilter.value = 'all';
        modalSubModuleFilter.value = 'all';
        modalSubModuleFilter.disabled = true;
        modalSearchInput.value = '';
        renderModalTable(Array.from(allTestCasesMap.values()), selectedTestCaseIdsInModal);
        linkScenarioModal.show();
    }

    function populateModalFilters() {
        modalModuleFilter.innerHTML = '<option value="all" selected>ทุก Module หลัก</option>';
        allModulesOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.option_id; option.textContent = opt.option_label;
            modalModuleFilter.appendChild(option);
        });
        const modalPhaseFilter = document.getElementById('modal-phase-filter');
        if (modalPhaseFilter) modalPhaseFilter.onchange = applyModalFilters;
        
        modalModuleFilter.onchange = () => {
            const selectedModuleGroupId = modalModuleFilter.value;
            modalSubModuleFilter.innerHTML = '<option value="all" selected>ทุก Sub Module</option>';
            if (selectedModuleGroupId === 'all') { modalSubModuleFilter.disabled = true; } else {
                modalSubModuleFilter.disabled = false;
                const relevantSubModules = allSubModulesOptions.filter(sub => sub.option_relation === selectedModuleGroupId);
                relevantSubModules.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.option_id; option.textContent = opt.option_label;
                    modalSubModuleFilter.appendChild(option);
                });
            }
            applyModalFilters();
        };
        modalSubModuleFilter.onchange = applyModalFilters;
        modalSearchInput.oninput = applyModalFilters;
    }

    function applyModalFilters() {
        const selectedModuleGroupId = modalModuleFilter.value;
        const selectedSubModuleCode = modalSubModuleFilter.value;
        const searchTerm = modalSearchInput.value.toLowerCase().trim();
        const selectedPhase = document.getElementById('modal-phase-filter').value;
        let filteredData = Array.from(allTestCasesMap.values());
        if (selectedModuleGroupId !== 'all') filteredData = filteredData.filter(tc => tc.module_group_id === selectedModuleGroupId);
        if (selectedSubModuleCode !== 'all') filteredData = filteredData.filter(tc => tc.module_subgroup === selectedSubModuleCode);
        if (selectedPhase && selectedPhase !== 'all') filteredData = filteredData.filter(tc => String(tc.test_phase_id) === String(selectedPhase));
        if (searchTerm) filteredData = filteredData.filter(tc => {
            const nameMatch = tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchTerm);
            const codeMatch = tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchTerm);
            return nameMatch || codeMatch;
        });
        renderModalTable(filteredData, selectedTestCaseIdsInModal);
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
            const moduleCell = `<td class="align-middle" rowspan="${rowSpan}">${tc.module_name || 'N/A'}</td>`;
            
            const phaseName = tc.test_phase || ''; 
            let phaseBadgeHTML = '';
            if (phaseName && phaseName !== 'N/A') {
                let badgeClass = 'badge-phase-default';
                const p = phaseName.toUpperCase();
                if (p.includes('SIT')) badgeClass = 'badge-phase-sit';
                else if (p.includes('UAT')) badgeClass = 'badge-phase-uat';
                phaseBadgeHTML = `<span class="badge ${badgeClass} me-1">${phaseName}</span>`;
            }
            const tcCodeBadge = `<span class="badge bg-info-subtle text-info-emphasis">${tc.test_id_code || 'N/A'}</span>`;
            const testObjectiveCell = `<td class="align-middle" rowspan="${rowSpan}"><div class="d-flex align-items-start h-100"><div class="d-flex align-items-center flex-shrink-0 me-2 mt-1">${phaseBadgeHTML}${tcCodeBadge}</div><div class="text-break">${tc.test_case_name || 'N/A'}</div></div></td>`;
            
            if (scenarios.length === 0) {
                html += `<tr class="${rowClass}" data-tc-group-id="${groupId}">` + checkboxCell + moduleCell + testObjectiveCell + `<td class="align-middle text-danger fst-italic">(ไม่มี Scenarios)</td></tr>`;
            } else {
                scenarios.forEach((sc, index) => {
                    html += `<tr class="${rowClass}" data-tc-group-id="${groupId}">`;
                    if (index === 0) html += checkboxCell + moduleCell + testObjectiveCell;
                    const scBadge = `<span class="badge bg-success-subtle text-success-emphasis">${sc.scenario_id_code || 'N/A'}</span>`;
                    html += `<td class="align-middle">${scBadge} ${sc.name || 'N/A'} </td></tr>`;
                });
            }
        });
        modalBody.innerHTML = html;
        modalSelectAll.checked = allVisibleAreChecked;
    }
    
    async function saveLinks() {
        const torId = modalTorIdInput.value;
        if (!torId) return;
        setSaveButtonLoading(true);
        const linksToInsert = Array.from(selectedTestCaseIdsInModal).map(tcId => ({ test_case_id: tcId }));
        try {
            const { error } = await supabaseClient.rpc('delete_and_insert_tc_links', { p_tor_id: torId, p_links: linksToInsert });
            if (error) throw error;
            if (linkScenarioModal) linkScenarioModal.hide();
            await refreshDataOnly(); 
        } catch (error) { console.error('Error saving links:', error); alert(`เกิดข้อผิดพลาดในการบันทึก: ${error.message}`); } finally { setSaveButtonLoading(false); }
    }

    function setSaveButtonLoading(isLoading) {
        const spinner = saveLinksBtn.querySelector('.spinner-border');
        if (isLoading) { saveLinksBtn.disabled = true; if (spinner) spinner.style.display = 'inline-block'; } 
        else { saveLinksBtn.disabled = false; if (spinner) spinner.style.display = 'none'; }
    }

    async function unlinkTestCase(torId, testCaseId, buttonElement) {
        if (!confirm('คุณต้องการนำ Test Objective นี้ออกจาก TOR ใช่หรือไม่?')) return;
        buttonElement.disabled = true;
        try {
            const { error } = await supabaseClient.from('tor_test_case_links').delete().match({ tor_id: torId, test_case_id: testCaseId });
            if (error) throw error;
            await refreshDataOnly(); 
        } catch (error) { console.error('Error unlinking test case:', error); alert(`เกิดข้อผิดพลาดในการลบ: ${error.message}`); buttonElement.disabled = false; }
    }

    // --- 6. EVENT LISTENERS ---

    moduleFilter.addEventListener('change', applyFiltersAndRender);
    searchInput.addEventListener('input', applyFiltersAndRender);

    const phaseFilter = document.getElementById('phase-filter');
    if (phaseFilter) phaseFilter.addEventListener('change', applyFiltersAndRender);

    tordataContainer.addEventListener('click', (event) => {
        const openModalBtn = event.target.closest('.open-link-modal-btn');
        if (openModalBtn) openLinkModal(openModalBtn.dataset.torId, openModalBtn.dataset.torName);
        const unlinkBtn = event.target.closest('.unlink-tc-btn');
        if (unlinkBtn) unlinkTestCase(unlinkBtn.dataset.torId, unlinkBtn.dataset.tcId, unlinkBtn);
    });

    saveLinksBtn.addEventListener('click', saveLinks);
    modalSelectAll.addEventListener('change', () => {
        modalBody.querySelectorAll('.modal-tc-checkbox').forEach(checkbox => {
            checkbox.checked = modalSelectAll.checked;
            const tcId = checkbox.dataset.testCaseId;
            if (checkbox.checked) selectedTestCaseIdsInModal.add(tcId); else selectedTestCaseIdsInModal.delete(tcId);
            const rowsInGroup = modalBody.querySelectorAll(`tr[data-tc-group-id="${tcId}"]`);
            rowsInGroup.forEach(row => row.classList.toggle('row-selected', checkbox.checked));
        });
    });

    modalBody.addEventListener('change', (event) => {
        if (event.target.classList.contains('modal-tc-checkbox')) {
            const checkbox = event.target;
            const tcId = checkbox.dataset.testCaseId;
            const isChecked = checkbox.checked;
            if (isChecked) selectedTestCaseIdsInModal.add(tcId); else selectedTestCaseIdsInModal.delete(tcId);
            const rowsInGroup = modalBody.querySelectorAll(`tr[data-tc-group-id="${tcId}"]`);
            rowsInGroup.forEach(row => row.classList.toggle('row-selected', isChecked));
        }
    });

    // --- 7. INITIALIZATION ---

    async function initializePage() {
        await Promise.all([ fetchAndPopulateTestPhases() ]);
        const dataLoaded = await fetchPageData(); 
        if (dataLoaded) {
            setupBackButton(); // สร้างปุ่ม Back (ถ้ามี group id)
            populateMainModuleFilter(allTorsData); 
            loadAndApplyFilterState(); 
            applyFiltersAndRender(); 
        }
    }

    initializePage();
});