// =================================================================
// PCS Test Case - Scenario Detail Page Script (Rich Text - Card Layout)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL VARIABLES & QUILL INSTANCES ---
    let currentScenarioId = null;
    let infoQuill, actionQuill, expectedQuill; // Quill editor instances

    // DOM Elements
    const breadcrumbScenarioName = document.getElementById('breadcrumb-scenario-name');
    const cardHeaderTitle = document.getElementById('card-header-title');
    // Header Info Fields (Read-only)
    const formTestCaseId = document.getElementById('form-testcase-id');
    const formTestCaseName = document.getElementById('form-testcase-name');
    const formModuleName = document.getElementById('form-module-name');
    const formFunctionName = document.getElementById('form-function-name');
    const formPath = document.getElementById('form-path');
    const formScenarioId = document.getElementById('form-scenario-id');
    const formScenarioName = document.getElementById('form-scenario-name');
    const formRemark = document.getElementById('form-remark');
    // Buttons & Indicators
    const backBtn = document.getElementById('back-btn');
    const saveBtn = document.getElementById('save-scenario-details-btn');
    const deleteBtn = document.getElementById('delete-test-case');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    // Editor container elements (used for showing/hiding loading state within editors)
    const infoEditorDiv = document.getElementById('info-editor');
    const actionEditorDiv = document.getElementById('action-editor');
    const expectedEditorDiv = document.getElementById('expected-editor');


    // --- 2. QUILL EDITOR SETUP ---

    /** Initializes Quill editors with specified toolbars */
    function initializeQuillEditors() {
        // Toolbar for Action & Expected (Basic Formatting)

        const basicToolbarOptions = [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
            ['link'],
            ['clean']
        ];
        // Toolbar for Information (Includes Image via URL)
        const infoToolbarOptions = [
             [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike', 'link'],
             [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
            ['image'], // Allow image insertion by URL
            ['clean']
        ];

        try {
            
            if (document.getElementById('info-editor') && document.getElementById('info-toolbar')) {
                infoQuill = new Quill('#info-editor', {
                    theme: 'snow',
                    modules: { toolbar: infoToolbarOptions,imageResize: {} } // Target the specific toolbar container
                });
                console.log('Info Quill Instance:', infoQuill);
                infoQuill.root.setAttribute('aria-label', 'Information Editor');
            } else { console.error("Elements for Info Editor/Toolbar not found."); }

            // Initialize Action Editor
            if (document.getElementById('action-editor') && document.getElementById('action-toolbar')) {
                actionQuill = new Quill('#action-editor', {
                    theme: 'snow',
                    modules: { toolbar: basicToolbarOptions } // Target the specific toolbar container
                });
                actionQuill.root.setAttribute('aria-label', 'Action Editor');
            } else { console.error("Elements for Action Editor/Toolbar not found."); }

            // Initialize Expected Result Editor
            if (document.getElementById('expected-editor') && document.getElementById('expected-toolbar')) {
                expectedQuill = new Quill('#expected-editor', {
                    theme: 'snow',
                    modules: { toolbar: basicToolbarOptions } // Target the specific toolbar container
                });
                expectedQuill.root.setAttribute('aria-label', 'Expected Result Editor');
             } else { console.error("Elements for Expected Result Editor/Toolbar not found."); }

        } catch (error) {
             console.error("Failed to initialize Quill editors:", error);
             showError("Error initializing text editors. Cannot edit content.");
             if (saveBtn) saveBtn.disabled = true; // Disable save if editors fail
        }
    }


    // --- 3. DATA FETCHING & POPULATION ---

    /** Gets Scenario ID from URL */
    function getScenarioIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('sc_id'); // Ensure URL uses 'sc_id'
    }

    /** Fetches Scenario data and populates the form */
    async function loadScenarioData() {
        currentScenarioId = getScenarioIdFromUrl();
        if (!currentScenarioId || typeof supabaseClient === 'undefined') {
            showError('Scenario ID not found or connection unavailable.');
            console.error("Scenario ID missing or Supabase client failed.");
            return;
        }

        showLoading(true);
        hideMessages();
        if (saveBtn) saveBtn.disabled = true; // Disable save during load
        if (deleteBtn) deleteBtn.disabled = true; // Disable delete during load
        try {
            // Fetch scenario and related data
            const { data, error } = await supabaseClient
                .from('scenarios')
                .select(`
                    id, scenario_id_code, name, type, function, remark, information, action, expected_result,
                    test_cases (
                        test_id_code, name, function, tor_id,
                        pcs_module ( name, description )
                    )
                `)
                .eq('id', currentScenarioId)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Scenario data not found.');

            console.log("Fetched Scenario Data:", data);

            // Populate Header/Readonly fields
            const tc = data.test_cases;
            const module = tc?.pcs_module;
            const tcPath = (module?.name && tc?.function) ? `${module.name} > ${tc.function}` : (module?.name || 'N/A');

            if (formTestCaseId) formTestCaseId.value = tc?.test_id_code || '-';
            if (formTestCaseName) formTestCaseName.value = tc?.name || '-';
            if (formModuleName) formModuleName.value = module?.name || '-';
            if (formFunctionName) formFunctionName.value = tc?.function || '-';
            if (formPath) formPath.value = tcPath;
            if (formScenarioId) formScenarioId.value = data.scenario_id_code || '-';
            if (formScenarioName) formScenarioName.value = data.name || '-';
            if (formRemark) formRemark.value = data.remark || '-';
            if (breadcrumbScenarioName) breadcrumbScenarioName.textContent = `Edit: ${data.name || 'Scenario'}`;
            if (cardHeaderTitle) cardHeaderTitle.textContent = `Edit Scenario: ${data.scenario_id_code || ''}`;

            // Populate Quill Editors - Use dangerouslyPasteHTML after checking instance exists
            if (infoQuill) infoQuill.clipboard.dangerouslyPasteHTML(0, data.information || ''); else if (infoEditorDiv) infoEditorDiv.innerHTML = '<p class="text-muted p-2">Editor failed to load.</p>';
            if (actionQuill) actionQuill.clipboard.dangerouslyPasteHTML(0, data.action || ''); else if (actionEditorDiv) actionEditorDiv.innerHTML = '<p class="text-muted p-2">Editor failed to load.</p>';
            if (expectedQuill) expectedQuill.clipboard.dangerouslyPasteHTML(0, data.expected_result || ''); else if (expectedEditorDiv) expectedEditorDiv.innerHTML = '<p class="text-muted p-2">Editor failed to load.</p>';

        } catch (error) {
            console.error("Error loading scenario data:", error);
            showError(`Error loading scenario: ${error.message}`);
        } finally {
            showLoading(false);
            // Re-enable save button only if Quill editors initialized successfully
            if (saveBtn && infoQuill && actionQuill && expectedQuill) {
                 saveBtn.disabled = false;
            } else if (saveBtn) {
                 saveBtn.disabled = true; // Keep disabled if editors failed
                 console.warn("Save button remains disabled as editors failed to initialize.");
            }

            if (deleteBtn) deleteBtn.disabled = false;

            document.getElementById('form-remark')?.focus();
        }
    }


    // --- 4. SAVE AND DELETE FUNCTIONALITY ---

    /** Handles saving the updated scenario details */
    async function handleSaveChanges() {
        if (!currentScenarioId || !infoQuill || !actionQuill || !expectedQuill || typeof supabaseClient === 'undefined') {
            showError("Cannot save data. Initialization failed or editors not ready.");
            return;
        }

        const newScenarioName = formScenarioName.value.trim();
        const newRemark = formRemark.value.trim();

        if (!newScenarioName) {
            showError("กรุณากรอก Scenario Name (ชื่อ Test Name)");
            return; // หยุดการทำงานถ้าไม่มีชื่อ
        }

        showLoading(true);
        hideMessages();
        if (saveBtn) saveBtn.disabled = true;

        try {
            // Get HTML content from Quill editors
            const getQuillHTML = (quillInstance) => {
                return quillInstance.getLength() > 1 ? quillInstance.root.innerHTML : null;
            };

            const updates = {
                name: newScenarioName,
                remark: newRemark || null,
                information: getQuillHTML(infoQuill),
                action: getQuillHTML(actionQuill),
                expected_result: getQuillHTML(expectedQuill),
                updated_at: new Date()
            };

            const { error } = await supabaseClient
                .from('scenarios')
                .update(updates)
                .eq('id', currentScenarioId);

            if (error) throw error;

            showSuccess("Scenario details saved successfully!");
            console.log("Scenario updated:", currentScenarioId);

            if (breadcrumbScenarioName) {
                breadcrumbScenarioName.textContent = `Edit: ${newScenarioName}`;
            }

            setTimeout(hideMessages, 3000);

        } catch (error) {
            console.error("Error saving scenario details:", error);
            showError(`Failed to save changes: ${error.message}`);
        } finally {
            showLoading(false);
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    async function handleDeleteScenario() {
        if (!currentScenarioId || typeof supabaseClient === 'undefined') {
            showError("ไม่สามารถลบได้: ไม่พบ Scenario ID หรือการเชื่อมต่อล้มเหลว");
            return;
        }

        // 1. ยืนยันจากผู้ใช้ (ใช้ชื่อจากฟอร์มเพื่อความชัดเจน)
        const scenarioName = formScenarioName.value || 'Test Name นี้';
        if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ Test Name นี้?\n\n"${scenarioName}"\n\n(การดำเนินการนี้ไม่สามารถย้อนกลับได้)`)) {
            return;
        }

        // 2. ปิดปุ่มและแสดงสถานะ Loading
        showLoading(true);
        hideMessages();
        if (saveBtn) saveBtn.disabled = true;
        if (deleteBtn) deleteBtn.disabled = true;

        try {
            // 3. (ตรวจสอบ) ค้นหา Test Steps ทั้งหมดที่เกี่ยวข้องกับ Scenario นี้
            const { data: steps, error: stepsError } = await supabaseClient
                .from('test_steps')
                .select('id') // เลือกแค่ ID ก็พอ
                .eq('scenario_id', currentScenarioId);

            if (stepsError) throw new Error(`เกิดข้อผิดพลาดในการค้นหา Steps: ${stepsError.message}`);

            // 4. (ตรวจสอบ) ถ้ามี Steps, ให้ค้นหา Test Results ที่เกี่ยวข้อง
            if (steps.length > 0) {
                const stepIds = steps.map(s => s.id); // ดึง ID ของ Steps ทั้งหมด

                const { count, error: resultsError } = await supabaseClient
                    .from('test_results')
                    .select('id', { count: 'exact', head: true }) // ใช้ .head: true เพื่อนับอย่างเดียว ไม่ดึงข้อมูล
                    .in('test_step_id', stepIds);

                if (resultsError) throw new Error(`เกิดข้อผิดพลาดในการค้นหา Results: ${resultsError.message}`);
                
                // 5. (เงื่อนไข) ถ้ามีผลลัพธ์ (count > 0) ให้หยุดและแจ้งเตือน
                if (count > 0) {
                    throw new Error(`ไม่สามารถลบได้: Test Name นี้มีผลการทดสอบ (${count} results) บันทึกอยู่ในระบบแล้ว`);
                }
            }

            // 6. (ดำเนินการลบ) ถ้าไม่พบ Steps หรือ ไม่พบ Results
            console.log('ไม่พบผลการทดสอบ... ดำเนินการลบ');
            const { error: deleteError } = await supabaseClient
                .from('scenarios')
                .delete()
                .eq('id', currentScenarioId);

            if (deleteError) throw new Error(`การลบล้มเหลว: ${deleteError.message}`);

            // 7. (สำเร็จ) แจ้งเตือนและพากลับไปหน้าก่อนหน้า
            showSuccess("ลบ Test Name เรียบร้อยแล้ว กำลังกลับไปหน้าหลัก...");

            // ให้เวลาผู้ใช้อ่านข้อความ 2 วินาที แล้วค่อย redirect
            setTimeout(() => {
                // กลับไปหน้า tcwrpt.html (หรือหน้าที่ผู้ใช้เคยอยู่)
                window.location.href = document.referrer || '/tcwrpt.html';
            }, 2000);

        } catch (error) {
            // 8. (ล้มเหลว) แสดง Error ที่เกิดขึ้น
            console.error("Error deleting scenario:", error);
            showError(error.message); // แสดง Error ที่เรา throw ไว้
            
            // คืนค่าปุ่มให้กดได้อีกครั้ง (เพราะยังไม่ redirect)
            if (saveBtn) saveBtn.disabled = false;
            if (deleteBtn) deleteBtn.disabled = false;
            showLoading(false);
        }
        // ไม่ต้องมี finally ที่นี่ เพราะถ้าสำเร็จ เราจะ redirect ออกไปเลย
    }

    // --- 5. UI HELPER FUNCTIONS ---

    function showLoading(isLoading) { if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none'; }
    function hideMessages() { if (errorMessageDiv) errorMessageDiv.style.display = 'none'; if (successMessageDiv) successMessageDiv.style.display = 'none'; }
    function showError(message) { if (errorMessageDiv) { errorMessageDiv.textContent = message; errorMessageDiv.style.display = 'block'; } if (successMessageDiv) successMessageDiv.style.display = 'none'; }
    function showSuccess(message) { if (successMessageDiv) { successMessageDiv.textContent = message; successMessageDiv.style.display = 'block'; } if (errorMessageDiv) errorMessageDiv.style.display = 'none'; }


    // --- 6. EVENT LISTENERS & INITIALIZATION ---

    function initializePage() {
        initializeQuillEditors(); // Setup editors first
        loadScenarioData(); // Then load data into them

        // Back Button
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                 window.location.href = document.referrer || '/torwtc.html';
            });
        }

        // Save Button
        if (saveBtn) {
            saveBtn.addEventListener('click', handleSaveChanges);
        }

        // Delete Button
        if (deleteBtn) {
            deleteBtn.addEventListener('click', handleDeleteScenario);
        }
    }

    // --- KICKSTART THE PAGE ---
    // Ensure Layout Loader and Supabase Client are ready before initializing
    if (typeof supabaseClient !== 'undefined' && typeof loadComponent !== 'undefined') {
         initializePage();
    } else {
         console.warn("Supabase client or layout loader not ready yet, attempting delayed init.");
         setTimeout(initializePage, 700); // Wait a bit longer
    }

}); // End of DOMContentLoaded listener

