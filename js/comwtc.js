// =================================================================
// PCS Test Case - Company & Test Cases Page Script (comwtc.js)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL VARIABLES & DOM ELEMENTS ---
    let allCompaniesData = []; 
    let allReportViewData = []; 
    let allTestCasesMap = new Map(); 
    
    let allModulesOptions = []; 
    let allSubModulesOptions = []; 
    let allCompanyGroupOptions = []; 

    // DOM Elements
    const comdataContainer = document.getElementById('comdata-container');
    const companyGroupFilter = document.getElementById('company-group-filter'); 
    const moduleFilter = document.getElementById('main-module-filter'); 
    const subModuleFilter = document.getElementById('sub-module-filter');
    const searchInput = document.getElementById('search-input'); 
    const phaseFilter = document.getElementById('phase-filter'); // (ถ้ามีใน HTML)

    // Modal Elements
    const linkScenarioModalEl = document.getElementById('linkScenarioModal');
    const linkScenarioModal = new bootstrap.Modal(linkScenarioModalEl);
    const modalTitle = document.getElementById('linkScenarioModalLabel');
    const modalBody = document.getElementById('modal-scenarios-tbody');
    const modalLinkingIdInput = document.getElementById('modal-linking-company-id'); 
    const saveLinksBtn = document.getElementById('save-links-btn');
    
    // Modal Filter Elements
    const modalModuleFilter = document.getElementById('modal-module-filter');
    const modalSubModuleFilter = document.getElementById('modal-submodule-filter');
    const modalSearchInput = document.getElementById('modal-search-input');
    const modalSelectAll = document.getElementById('modal-select-all');
    const modalPhaseFilter = document.getElementById('modal-phase-filter');


    // --- 2. DATA FETCHING ---

    async function fetchPageData() {
        comdataContainer.innerHTML = '<p class="text-center p-5">กำลังโหลดข้อมูล...</p>';
        
        try {
            // 1. Fetch Companies
            const { data: companies, error: comError } = await supabaseClient
                .from('company')
                .select('company_id, company_name, company_group, company_subgroup')
                .order('company_id');
            if (comError) throw new Error(`Failed to fetch Companies: ${comError.message}`);

            // 2. Fetch Links
            const { data: linksData, error: linkError } = await supabaseClient
                .from('company_test_case_links')
                .select('company_id, test_case_id');
            if (linkError) throw new Error(`Failed to fetch links: ${linkError.message}`);

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
            assembleCompanyData(companies, linksData);

            // 6. Populate UI
            populateMainFilters();
            
            return true;

        } catch (error) {
            console.error('Error fetchPageData:', error);
            comdataContainer.innerHTML = `<p class="text-danger p-5">${error.message}</p>`;
            return false;
        }
    }

    async function fetchMasterOptions() {
        try {
            const { data: modules } = await supabaseClient.from('MasterOptions').select('option_id, option_label, display_order').eq('option_group', 'PCSMODULE').order('display_order');
            allModulesOptions = modules || [];
            
            const { data: submodules } = await supabaseClient.from('MasterOptions').select('option_id, option_label, option_relation').eq('option_group', 'PCSSUBMOD').order('display_order');
            allSubModulesOptions = submodules || [];

            // ดึงข้อมูลกลุ่มบริษัท (COMGRP)
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

    function assembleCompanyData(companies, linksData) {
        const linksMap = new Map();
        if (linksData) {
            linksData.forEach(link => {
                if (!linksMap.has(link.company_id)) {
                    linksMap.set(link.company_id, []);
                }
                const fullTestCaseData = allTestCasesMap.get(link.test_case_id);
                if (fullTestCaseData) {
                    linksMap.get(link.company_id).push(fullTestCaseData);
                }
            });
        }
        allCompaniesData = companies.map(com => ({
            company_id: com.company_id,
            company_name: com.company_name,
            company_group: com.company_group, 
            linked_test_cases: linksMap.get(com.company_id) || []
        }));
    }


    // --- 3. UI & FILTERING ---

    async function fetchAndPopulateTestPhases() {
        if (!phaseFilter) return; // ถ้าไม่มี Dropdown ใน HTML ก็ข้ามไป
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

            // Logic Sub Module (เมื่อเปลี่ยน Main Module)
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
        // รับค่าจาก UI
        const selectedGroup = companyGroupFilter ? companyGroupFilter.value : 'all';
        const selectedModule = moduleFilter ? moduleFilter.value : 'all';
        const selectedSubModule = subModuleFilter ? subModuleFilter.value : 'all'; 
        const selectedPhase = phaseFilter ? phaseFilter.value : 'all';
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let filteredData = allCompaniesData;

        // 1. กรอง Company Group (แม่)
        if (selectedGroup && selectedGroup !== 'all') {
            filteredData = filteredData.filter(c => c.company_group === selectedGroup);
        }

        // 2. กรอง Module (เช็คว่ามีลูกอยู่ใน Module นี้ไหม)
        if (selectedModule && selectedModule !== 'all') {
            filteredData = filteredData.filter(com => {
                if (!com.linked_test_cases) return false;
                return com.linked_test_cases.some(tc => tc.module_group_id === selectedModule);
            });
        }

        // 3. กรอง Sub Module (เช็คว่ามีลูกอยู่ใน Sub Module นี้ไหม)
        if (selectedSubModule && selectedSubModule !== 'all') {
            filteredData = filteredData.filter(com => {
                if (!com.linked_test_cases) return false;
                return com.linked_test_cases.some(tc => tc.module_subgroup === selectedSubModule);
            });
        }

        // 4. Search Logic
        if (searchTerm) {
            filteredData = filteredData.filter(com => {
                const isComMatch = com.company_name && com.company_name.toLowerCase().includes(searchTerm);
                const hasChildMatch = com.linked_test_cases && com.linked_test_cases.some(tc => {
                    const nameMatch = tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchTerm);
                    const codeMatch = tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchTerm);
                    return nameMatch || codeMatch;
                });
                return isComMatch || hasChildMatch;
            });
        }

        // 5. Render (ส่งค่า Filter ทั้งหมดไปให้ renderData)
        renderData(filteredData, searchTerm, selectedPhase, selectedModule, selectedSubModule);
    }


    // --- 4. RENDER DATA ---

    function renderData(companies, searchTerm = '', selectedPhase = 'all', selectedModule = 'all', selectedSubModule = 'all') {
        if (!comdataContainer) return;

        let html = `
            <table class="table table-bordered table-hover align-middle">
                <thead class="table-light text-center">
                    <tr>
                        <th style="width: 35%;">บริษัท (Company)</th>
                        <th style="width: 15%;">Module</th> 
                        <th style="width: 20%;">Test Objective</th>
                        <th style="width: 25%;">Test Name (Scenario)</th>
                        <th style="width: 5%;">Action</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (!companies || companies.length === 0) {
            html += `<tr><td colspan="5" class="text-center p-4 text-muted">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
        } else {
            companies.forEach((com) => {
                const isComMatch = searchTerm === '' || (com.company_name && com.company_name.toLowerCase().includes(searchTerm));
                
                let visibleTestCases = com.linked_test_cases || [];

                // --- LOGIC คัดกรองลูก (Test Case) ---
                visibleTestCases = visibleTestCases.filter(tc => {
                    // 1. Search
                    const nameMatch = tc.test_case_name && tc.test_case_name.toLowerCase().includes(searchTerm);
                    const codeMatch = tc.test_id_code && tc.test_id_code.toLowerCase().includes(searchTerm);
                    
                    // 2. Phase
                    const isPhaseMatch = (selectedPhase === 'all') || (String(tc.test_phase_id) === String(selectedPhase));
                    
                    // 3. Module & SubModule Filter
                    const isModuleMatch = (selectedModule === 'all') || (tc.module_group_id === selectedModule);
                    const isSubModuleMatch = (selectedSubModule === 'all') || (tc.module_subgroup === selectedSubModule);

                    // รวมเงื่อนไข: ต้องผ่าน Phase, Module, และ SubModule เสมอ
                    const filtersPass = isPhaseMatch && isModuleMatch && isSubModuleMatch;

                    if (isComMatch) return filtersPass; 
                    else return (nameMatch || codeMatch) && filtersPass; 
                });

                if (visibleTestCases.length === 0 && !isComMatch) return;

                // --- HTML ---
                const comNameDisplay = `<span class="company-badge">${com.company_id}</span> ${com.company_name}`;
                const linkBtn = `
                    <button class="btn btn-sm btn-link p-0 open-link-modal-btn float-end" 
                            data-com-id="${com.company_id}" 
                            data-com-name="${com.company_name}"
                            title="จับคู่ Test Scenario">
                        <i class="bi bi-plus-circle fs-5 text-primary"></i>
                    </button>`;
                const comDisplay = `<div class="d-flex justify-content-between align-items-start h-100"><div class="text-break">${comNameDisplay}</div>${linkBtn}</div>`;

                if (visibleTestCases.length === 0) {
                    html += `<tr class="company-row"><td class="ps-3" style="vertical-align: top;">${comDisplay}</td><td colspan="4" class="text-center text-muted fst-italic p-3"><span class="opacity-50"><i class="bi bi-link-45deg"></i> ยังไม่มี Test Scenario ที่ผูกไว้ (หรือถูกกรองออก)</span></td></tr>`;
                } else {
                    const totalRowSpan = visibleTestCases.reduce((sum, tc) => sum + Math.max(1, (tc.scenarios ? tc.scenarios.length : 0)), 0);
                    let isFirstRow = true;

                    visibleTestCases.forEach(tc => {
                        const moduleName = tc.module_name || '-';
                        const tcName = tc.test_case_name || '-';
                        const tcCode = tc.test_id_code || '';
                        const scenarios = tc.scenarios || [];
                        const phaseName = tc.test_phase || '';

                        // Badge
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
                        
                        // Content (Flexbox)
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

                        const unlinkButton = `<button class="btn btn-sm btn-link text-danger p-0 unlink-tc-btn" data-com-id="${com.company_id}" data-tc-id="${tc.test_case_id}" title="นำออก"><i class="bi bi-dash-circle fs-5"></i></button>`;
                        const tcRowSpan = Math.max(1, scenarios.length);

                        if (scenarios.length === 0) {
                            html += `<tr class="scenario-row">`;
                            if (isFirstRow) { html += `<td class="ps-3" rowspan="${totalRowSpan}" style="vertical-align: top;">${comDisplay}</td>`; isFirstRow = false; }
                            html += `<td rowspan="${tcRowSpan}">${moduleName}</td>`;
                            // ✨ แก้ไข Vertical Align (ลบ style="vertical-align: top;")
                            html += `<td rowspan="${tcRowSpan}">${tcContent}</td>`;
                            html += `<td class="text-center text-muted fst-italic opacity-50">- No Scenario -</td><td class="text-center" rowspan="${tcRowSpan}">${unlinkButton}</td></tr>`;
                        } else {
                            scenarios.forEach((sc, idx) => {
                                html += `<tr class="scenario-row">`;
                                if (isFirstRow) { html += `<td class="ps-3" rowspan="${totalRowSpan}" style="vertical-align: top;">${comDisplay}</td>`; isFirstRow = false; }
                                if (idx === 0) { 
                                    html += `<td rowspan="${tcRowSpan}">${moduleName}</td>`;
                                    // ✨ แก้ไข Vertical Align
                                    html += `<td rowspan="${tcRowSpan}">${tcContent}</td>`; 
                                }
                                const scBadge = sc.scenario_id_code ? `<span class="badge bg-success-subtle text-success-emphasis me-1">${sc.scenario_id_code}</span>` : '';
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
        comdataContainer.innerHTML = html;
    }


    // --- 5. MODAL LOGIC (Adapted for Company) ---

    async function openLinkModal(comId, comName) {
        modalTitle.textContent = `จับคู่ Test Objective กับ: ${comName}`;
        modalLinkingIdInput.value = comId;
        
        populateModalFilters(); 
        
        const mainPhase = document.getElementById('phase-filter');
        if (modalPhaseFilter && mainPhase) {
            modalPhaseFilter.innerHTML = mainPhase.innerHTML;
            modalPhaseFilter.value = 'all';
        }
        
        if (allTestCasesMap.size === 0) await fetchPageData(); 

        const currentLinks = allCompaniesData.find(c => String(c.company_id) === String(comId))?.linked_test_cases || [];
        const currentLinkIds = new Set(currentLinks.map(tc => tc.test_case_id));

        modalModuleFilter.value = 'all';
        modalSubModuleFilter.value = 'all';
        modalSubModuleFilter.disabled = true;
        modalSearchInput.value = '';
        
        renderModalTable(Array.from(allTestCasesMap.values()), currentLinkIds);
        linkScenarioModal.show();
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
        
        const comId = modalLinkingIdInput.value;
        const currentLinks = allCompaniesData.find(c => String(c.company_id) === String(comId))?.linked_test_cases || [];
        const currentLinkIds = new Set(currentLinks.map(tc => tc.test_case_id));
        const combined = new Set([...checkedIds, ...currentLinkIds]);

        let data = Array.from(allTestCasesMap.values());

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
            
            // Cosmetic: Flexbox Modal
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
        const comId = modalLinkingIdInput.value;
        if (!comId) return;
        
        const spinner = saveLinksBtn.querySelector('.spinner-border');
        if (spinner) spinner.style.display = 'inline-block';
        saveLinksBtn.disabled = true;

        const selectedIds = [];
        modalBody.querySelectorAll('.modal-tc-checkbox:checked').forEach(cb => selectedIds.push(cb.dataset.testCaseId));
        
        const linksToInsert = selectedIds.map(tcId => ({ test_case_id: tcId }));

        try {
            const { error } = await supabaseClient.rpc('delete_and_insert_company_links', {
                p_company_id: comId,
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

    async function unlinkTestCase(comId, tcId, btn) {
        if (!confirm('ลบการจับคู่นี้?')) return;
        btn.disabled = true;
        try {
            const { error } = await supabaseClient
                .from('company_test_case_links')
                .delete()
                .match({ company_id: comId, test_case_id: tcId });
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
    if (phaseFilter) phaseFilter.addEventListener('change', applyFiltersAndRender);
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);

    comdataContainer.addEventListener('click', (e) => {
        const openBtn = e.target.closest('.open-link-modal-btn');
        if (openBtn) openLinkModal(openBtn.dataset.comId, openBtn.dataset.comName);

        const unlinkBtn = e.target.closest('.unlink-tc-btn');
        if (unlinkBtn) unlinkTestCase(unlinkBtn.dataset.comId, unlinkBtn.dataset.tcId, unlinkBtn);
    });

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