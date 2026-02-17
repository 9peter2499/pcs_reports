document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DOM ELEMENTS ---
    const phasesTbody = document.getElementById('phases-tbody');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageDiv = document.getElementById('error-message');
    const searchInput = document.getElementById('search-phase-input'); // Search Input เดิม
    const phaseCodeFilter = document.getElementById('phase-code-filter'); // ✨ [เพิ่ม] Dropdown ใหม่
    const addPhaseBtn = document.getElementById('add-phase-btn');
    
    // (Modal elements - เหมือนเดิม)
    const phaseModalEl = document.getElementById('phaseModal');
    const phaseModal = new bootstrap.Modal(phaseModalEl);
    // ... (modalPhaseId, modalPhaseCode, modalPhaseName, detailEditor, ...)
    const savePhaseBtn = document.getElementById('save-phase-btn');
    const deletePhaseModalEl = document.getElementById('deletePhaseModal');
    const deletePhaseModal = new bootstrap.Modal(deletePhaseModalEl);
    // ... (deletePhaseName, deletePhaseId, confirmDeletePhaseBtn)
    const confirmDeletePhaseBtn = document.getElementById('confirm-delete-phase-btn');
    const deletePhaseNameSpan = document.getElementById('delete-phase-name');
    const deletePhaseIdInput = document.getElementById('delete-phase-id');

    const phaseCaseType = document.getElementById('phase-type');

    // Add/Edit Modal Elements
    const phaseModalLabel = document.getElementById('phaseModalLabel');
    const phaseForm = document.getElementById('phase-form');
    const modalPhaseId = document.getElementById('modal-phase-id');
    const modalPhaseCode = document.getElementById('modal-phase-code');
    const modalPhaseName = document.getElementById('modal-phase-name');
    const modalDisplayOrder = document.getElementById('modal-display-order');
    const codeDuplicateError = document.getElementById('code-duplicate-error');
    
    // Quill Instance
    let detailQuill; 

    // Global variable to store fetched data
    let allPhasesData = [];


    // --- 2. QUILL EDITOR SETUP ---
    function initializeQuillEditor() {
        const basicToolbarOptions = [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
            ['link'],
            ['clean']
        ];

        try {
            if (document.getElementById('detail-editor')) {
                detailQuill = new Quill('#detail-editor', {
                    theme: 'snow',
                    modules: { toolbar: basicToolbarOptions } // (ถ้ามี Toolbar)
                });
            } else { console.error("Quill editor element not found.");}
        } catch(e) { console.error("Failed to initialize Quill", e);}
    }

    // --- 3. DATA FETCHING & RENDERING ---

    async function fetchTestPhases() {
        showLoading(true);
        // (โค้ด Fetch Data เหมือนเดิม)
        const { data, error } = await supabaseClient
            .from('test_phases')
            .select('*') 
            .order('display_order', { ascending: true, nullsLast: true }) 
            .order('name'); 
        showLoading(false); // ซ่อน Loading หลัง Fetch เสร็จ

        if (error) {
            console.error('Error fetching test phases:', error);
            showError(`Failed to load data: ${error.message}`);
            return []; 
        }
        allPhasesData = data || []; // เก็บข้อมูลไว้ใน Global Variable
        
        populatePhaseCodeFilter(allPhasesData); // ✨ [เพิ่ม] เรียกเติม Dropdown
        applyFiltersAndRender(); // ✨ [ปรับ] เรียก Filter/Render ทันที
        
        return allPhasesData; // (อาจจะไม่จำเป็นต้อง return แล้ว)
    }

    /** ✨ [เพิ่ม] เติมข้อมูล Phase Code ลงใน Dropdown Filter */
    function populatePhaseCodeFilter(phases) {
        if (!phaseCodeFilter) return;
        
        // เก็บค่าที่เลือกไว้ก่อน (ถ้ามี)
        const currentSelectedValue = phaseCodeFilter.value;
        
        phaseCodeFilter.innerHTML = '<option value="all" selected>All Phase Codes</option>'; // Reset
        
        // ใช้ Set เพื่อเอาเฉพาะ Code ที่ไม่ซ้ำ
        const uniqueCodes = new Set(phases.map(p => p.phase_code)); 
        
        uniqueCodes.forEach(code => {
            if(code){ // กันค่า null
                const option = document.createElement('option');
                option.value = code;
                option.textContent = code;
                phaseCodeFilter.appendChild(option);
            }
        });

        // คืนค่าที่เลือกไว้ (ถ้าเป็นไปได้)
        if (phaseCodeFilter.querySelector(`option[value="${currentSelectedValue}"]`)) {
            phaseCodeFilter.value = currentSelectedValue;
        }
    }

    /** ✨ [ปรับปรุง] กรองและวาดตารางใหม่ */
    function applyFiltersAndRender() {
        if (!phasesTbody) return;

        const selectedPhaseCode = phaseCodeFilter.value;
        const searchTerm = searchInput.value.toLowerCase().trim();

        let filteredData = allPhasesData;

        // 1. กรองด้วย Phase Code (ถ้าเลือก)
        if (selectedPhaseCode !== 'all') {
            filteredData = filteredData.filter(phase => phase.phase_code === selectedPhaseCode);
        }

        // 2. กรองด้วย Search Term (ค้นหาใน Name หรือ Detail)
        if (searchTerm) {
            filteredData = filteredData.filter(phase => 
                (phase.name && phase.name.toLowerCase().includes(searchTerm)) ||
                (phase.phase_code && phase.phase_code.toLowerCase().includes(searchTerm)) || // ค้น Code ด้วย
                (phase.detail && phase.detail.toLowerCase().includes(searchTerm)) // ค้น Detail (อาจจะช้าถ้า Detail ยาวมาก)
            );
        }

        renderTable(filteredData);
    }


    /** Render ตารางข้อมูล */
    function renderTable(phases) {
        if (!phasesTbody) return;

        if (phases.length === 0) {
            phasesTbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">No data matching criteria.</td></tr>';
            return;
        }

        let html = '';
        phases.forEach((phase, index) => {
            const createdDate = phase.created_at ? new Date(phase.created_at).toLocaleDateString('th-TH') : '-';
            
            // สร้างเนื้อหา Detail พร้อม Div ครอบ (สำหรับ CSS)
            const detailContent = phase.detail ? `<div style="white-space: pre-wrap; word-break: break-word;">${phase.detail}</div>` : '-';
            
            // สร้างปุ่ม Actions
            const editButton = `<button class="btn btn-sm btn-link text-warning p-0 ms-1 edit-phase-btn" title="Edit Test Phase" data-id="${phase.id}" title="Edit"><i class="bi bi-marker-tip fs-5"></i></button>`;
            const deleteButton = `<button class="btn btn-sm btn-link text-danger p-0 ms-1 delete-phase-btn" title="Delete Test Phase" data-id="${phase.id}" data-name="${phase.name}" title="Delete"><i class="bi bi-dash-circle fs-5"></i></button>`;

            html += `
                <tr>
                    <td class="text-center">${index + 1}</td>
                    <td class="text-center">${phase.phase_code}</td>
                    <td>${phase.name}</td>
                    <td >${detailContent}</td> 
                    <td class="text-center">${createdDate}</td>
                    <td class="text-center">${editButton} ${deleteButton}</td>
                </tr>
            `;
        });
        phasesTbody.innerHTML = html;
    }

    // --- 4. MODAL & CRUD LOGIC ---
    // (ฟังก์ชัน openAddModal, openEditModal, savePhase, openDeleteModal, deletePhase - เหมือนเดิม แต่ต้องปรับ savePhase ให้เรียก fetchTestPhases หลังสำเร็จ)
    
    function openAddModal() {
        phaseForm.reset(); // ล้างฟอร์ม
        modalPhaseId.value = ''; // ไม่มี ID
        phaseModalLabel.textContent = 'Add New Test Phase'; // ตั้งหัวข้อ
        modalPhaseCode.readOnly = false; // Code แก้ไขได้
        modalPhaseCode.classList.remove('is-invalid'); // ล้างสถานะ Error (ถ้ามี)
        codeDuplicateError.style.display = 'none';
        if (detailQuill) {
            detailQuill.setText(''); // ล้าง Quill Editor
        }
        savePhaseBtn.textContent = 'Save Phase'; // เปลี่ยนข้อความปุ่ม (เผื่อไว้)
        phaseModal.show(); // แสดง Modal
    }

    function openEditModal(phaseId) {
        const phase = allPhasesData.find(p => p.id === phaseId);
        if (!phase) {
            showError('Could not find phase data to edit.');
            return;
        }

        phaseForm.reset(); 
        modalPhaseId.value = phase.id; 
        phaseModalLabel.textContent = 'Edit Test Phase'; 
        modalPhaseCode.value = phase.phase_code;
        modalPhaseCode.readOnly = true; 
        modalPhaseCode.classList.remove('is-invalid');
        codeDuplicateError.style.display = 'none';
        modalPhaseName.value = phase.name;
        modalDisplayOrder.value = phase.display_order || '';
        
        // ✨ (เพิ่ม) ดึงค่า Phase Type มาใส่ Dropdown
        if (phaseCaseType) {
            phaseCaseType.value = phase.phase_type || 'UNIT'; // (ใส่ค่า Default ถ้าไม่มี)
        }

        if (detailQuill) {
            detailQuill.clipboard.dangerouslyPasteHTML(phase.detail || '');
        }
        savePhaseBtn.textContent = 'Save Changes';
        phaseModal.show();
    }

    async function savePhase() {
        // 1. ดึงค่าจากฟอร์ม
        const phaseType = phaseCaseType.value;
        const phaseId = modalPhaseId.value;
        const phaseCode = modalPhaseCode.value.trim().toUpperCase(); // (แนะนำให้เป็นตัวใหญ่)
        const name = modalPhaseName.value.trim();
        const displayOrder = modalDisplayOrder.value ? parseInt(modalDisplayOrder.value) : null;
        const detailHtml = (detailQuill && detailQuill.getLength() > 1) ? detailQuill.root.innerHTML : null;

        // 2. Validate ข้อมูลพื้นฐาน
        if (!phaseCode || !name) {
            showError('Phase Code and Name are required.');
            return;
        }

        // 3. เตรียมข้อมูล (แยก Add/Edit)
        let dataToSubmit = {
            phase_type:phaseType,
            name: name,
            detail: detailHtml,
            display_order: displayOrder
        };
        let isEditMode = !!phaseId; // เช็คว่ามี ID ไหม

        // เพิ่ม User ID และ Timestamp (ทำในนี้เพื่อให้แน่ใจว่ามี)
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userId = user ? user.id : null;

        if (isEditMode) {
            dataToSubmit.updated_at = new Date();
            dataToSubmit.updated_by = userId;
        } else {
            // Add Mode: ต้องเพิ่ม phase_code และ created_by
            dataToSubmit.phase_code = phaseCode;
            dataToSubmit.created_by = userId;
        }

        // 4. (ย้าย Check Duplicate มาไว้ที่นี่)
        if (!isEditMode) { // ตรวจสอบเฉพาะตอน Add
            try {
                const { count, error: checkError } = await supabaseClient
                    .from('test_phases')
                    .select('id', { count: 'exact', head: true })
                    .eq('phase_code', phaseCode);

                if (checkError) throw new Error('Could not verify phase code.');
                if (count > 0) {
                    modalPhaseCode.classList.add('is-invalid');
                    codeDuplicateError.style.display = 'block';
                    throw new Error(`Phase Code "${phaseCode}" already exists.`);
                } else {
                     modalPhaseCode.classList.remove('is-invalid');
                     codeDuplicateError.style.display = 'none';
                }
            } catch (error) {
                 showError(error.message);
                 return; // หยุดถ้าซ้ำ
            }
        }

        // 5. บันทึกข้อมูล
        setSaveButtonLoading(true); // แสดง Loading บนปุ่ม Save
        try {
            let result;
            if (isEditMode) {
                 const { data, error } = await supabaseClient
                    .from('test_phases').update(dataToSubmit)
                    .eq('id', phaseId).select().single();
                 if(error) throw error;
                 result = data;
            } else {
                 const { data, error } = await supabaseClient
                    .from('test_phases').insert(dataToSubmit)
                    .select().single();
                 if(error) throw error;
                 result = data;
            }

            phaseModal.hide();
            await fetchTestPhases(); // Refresh ตารางหลัก
            showSuccess(`Test Phase ${isEditMode ? 'updated' : 'added'} successfully!`);

        } catch (error) {
            console.error('Error saving phase:', error);
            showError(`Failed to save: ${error.message}`);
        } finally {
            setSaveButtonLoading(false); // ซ่อน Loading
        }
    }

    function openDeleteModal(phaseId, phaseName) {
        if (!phaseId || !phaseName) return;
        deletePhaseNameSpan.textContent = phaseName; // แสดงชื่อที่จะลบ
        deletePhaseIdInput.value = phaseId; // เก็บ ID ที่จะลบ
        deletePhaseModal.show(); // แสดง Modal
    }

    async function deletePhase() {
        const deletePhaseId = deletePhaseIdInput.value; // อ่าน ID จาก Input ที่ซ่อนไว้
        if (!deletePhaseId) return;

        confirmDeletePhaseBtn.disabled = true; // ปิดปุ่ม Delete ชั่วคราว

        try {
            // --- 1. ✨ [เพิ่ม] ตรวจสอบการใช้งานก่อนลบ ---
            const { count, error: countError } = await supabaseClient
                .from('test_cases')
                .select('id', { count: 'exact', head: true }) // สั่งนับจำนวน (เร็วมาก)
                .eq('test_phase_id', deletePhaseId);

            if (countError) {
                // ถ้าการนับ Error
                throw new Error(`Failed to check linked test cases: ${countError.message}`);
            }

            // --- 2. ✨ [เพิ่ม] ถ้ามี Test Case ผูกอยู่ ให้หยุด ---
            if (count > 0) {
                throw new Error(`Cannot delete: This phase is already linked to ${count} test case(s).`);
            }

            // --- 3. (เดิม) ถ้า count = 0 ให้ดำเนินการลบ ---
            const { error: deleteError } = await supabaseClient
                .from('test_phases')
                .delete()
                .eq('id', deletePhaseId);
            
            if (deleteError) {
                throw new Error(`Delete failed: ${deleteError.message}`);
            }

            // --- 4. (เดิม) ถ้าลบสำเร็จ ---
            deletePhaseModal.hide();
            await fetchTestPhases(); // Refresh ตารางหลัก
            showSuccess('Test Phase deleted successfully!');

        } catch (error) {
           console.error('Error deleting phase:', error);
           // ✨ ตอนนี้ showError จะแสดงข้อความที่มีประโยชน์ (เช่น "Cannot delete: ...")
           showError(error.message); 
           deletePhaseModal.hide(); 
        } finally {
            confirmDeletePhaseBtn.disabled = false; // เปิดปุ่มคืน
        }
    }
    
    // (ฟังก์ชัน showLoading, showError, showSuccess - ควรมี)
    function setSaveButtonLoading(isLoading) {
        if (!savePhaseBtn) return; // (savePhaseBtn คือ const ที่เราประกาศไว้ด้านบน)

        if (isLoading) {
            // ปิดปุ่ม
            savePhaseBtn.disabled = true;
            // เปลี่ยนข้อความ + ใส่ Spinner
            savePhaseBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Saving...
            `;
        } else {
            // เปิดปุ่ม
            savePhaseBtn.disabled = false;
            // คืนค่าข้อความเดิม
            savePhaseBtn.innerHTML = 'Save Phase'; 
            // (หรือ 'Save Changes' ถ้าเตอร์อยากให้มันฉลาดกว่านี้ แต่ 'Save Phase' ก็ใช้ได้ครับ)
        }
    }

    function showLoading(isLoading){ if(loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none';}
    function showError(msg){ if(errorMessageDiv) { errorMessageDiv.textContent = msg; errorMessageDiv.style.display = 'block'; setTimeout(()=>errorMessageDiv.style.display = 'none', 5000);}}
    function showSuccess(msg){ 
        // อาจจะใช้ Toast ของ Bootstrap แทน Alert
        const successToastEl = document.getElementById('successToast'); // สมมติว่ามี Toast element
        if (successToastEl) {
             const toastBody = successToastEl.querySelector('.toast-body');
             if(toastBody) toastBody.textContent = msg;
             const toast = new bootstrap.Toast(successToastEl);
             toast.show();
        } else { // Fallback to alert
            alert(msg); // Or implement a simple success message div
        }
    }


    // --- 5. EVENT LISTENERS ---
    
    // ✨ [เพิ่ม] Listener สำหรับ Filter ใหม่
    phaseCodeFilter.addEventListener('change', applyFiltersAndRender);
    searchInput.addEventListener('input', applyFiltersAndRender); // Listener Search เดิม
    
    addPhaseBtn.addEventListener('click', openAddModal);
    savePhaseBtn.addEventListener('click', savePhase);
    confirmDeletePhaseBtn.addEventListener('click', deletePhase);

    // Event Delegation สำหรับปุ่ม Edit/Delete ในตาราง
    phasesTbody.addEventListener('click', (event) => {
        const editBtn = event.target.closest('.edit-phase-btn');
        const deleteBtn = event.target.closest('.delete-phase-btn');

        if (editBtn) {
            const phaseId = editBtn.dataset.id;
            // (ตรวจสอบว่ามีฟังก์ชัน openEditModal อยู่ในส่วนที่ 4)
            openEditModal(phaseId); // 👈 (แก้ไข: เอา Comment ออก)
        } else if (deleteBtn) {
            const phaseId = deleteBtn.dataset.id;
            const phaseName = deleteBtn.dataset.name;
            // (ตรวจสอบว่ามีฟังก์ชัน openDeleteModal อยู่ในส่วนที่ 4)
            openDeleteModal(phaseId, phaseName); // 👈 (แก้ไข: เอา Comment ออก)
        }
    });


    // --- 6. INITIALIZATION ---
    initializeQuillEditor(); // Initialize Quill ก่อน
    fetchTestPhases();      // เริ่มโหลดข้อมูล
    

});