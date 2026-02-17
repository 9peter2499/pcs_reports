// =================================================================
// PCS Test Case - Test Case Summary Report Script (Final Version)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL VARIABLES & DOM ELEMENTS ---
    let reportViewData = []; // Store full data fetched from the view
    let allSubModules = []; // Store all sub-modules for filtering
    let allTestPhases = []; //Store all test phases

    // DOM Elements for Table and Filters
    const reportTableContainer = document.getElementById('report-table-container');
    const reportTableBody = reportTableContainer?.querySelector('tbody');
    const moduleFilter = document.getElementById('report-module-filter');
    const subModuleFilter = document.getElementById('report-submodule-filter');
    const phaseFilter = document.getElementById('report-phase-filter'); // Phase Filter (หน้าหลัก)
    const statusFilter = document.getElementById('report-status-filter');
    const evalFilter = document.getElementById('report-eval-filter');
    // Date Range elements removed

    // --- Modals & Related Elements ---

    // Add/Edit Test Case Modal
    const addEditModalEl = document.getElementById('addEditTestCaseModal');
    const addEditModal = addEditModalEl ? new bootstrap.Modal(addEditModalEl) : null;
    const saveUpdateBtn = document.getElementById('save-update-testcase-btn');
    const tcCodeInput = document.getElementById('modal-testcase-code');
    const tcNameInput = document.getElementById('modal-testcase-name');
    const codeDuplicateError = document.getElementById('code-duplicate-error');
    const modalModeInput = document.getElementById('modal-mode');
    const modalTcIdInput = document.getElementById('modal-testcase-id');
    const modalModuleIdInput = document.getElementById('modal-module-id'); // Stores pcs_module.id (PK)
    const modalLabel = document.getElementById('addEditTestCaseModalLabel');
    const modalPhaseGroup = document.getElementById('modal-phase-group'); //  Phase Dropdown
    const modalTestPhase = document.getElementById('modal-test-phase'); //  Dropdown Phase ใน Modal

    // Delete Test Case Modal
    const deleteModalEl = document.getElementById('deleteTcConfirmModal');
    const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
    const confirmDeleteBtn = document.getElementById('confirm-delete-tc-btn');
    const deleteTcCodeDisplay = document.getElementById('delete-tc-code-display');
    const deleteScenarioWarning = document.getElementById('delete-scenario-warning');

    // Add Scenario Modal Elements
    const scenarioModalEl = document.getElementById('scenarioModal');
    const scenarioModal = scenarioModalEl ? new bootstrap.Modal(scenarioModalEl) : null;
    const saveScenarioBtn = document.getElementById('save-scenario-btn');
    const scenarioForm = document.getElementById('scenario-form');
    const scenarioTcIdInput = document.getElementById('modal-tc-id-for-scenario');
    const scenarioIdCodeInput = document.getElementById('scenario-id-code');
    const scenarioNameInput = document.getElementById('scenario-name');
    const scenarioRemarkInput = document.getElementById('scenario-remark'); // Assuming ID exists in HTML

    let currentActionTcId = null; // Used for delete confirmation

    // --- 2. DATA FETCHING ---

    /**
     * Fetches data from the report view.
     */
    async function fetchData() {
        showLoading();
        if (typeof supabaseClient === 'undefined') { showError('Initialization Error.'); return []; }
        try {
            const { data, error } = await supabaseClient
                .from('test_case_report_view')
                .select('*')
                .range(0, 4999)
                .order('overall_row_num', { ascending: true });
            if (error) throw error;
            console.log("Data from View:", data);
            return data || [];
        } catch (error) {
            console.error('Error fetching report view data:', error);
            showError('Failed to load report data.');
            return [];
        }
    }

    /**
     * ✅ Populates the MAIN Module filter dropdown from MasterOptions.
     */
    async function populateModuleFilter() {
        if (!moduleFilter || typeof supabaseClient === 'undefined') return;
        try {
            const { data: moduleOptions, error } = await supabaseClient
                .from('MasterOptions').select('option_id, option_label, display_order')
                .eq('option_group', 'PCSMODULE')
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('option_label', { ascending: true });
            if (error) throw error;
            moduleFilter.innerHTML = '<option value="all" selected>แสดงทุก Module หลัก</option>';
            moduleOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.option_id;
                option.textContent = opt.option_label;
                moduleFilter.appendChild(option);
            });
        } catch (error) {
             console.error('Error fetching module options:', error);
             moduleFilter.innerHTML = '<option value="all" selected disabled>Error loading modules</option>';
        }
    }

    async function fetchTestPhases() {
        if (typeof supabaseClient === 'undefined') return;
        try {
            const { data, error } = await supabaseClient
                .from('test_phases')
                .select('id, name, phase_code')
                .order('display_order');
            
            if (error) throw error;
            allTestPhases = data || []; // เก็บใน Global
            console.log("Fetched Test Phases:", allTestPhases);
        } catch (error) {
            console.error('Error fetching test phases:', error);
        }
    }

    function populatePhaseFilter() {
        if (!phaseFilter || allTestPhases.length === 0) return;
        phaseFilter.innerHTML = '<option value="all" selected>All Phases</option>';
        allTestPhases.forEach(phase => {
            const option = document.createElement('option');
            option.value = phase.id; // ใช้ ID (UUID)
            option.textContent = `${phase.name} (${phase.phase_code})`;
            phaseFilter.appendChild(option);
        });
    }
     /**
      * ✅ Fetches ALL Sub Modules initially.
      */
     async function fetchAllSubModules() {
         if (typeof supabaseClient === 'undefined') return;
         try {
             const { data, error } = await supabaseClient
                 .from('MasterOptions').select('option_id, option_label, option_relation, display_order')
                 .eq('option_group', 'PCSSUBMOD')
                 .order('display_order', { ascending: true, nullsFirst: false })
                 .order('option_label', { ascending: true });
             if (error) throw error;
             allSubModules = data || [];
             console.log("Fetched Sub Modules:", allSubModules);
         } catch (error) {
              console.error('Error fetching sub-module options:', error);
              if (subModuleFilter) subModuleFilter.disabled = true;
         }
     }

     /**
      * ✅ Populates the SUB Module filter based on the selected MAIN module.
      */
     function populateSubModuleFilter(selectedMainModuleGroupId) {
         if (!subModuleFilter) return;
         subModuleFilter.innerHTML = '<option value="all" selected>แสดงทุก Sub Module</option>';
         if (selectedMainModuleGroupId === 'all' || !selectedMainModuleGroupId) { subModuleFilter.disabled = true; return; }
         subModuleFilter.disabled = false;
         const relevantSubModules = allSubModules.filter(sub => sub.option_relation === selectedMainModuleGroupId);
         console.log(`Relevant Sub Modules for ${selectedMainModuleGroupId}:`, relevantSubModules);
         relevantSubModules.forEach(opt => {
             const option = document.createElement('option');
             option.value = opt.option_id;
             option.textContent = opt.option_label;
             subModuleFilter.appendChild(option);
         });
     }

    // --- 3. UI RENDERING ---

    function showLoading() { if (reportTableBody) reportTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5">...Loading...</td></tr>`; }
    function showError(message) { if (reportTableBody) reportTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-danger">${message}</td></tr>`; }
    function getResultBadge(status) {
         switch (status?.toLowerCase()) {
            case 'passed': return '<span class="badge bg-success">Passed</span>';
            case 'failed': return '<span class="badge bg-danger">Failed</span>';
            case 'blocked': return '<span class="badge bg-warning text-dark">Blocked</span>';
            case 'skipped': return '<span class="badge bg-secondary">Skipped</span>';
            case 'in progress': return '<span class="badge bg-info text-dark">In Progress</span>';
            case 'n/a': return '<span class="badge bg-light text-dark">N/A</span>';
            default: return `<span class="badge bg-light text-dark">${status || 'N/A'}</span>`;
        }
     }
    function formatEvaluation(severity, priority) {
        if (!severity && !priority) return '-';
        const severityBadge = severity ? `<span class="badge bg-secondary me-1">${severity}</span>` : '';
        const priorityBadge = priority ? `<span class="badge bg-dark">${priority}</span>` : '';
        return `<div>S: ${severityBadge}</div><div>P: ${priorityBadge}</div>`;
     }

     function getPhaseBadgeClass(phaseCode) {
        switch (phaseCode?.toUpperCase()) {
            case 'UNIT':
                return 'text-bg-secondary'; // สีเทา (สำหรับ Unit Test)
            case 'SIT':
                return 'text-bg-warning';   // สีน้ำเงิน (สำหรับ SIT)
            case 'UAT':
                return 'text-bg-primary';   // สีเขียว (สำหรับ UAT)
            default:
                return 'text-bg-dark';      // สีดำ (สำหรับ Phase อื่นๆ ที่ไม่ได้ระบุ)
        }
    }

    /**
     * ✅ Renders the table using data from the view (no pagination).
     */
        
     function renderTable(dataToRender) {
        if (!reportTableBody) { console.error("Report table body not found!"); return; }
        if (!dataToRender || dataToRender.length === 0) { reportTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">No data matching criteria.</td></tr>`; return; }

        let html = '';
        let moduleCounter = 0; // ✅ รีเซ็ตตัวนับทุกครั้งที่ Render ใหม่
        let lastRenderedModuleId = null; // ✅ ใช้ตัวแปรนี้ติดตาม Module ล่าสุดที่แสดงเลข No. ไปแล้ว

        // Render rows based on the filtered data
        for (let i = 0; i < dataToRender.length; i++) {
            const row = dataToRender[i];
            const resultBadge = getResultBadge(row.result);
            const evalDisplay = formatEvaluation(row.severity, row.priority);

            html += `<tr>`;

            // --- No. Column & Module Column ---
            const isFirstRowOfModule = (i === 0) || (dataToRender[i - 1].module_id !== row.module_id);

            if (isFirstRowOfModule) {
                // ✅ เพิ่มเลขลำดับเฉพาะเมื่อเจอ Module ใหม่ในข้อมูลที่กรองแล้ว
                if (row.module_id !== lastRenderedModuleId) {
                    moduleCounter++;
                    lastRenderedModuleId = row.module_id;
                }

                let moduleRowSpan = 1;
                for (let j = i + 1; j < dataToRender.length && dataToRender[j].module_id === row.module_id; j++) { moduleRowSpan++; }

                const addTcIcon = `<button class="btn btn-sm btn-link p-0 add-tc-btn float-end" data-module-id="${row.module_id}" title="Add New Test Case"><i class="bi bi-plus-circle fs-5 text-primary"></i></button>`;
                const moduleDisplay = `<div class="d-flex justify-content-between align-items-end h-100"><span>${row.module_name || '-'}</span>${addTcIcon}</div>`;

                html += `<td class="text-center" rowspan="${moduleRowSpan}">${moduleCounter}</td>`;
                html += `<td rowspan="${moduleRowSpan}">${moduleDisplay}</td>`;
            }

            // --- Test Case Column ---
             const isFirstRowOfTc = (i === 0) || 
                                    (dataToRender[i - 1].test_case_id !== row.test_case_id) || 
                                    (dataToRender[i - 1].module_id !== row.module_id);

             if (isFirstRowOfTc) { 
                let tcRowSpan = 1;
                 for (let j = i + 1; j < dataToRender.length && dataToRender[j].module_id === row.module_id && dataToRender[j].test_case_id === row.test_case_id; j++) {
                     tcRowSpan++;
                 }
                 tcRowSpan = Math.max(1, tcRowSpan); // Ensure rowspan is at least 1

                 let tcContent = '-';
                 if (row.test_case_id) {
                     const phase = allTestPhases.find(p => p.id === row.test_phase_id);
                    const phaseCode = phase ? phase.phase_code : '';
                    const badgeClass = getPhaseBadgeClass(phaseCode); 
                    
                    // ✨ [แก้ไข] เพิ่ม me-2 (margin-end 2) เพื่อให้มีช่องว่างระหว่าง 2 คอลัมน์ย่อย
                    const phaseBadge = phase ? `<span class="badge ${badgeClass} me-2">${phaseCode}</span>` : '';
                    
                    // ✨ [แก้ไข] เพิ่ม me-1 (margin-end 1) เพื่อให้มีช่องว่างกับชื่อ
                    const tcIdBadge = row.test_id_code ? `<span class="badge bg-info-subtle text-primary-emphasis me-1">${row.test_id_code}</span>` : '';
                    
                    // ---------------------------------
                     //const tcIdBadge = row.test_id_code ? `<span class="badge bg-info-subtle text-primary-emphasis">${row.test_id_code}</span>` : '';
                     const editIcon = `<button class="btn btn-sm btn-link text-warning p-0 ms-1 edit-tc-btn" title="Edit Test Case" data-tc-id="${row.test_case_id}" data-tc-code="${row.test_id_code || ''}" data-tc-name="${row.test_case_name || ''}"><i class="bi bi-marker-tip fs-5"></i></button>`;
                     const deleteIcon = `<button class="btn btn-sm btn-link text-danger p-0 ms-1 delete-tc-btn" title="Delete Test Case" data-tc-id="${row.test_case_id}" data-tc-code="${row.test_id_code || ''}"><i class="bi bi-dash-circle fs-5"></i></button>`;
                     const addScenarioIcon = `<button class="btn btn-sm btn-link text-success p-0 add-scenario-btn" title="Add Test Name (Scenario)" data-tc-id="${row.test_case_id}" data-tc-code="${row.test_id_code || ''}"><i class="bi bi-plus-circle fs-5"></i></button>`;
                     const tcNamePart = `${row.test_case_name || ''}`;

                     const topContentHtml = `
                        <div class="d-flex align-items-start">
                            <div>
                                ${phaseBadge}
                            </div>
                            <div class="flex-grow-1">
                                ${tcIdBadge}${tcNamePart}
                            </div>
                        </div>
                    `;
                    // ---------------------------------

                    tcContent = `
                        <div class="d-flex flex-column justify-content-between h-100">
                            ${topContentHtml} <div class="d-flex justify-content-end align-items-center mt-1">
                                ${editIcon}${deleteIcon} &nbsp;${addScenarioIcon}
                            </div>
                        </div>`;
                 }
                 // ✅ [ย้ายมาไว้ข้างใน] สร้าง <td> ของ Test Case ที่นี่
                 html += `<td rowspan="${tcRowSpan}">${tcContent}</td>`; }

            // --- Scenario Column ---
            let scenarioDisplay = '-';
             if (row.scenario_id) {
                 const scenarioIdBadge = `<span class="badge bg-success-subtle text-success-emphasis">${row.scenario_id_code || ''}</span>`;
                 // ✅ ดึง Function/Type จาก View (ถ้ามี)
                 //const functionBadge = row.scenario_function ? `<span class="badge bg-info-subtle text-info-emphasis ms-1">${row.scenario_function}</span>` : '';
                 //const typeBadge = row.scenario_type ? `<span class="badge bg-secondary-subtle text-secondary-emphasis ms-1">${row.scenario_type}</span>` : '';
                 const typeBadge = `<span class="fw-light fst-italic text-secondary" style="font-size:11px;">[ ${row.scenario_type} ]</span>`;
                 scenarioDisplay = `<a href="/scendt.html?sc_id=${row.scenario_id}" class="text-decoration-none d-block text-start" title="View Details" style="font-size:13px;">${scenarioIdBadge} - ${row.scenario_name || ''} ${typeBadge}</a>`;
             }
             html += `<td>${scenarioDisplay}</td>`;

            // --- Result & Evaluation Columns ---
            html += `<td class="text-center">${resultBadge}</td>`;
            html += `<td class="text-center">${evalDisplay}</td>`;
            html += `</tr>`;
        }

        reportTableBody.innerHTML = html;
        // Pagination rendering removed
    }

    // --- 4. FILTERING ---

    /** Applies all active filters and re-renders the table */
    function applyFiltersAndRender() {
        const selectedModuleGroup = moduleFilter?.value || 'all';
        const selectedSubModuleGroup = subModuleFilter?.value || 'all';
        const selectedPhase = phaseFilter?.value || 'all';
        const selectedStatus = statusFilter?.value || 'all';
        const selectedEval = evalFilter?.value || 'all';
        let filteredData = reportViewData;

        // สร้าง Object เพื่อเก็บสถานะของ Filter
        const filterState = {
            module: selectedModuleGroup,
            subModule: selectedSubModuleGroup,
            phase: selectedPhase,
            status: selectedStatus,
            evaluation: selectedEval
        };
        // บันทึกลงใน sessionStorage
        sessionStorage.setItem('pcsReportFilters', JSON.stringify(filterState));

        console.log(`Filtering by Module Group: "${selectedModuleGroup}", Sub Group: "${selectedSubModuleGroup}"`);
        if (selectedModuleGroup !== 'all') { filteredData = filteredData.filter(row => row.module_group === selectedModuleGroup); }
        if (selectedSubModuleGroup !== 'all') { filteredData = filteredData.filter(row => row.module_subgroup === selectedSubModuleGroup); }
        if (selectedPhase !== 'all') { 
            filteredData = filteredData.filter(row => row.test_phase_id === selectedPhase);
        }
        if (selectedStatus !== 'all') { filteredData = filteredData.filter(row => (row.result || 'N/A').toLowerCase() === selectedStatus.toLowerCase()); }
        if (selectedEval !== 'all') {
             filteredData = filteredData.filter(row =>
                 (row.severity && row.severity.toLowerCase().startsWith(selectedEval.toLowerCase())) ||
                 (row.priority && row.priority.toLowerCase().startsWith(selectedEval.toLowerCase()))
             );
        }
        console.log("Filtered Data:", filteredData);
        renderTable(filteredData);
    }


    // --- 5. CRUD OPERATIONS for Test Cases ---

    function openAddEditTestCaseModal(mode, moduleId = null, tcId = null, tcCode = '', tcName = '') {
        if (!addEditModalEl) return;
        const form = document.getElementById('add-edit-testcase-form');

        if (form) form.reset();
        if(tcCodeInput) tcCodeInput.classList.remove('is-invalid');
        if(codeDuplicateError) codeDuplicateError.style.display = 'none';
        if(tcCodeInput) tcCodeInput.readOnly = false;
        if(modalPhaseGroup) modalPhaseGroup.style.display = 'none';
        if(modalTestPhase) modalTestPhase.disabled = false;

        if (modalModeInput) modalModeInput.value = mode;
        if (modalTcIdInput) modalTcIdInput.value = tcId;
        if (modalModuleIdInput) modalModuleIdInput.value = moduleId; // Use module PK (id) from view

        if (mode === 'edit') {
            if(modalLabel) modalLabel.innerText = 'Edit Test Case';
            if(saveUpdateBtn) saveUpdateBtn.innerText = 'Save Changes';
            if(tcCodeInput) tcCodeInput.value = tcCode;
            if(tcNameInput) tcNameInput.value = tcName;
            if(tcCodeInput) tcCodeInput.readOnly = true;

            const tcData = reportViewData.find(row => row.test_case_id === tcId);
            const currentPhaseId = tcData ? tcData.test_phase_id : null;

            if(modalPhaseGroup) modalPhaseGroup.style.display = 'block'; 
            if(modalTestPhase) {
                modalTestPhase.innerHTML = '<option value="" selected disabled>-- Loading Phase... --</option>';
                allTestPhases.forEach(phase => {
                    const option = document.createElement('option');
                    option.value = phase.id;
                    option.textContent = `${phase.name} (${phase.phase_code})`;
                    modalTestPhase.appendChild(option);
                });
                
                // ✨ [ใหม่] ตั้งค่า Phase ที่เลือกไว้ (ถ้าหาเจอ)
                if (currentPhaseId) {
                    modalTestPhase.value = currentPhaseId;
                } else {
                    modalTestPhase.value = ""; // ถ้า TC นี้ยังไม่มี Phase (ข้อมูลเก่า)
                }
                
                // ✨ [ใหม่] ล็อคไม่ให้แก้ไข
                modalTestPhase.disabled = true; 
            }

        } else {
            if(modalLabel) modalLabel.innerText = 'Add New Test Case';
            if(saveUpdateBtn) saveUpdateBtn.innerText = 'Save Test Case';
            if(modalPhaseGroup) modalPhaseGroup.style.display = 'block';

            if(modalTestPhase) {
                modalTestPhase.innerHTML = '<option value="" selected disabled>-- กรุณาเลือก Phase --</option>';
                allTestPhases.forEach(phase => {
                    const option = document.createElement('option');
                    option.value = phase.id; // ใช้ ID
                    option.textContent = `${phase.name} (${phase.phase_code})`;
                    modalTestPhase.appendChild(option);
                });
            }
        }
        if(addEditModal) addEditModal.show();
    }

    // Check Duplicate using Module CODE
    async function checkDuplicateCode(moduleCode, tcCode, currentTcId = null) {
         if (typeof supabaseClient === 'undefined') return true;
         try {
             // Assuming test_cases.pcs_module_id holds module_code
             const { count, error } = await supabaseClient
                 .from('test_cases')
                 .select('id', { count: 'exact', head: true })
                 .eq('pcs_module_id', moduleCode)
                 .eq('test_id_code', tcCode)
                 .neq('id', currentTcId || '00000000-0000-0000-0000-000000000000');
             if (error) throw error;
             return count > 0;
         } catch (error) {
              console.error("Duplicate check error:", error);
              return true; // Assume duplicate on error
         }
     }

    async function handleSaveUpdateTestCase() {
        if (!saveUpdateBtn || !addEditModal || typeof supabaseClient === 'undefined') return;
        saveUpdateBtn.disabled = true;

        const mode = modalModeInput?.value;
        const tcId = modalTcIdInput?.value;
        const moduleId = modalModuleIdInput?.value; // module PK (id) from view
        const tcCode = tcCodeInput?.value.trim();
        const tcName = tcNameInput?.value.trim();
        const phaseId = modalTestPhase?.value;

        if (!tcCode || !tcName || (mode === 'add' && !moduleId)) {
            alert('Please fill all required fields.');
            saveUpdateBtn.disabled = false; return;
        }

        let operationSuccessful = false;
        try {
            if (mode === 'add') {
                const { data: moduleData, error: moduleError } = await supabaseClient
                     .from('pcs_module').select('module_code').eq('id', moduleId).single();
                if (moduleError || !moduleData) throw new Error('Could not find module information.');
                const moduleCode = moduleData.module_code;

                const isDuplicate = await checkDuplicateCode(moduleCode, tcCode);
                 if (isDuplicate) {
                     if(tcCodeInput) tcCodeInput.classList.add('is-invalid');
                     if(codeDuplicateError) codeDuplicateError.style.display = 'block';
                     throw new Error('Duplicate Test Case Code detected for this module.');
                 } else {
                      if(tcCodeInput) tcCodeInput.classList.remove('is-invalid');
                     if(codeDuplicateError) codeDuplicateError.style.display = 'none';
                 }

                 // Find a relevant tor_id (Required by test_cases table)
                 let associatedTorId = null;
                 const moduleRows = reportViewData.filter(r => r.module_id == moduleId); // Use == for potential type mismatch
                 const firstValidRow = moduleRows.find(r => r.tor_id);
                 if (firstValidRow) {
                     associatedTorId = firstValidRow.tor_id;
                 } else {
                     // Attempt to find *any* TOR if none are linked in the view for this module yet
                     console.warn(`No associated tor_id found for module ID ${moduleId} in view data. Attempting to find one...`);
                     const {data: anyTor, error: torError} = await supabaseClient.from('TORs').select('tor_id').limit(1).single();
                     if(torError || !anyTor){
                         throw new Error("Cannot add Test Case: No suitable TOR found to associate with. Please ensure TORs exist.");
                     }
                     associatedTorId = anyTor.tor_id;
                     console.warn(`Using fallback TOR ID: ${associatedTorId}`);
                 }


                const { error: insertError } = await supabaseClient.from('test_cases').insert({
                    pcs_module_id: moduleCode,
                    test_id_code: tcCode,
                    name: tcName,
                    tor_id: associatedTorId, // Provide a valid tor_id
                    test_phase_id: phaseId
                });
                if (insertError) throw insertError;
                operationSuccessful = true;

            } else { // mode === 'edit'
                const { error: updateError } = await supabaseClient.from('test_cases')
                    .update({ name: tcName }).eq('id', tcId);
                if (updateError) throw updateError;
                operationSuccessful = true;
            }
        } catch (error) {
             console.error(`${mode === 'add' ? 'Insert' : 'Update'} Error:`, error);
             alert(`Failed to ${mode} Test Case. ${error.message}`);
        } finally {
             saveUpdateBtn.disabled = false;
             if (operationSuccessful) {
                if(addEditModal) addEditModal.hide();
                reportViewData = await fetchData(); // Re-fetch all data
                applyFiltersAndRender(); // Re-apply filters and render
            }
        }
    }

    async function openDeleteTcConfirmModal(tcId, tcCode) {
         if (!deleteModalEl || typeof supabaseClient === 'undefined') return;
        currentActionTcId = tcId;
        if(deleteTcCodeDisplay) deleteTcCodeDisplay.innerText = tcCode || 'this item';
        if(deleteScenarioWarning) deleteScenarioWarning.style.display = 'none';
        if(confirmDeleteBtn) confirmDeleteBtn.disabled = false;

        try {
            const { count, error } = await supabaseClient.from('scenarios')
                .select('*', { count: 'exact', head: true }).eq('test_case_id', tcId);
            if (error) throw error;
            if (count > 0) {
                if(deleteScenarioWarning) deleteScenarioWarning.style.display = 'block';
                if(confirmDeleteBtn) confirmDeleteBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error checking scenarios:', error);
            alert('Error checking scenarios. Cannot proceed.'); return;
        }
        if(deleteModal) deleteModal.show();
    }

    async function deleteTestCase() {
         if (!currentActionTcId || !confirmDeleteBtn || typeof supabaseClient === 'undefined') return;
        confirmDeleteBtn.disabled = true;
        let operationSuccessful = false;

        try {
            const { count, error: countError } = await supabaseClient.from('scenarios')
                .select('*', { count: 'exact', head: true }).eq('test_case_id', currentActionTcId);
            if (countError) throw countError;
            if (count > 0) throw new Error('Deletion cancelled: Scenarios exist.');

            const { error: deleteError } = await supabaseClient.from('test_cases').delete().eq('id', currentActionTcId);
            if (deleteError) throw deleteError;
            operationSuccessful = true;
        } catch (error) {
             console.error('Delete Error:', error); alert(`Failed to delete: ${error.message}`);
        } finally {
             confirmDeleteBtn.disabled = false;
             if(deleteModal) deleteModal.hide();
             if (operationSuccessful) {
                reportViewData = await fetchData();
                applyFiltersAndRender();
            }
        }
    }

    // --- เปิด Modal สำหรับเพิ่ม Scenario (Test Name)

    async function openAddScenarioModal(tcId, tcCode) {
        // ตรวจสอบว่ามี Modal หรือไม่
        if (!scenarioModalEl || typeof supabaseClient === 'undefined') {
             console.error("Scenario Modal or Supabase client not available.");
             return;
        }
        
        const form = document.getElementById('scenario-form');
        if (form) form.reset(); // Reset form fields

        // เก็บ Test Case ID หลัก และ Test Case Code สำหรับสร้าง ID ใหม่
        const tcIdInput = document.getElementById('modal-tc-id-for-scenario');
        if (tcIdInput) tcIdInput.value = tcId;

        const scenarioIdCodeInput = document.getElementById('scenario-id-code');
        
        // นับจำนวน Scenario ที่มีอยู่แล้วของ Test Case นี้เพื่อสร้าง ID ใหม่
        try {
            const { count, error } = await supabaseClient.from('scenarios')
                .select('*', { count: 'exact', head: true })
                .eq('test_case_id', tcId);
            
            if (error) throw error; // ส่งต่อไปยัง catch block

            // สร้าง ID ใหม่: [Test Case Code]-[ลำดับ] (เช่น VS-AL-001-01)
            const newScenarioNum = String((count || 0) + 1).padStart(2, '0');
            if (scenarioIdCodeInput) scenarioIdCodeInput.value = `${tcCode}-${newScenarioNum}`;

            scenarioModal.show(); // แสดง Modal

        } catch (error) {
            console.error('Error preparing scenario modal:', error);
            alert('Could not prepare the form. Please try again.');
        }
    }

    // --- บันทึก Test Name

    async function saveScenario() {
        if (typeof supabaseClient === 'undefined') return;

        // ดึงค่าจากฟอร์มที่อัปเดตแล้ว
        const tcId = document.getElementById('modal-tc-id-for-scenario')?.value;
        const scenarioIdCode = document.getElementById('scenario-id-code')?.value; // Scenario ID ที่สร้างอัตโนมัติ
        const scenarioName = document.getElementById('scenario-name')?.value.trim(); // ชื่อ Test Name
        const scenarioType = document.getElementById('scenario-type')?.value;
        const scenarioRemark = document.getElementById('scenario-remark')?.value.trim(); // Remark

        // ตรวจสอบข้อมูลเบื้องต้น
        if (!tcId || !scenarioIdCode || !scenarioName) {
            alert('Please ensure Test Name is filled.');
            return;
        }

        // ปิดปุ่ม Save ชั่วคราว
        if (saveScenarioBtn) saveScenarioBtn.disabled = true;
        let operationSuccessful = false;

        try {
            // สร้าง Object ข้อมูลที่จะ Insert (ลบ type, เพิ่ม remark)
            const newScenarioData = {
                test_case_id: tcId,
                scenario_id_code: scenarioIdCode,
                name: scenarioName,
                type: scenarioType,
                // สมมติว่าคอลัมน์ใน DB ชื่อ 'remark' หรือ 'description'
                // ถ้ายังไม่มีคอลัมน์นี้ ต้องเพิ่มในตาราง scenarios ก่อน
                remark: scenarioRemark || null // เก็บค่า remark หรือ null ถ้าว่าง
            };

            const { data: newScenario, error } = await supabaseClient.from('scenarios')
                 .insert(newScenarioData)
                 .select() // Select เพื่อเอาข้อมูลที่เพิ่ง Insert กลับมา
                 .single();

            if (error) throw error; // ส่งต่อไปยัง catch block

            // ----- Smart Refresh: อัปเดตข้อมูลใน Client-side -----
            // หา Test Case ที่เกี่ยวข้องในข้อมูลที่เรามีอยู่
            let targetTc = null;
            for (const module of reportViewData) {
                if (module.TORs) {
                    for (const tor of module.TORs) {
                        if (tor.test_cases) {
                             targetTc = tor.test_cases.find(c => c.id === tcId);
                             if (targetTc) break;
                        }
                    }
                }
                if (targetTc) break;
            }

            if (targetTc) {
                 // ถ้าเจอ Test Case, เพิ่ม Scenario ใหม่เข้าไปใน Array
                 if (!targetTc.scenarios) {
                      targetTc.scenarios = []; // สร้าง Array ถ้ายังไม่มี
                 }
                 targetTc.scenarios.push(newScenario); // เพิ่มข้อมูล Scenario ใหม่
            } else {
                 // ถ้าหา Test Case ไม่เจอ (ไม่ควรเกิด) ให้โหลดข้อมูลใหม่ทั้งหน้า
                 console.warn("Target Test Case not found for client-side update. Reloading data.");
                 reportViewData = await fetchData(); // Re-fetch data as fallback
            }
            // --------------------------------------------------

            operationSuccessful = true;

        } catch (error) {
            console.error('Error saving scenario:', error);
            alert(`Failed to save Test Name/Scenario. ${error.message}`);
        } finally {
            if (saveScenarioBtn) saveScenarioBtn.disabled = false; // เปิดปุ่ม Save คืน
            if (operationSuccessful) {
                if(scenarioModal) scenarioModal.hide(); // ซ่อน Modal
                applyFiltersAndRender(); // Render ตารางใหม่ด้วยข้อมูลที่อัปเดตแล้ว
            }
        }
    }

    function loadAndApplyFilterState() {
        const savedFilters = sessionStorage.getItem('pcsReportFilters');
        if (!savedFilters) return; // ไม่มีค่าที่บันทึกไว้

        try {
            const filters = JSON.parse(savedFilters);

            // 1. กู้ค่า Module หลัก
            if (filters.module && moduleFilter) {
                moduleFilter.value = filters.module;
                // 2. (สำคัญมาก) สั่งให้ populate Sub Module ที่เกี่ยวข้อง
                //    (ฟังก์ชันนี้จะทำงานได้เพราะ allSubModules ถูก fetch มาก่อนแล้ว)
                populateSubModuleFilter(filters.module);
            }
            
            // 3. กู้ค่า Sub Module
            if (filters.subModule && subModuleFilter) {
                subModuleFilter.value = filters.subModule;
            }

            if (filters.phase && phaseFilter) { 
                phaseFilter.value = filters.phase;
            }

            // 4. กู้ค่า Status
            if (filters.status && statusFilter) {
                statusFilter.value = filters.status;
            }
            
            // 5. กู้ค่า Evaluation
            if (filters.evaluation && evalFilter) {
                evalFilter.value = filters.evaluation;
            }

            console.log('✅ Restored filter state from sessionStorage:', filters);

        } catch (e) {
            console.error('Failed to parse saved filters:', e);
            sessionStorage.removeItem('pcsReportFilters'); // ลบข้อมูลที่เสียทิ้ง
        }
    }

    // --- 6. EVENT LISTENERS & INITIALIZATION ---

    
    async function initializePage() {
        if (typeof supabaseClient === 'undefined') { showError('Initialization Error.'); return; }

        await Promise.all([ populateModuleFilter(), fetchAllSubModules(),fetchTestPhases() ]);

        loadAndApplyFilterState();
        reportViewData = await fetchData();

        //renderTable(reportViewData);
        applyFiltersAndRender();
        populatePhaseFilter();

        // Filter listeners
        if (moduleFilter) moduleFilter.addEventListener('change', () => { populateSubModuleFilter(moduleFilter.value); applyFiltersAndRender(); });
        if (subModuleFilter) subModuleFilter.addEventListener('change', applyFiltersAndRender);
        if (phaseFilter) phaseFilter.addEventListener('change', applyFiltersAndRender);
        if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRender);
        if (evalFilter) evalFilter.addEventListener('change', applyFiltersAndRender);

        // ✅ Corrected Table Action Listeners (Event Delegation)
        if (reportTableBody) {
             // Ensure this listener is attached only once inside initializePage
             reportTableBody.addEventListener('click', (event) => {
                 // Define button variables *inside* the click handler scope
                 const addTcBtn = event.target.closest('.add-tc-btn');
                 const editBtn = event.target.closest('.edit-tc-btn');
                 const deleteBtn = event.target.closest('.delete-tc-btn');
                 const addScenarioBtn = event.target.closest('.add-scenario-btn');

                 // Check which button was clicked and call the appropriate function
                 if (addTcBtn) {
                     const moduleId = addTcBtn.dataset.moduleId;
                     if(moduleId) openAddEditTestCaseModal('add', moduleId);
                     else console.error("Module ID not found for Add button");
                 } else if (editBtn) {
                     openAddEditTestCaseModal('edit', null, editBtn.dataset.tcId, editBtn.dataset.tcCode, editBtn.dataset.tcName);
                 } else if (deleteBtn) {
                     openDeleteTcConfirmModal(deleteBtn.dataset.tcId, deleteBtn.dataset.tcCode);
                 } else if (addScenarioBtn) {
                      openAddScenarioModal(addScenarioBtn.dataset.tcId, addScenarioBtn.dataset.tcCode);
                 }
                 // IMPORTANT: Do NOT reference addBtn, editBtn, etc. outside this block
             });
        } else {
             console.error("Report table body not found for attaching click listeners.");
        }

        // Modal Button Listeners
        if (saveUpdateBtn) saveUpdateBtn.addEventListener('click', handleSaveUpdateTestCase);
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteTestCase);
        if (saveScenarioBtn) saveScenarioBtn.addEventListener('click', saveScenario);
    }

    initializePage(); // Start the process

});

