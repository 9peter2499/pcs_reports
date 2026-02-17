// =================================================================
// PCS Test Case - Company Management Script (Updated: Delete Logic)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const container = document.getElementById('companies-container');
    const loadingEl = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const stakeholderFilter = document.getElementById('stakeholder-filter');

    // Modal Elements
    const modalEl = document.getElementById('companyModal');
    const modal = new bootstrap.Modal(modalEl);
    const modalLabel = document.getElementById('companyModalLabel');
    const saveBtn = document.getElementById('save-company-btn');
    const addBtn = document.getElementById('add-company-btn');
    const stakeholderContainer = document.getElementById('stakeholder-checks-container');
    const lastUpdatedText = document.getElementById('last-updated-text');

    // Form Inputs
    const formInputs = {
        id: document.getElementById('modal-company-id'),
        name: document.getElementById('modal-name'),
        email: document.getElementById('modal-email'),
        phone: document.getElementById('modal-phone'),
        address: document.getElementById('modal-address'),
        map: document.getElementById('modal-map'),
        contactName: document.getElementById('modal-contact-name'),
        contactPhone: document.getElementById('modal-contact-phone')
    };

    let allCompanies = [];
    let allStakeholderGroups = [];

    // --- 1. Initial Load ---
    async function init() {
        if (typeof supabaseClient === 'undefined') {
            console.error('Supabase client missing');
            return;
        }
        await Promise.all([fetchCompanies(), fetchStakeholderGroups()]);
    }

    // --- 2. Data Fetching ---
    async function fetchCompanies() {
        showLoading(true);
        try {
            const { data, error } = await supabaseClient
                .from('company')
                .select(`
                    *,
                    stakeholder_company_links (
                        stakeholder_groups (id, name)
                    )
                `)
                .order('company_name');

            if (error) throw error;
            allCompanies = data || [];
            applyFilters();

        } catch (err) {
            console.error('Fetch companies error:', err);
            alert('โหลดข้อมูลล้มเหลว: ' + err.message);
        } finally {
            showLoading(false);
        }
    }

    async function fetchStakeholderGroups() {
        try {
            const { data, error } = await supabaseClient
                .from('stakeholder_groups')
                .select('id, name')
                .order('display_order');
            
            if (error) throw error;
            allStakeholderGroups = data || [];
            populateFilterDropdown();
        } catch (err) {
            console.error('Fetch groups error:', err);
        }
    }

    function populateFilterDropdown() {
        if (!stakeholderFilter) return;
        const currentVal = stakeholderFilter.value;
        stakeholderFilter.innerHTML = '<option value="all" selected>ทุกกลุ่ม Stakeholder</option>';
        allStakeholderGroups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            stakeholderFilter.appendChild(opt);
        });
        if (currentVal) stakeholderFilter.value = currentVal;
    }

    // --- 3. Filtering Logic ---
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedGroup = stakeholderFilter.value;

        const filtered = allCompanies.filter(c => {
            const matchesSearch = 
                (c.company_name && c.company_name.toLowerCase().includes(searchTerm)) ||
                (c.contact_person && c.contact_person.toLowerCase().includes(searchTerm)) ||
                (c.phone && c.phone.includes(searchTerm));

            let matchesGroup = true;
            if (selectedGroup !== 'all') {
                const links = c.stakeholder_company_links || [];
                matchesGroup = links.some(link => link.stakeholder_groups?.id === selectedGroup);
            }
            return matchesSearch && matchesGroup;
        });
        renderCompanies(filtered);
    }

    // --- 4. Rendering ---
    function renderCompanies(companies) {
        container.innerHTML = '';
        
        if (companies.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.style.display = 'flex';

        companies.forEach(com => {
            let groupsHtml = '';
            if (com.stakeholder_company_links && com.stakeholder_company_links.length > 0) {
                groupsHtml = com.stakeholder_company_links.map(link => 
                    `<span class="badge bg-info-subtle text-info-emphasis me-1 mb-1">${link.stakeholder_groups?.name || '-'}</span>`
                ).join('');
            } else {
                groupsHtml = '<span class="badge bg-light text-muted border">ไม่ระบุกลุ่ม</span>';
            }

            const updatedDate = com.updated_at ? new Date(com.updated_at).toLocaleDateString('th-TH') : '-';

            const cardHtml = `
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100 shadow-sm border-0 company-card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="fw-bold text-primary mb-0 text-truncate" title="${com.company_name}" style="max-width: 70%;">${com.company_name}</h5>
                                
                                <!-- Action Buttons -->
                                <div class="d-flex gap-1">
                                    <button class="btn btn-sm btn-light edit-btn rounded-circle text-secondary" title="แก้ไข" data-id="${com.company_id}">
                                        <i class="bi bi-pencil-fill"></i>
                                    </button>
                                    <button class="btn btn-sm btn-light delete-btn rounded-circle text-danger" title="ลบข้อมูล" data-id="${com.company_id}" data-name="${com.company_name}">
                                        <i class="bi bi-trash-fill"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                ${groupsHtml}
                            </div>

                            <div class="contact-info mb-1">
                                <i class="bi bi-geo-alt contact-icon"></i> ${com.address || '-'}
                            </div>
                            <div class="contact-info mb-1">
                                <i class="bi bi-telephone contact-icon"></i> ${com.phone || '-'}
                            </div>
                            <div class="contact-info mb-3">
                                <i class="bi bi-person-badge contact-icon"></i> Contact: ${com.contact_person || '-'}
                            </div>

                            <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                                <small class="text-muted" style="font-size: 0.75rem;">Updated: ${updatedDate}</small>
                                ${com.map_link ? `<a href="${com.map_link}" target="_blank" class="btn btn-sm btn-outline-success"><i class="bi bi-map"></i> Map</a>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });
    }

    // --- 5. Delete Logic (New Function) ---
    async function handleDelete(id, name) {
        if (!confirm(`ต้องการลบบริษัท "${name}" ใช่หรือไม่?`)) return;

        showLoading(true);

        try {
            // Step 1: ตรวจสอบการใช้งาน User
            const { count: userCount, error: userError } = await supabaseClient
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', id);

            if (userError) throw userError;

            if (userCount > 0) {
                alert(`❌ ไม่สามารถลบได้\n\nมีผู้ใช้งาน (Users) จำนวน ${userCount} คน สังกัดบริษัทนี้อยู่\nกรุณาย้ายหรือลบผู้ใช้งานออกก่อนที่เมนู Setup > กำหนดสิทธิ์ผู้ใช้งาน`);
                showLoading(false);
                return;
            }

            // Step 2: ตรวจสอบการใช้งาน Test Case
            const { count: tcCount, error: tcError } = await supabaseClient
                .from('company_test_case_links')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', id);

            if (tcError) throw tcError;

            if (tcCount > 0) {
                alert(`❌ ไม่สามารถลบได้\n\nบริษัทนี้มีการผูกกับ Test Case จำนวน ${tcCount} รายการ\nกรุณายกเลิกการจับคู่ Test Case ก่อนที่เมนู Setup > ติดตั้งบริษัท`);
                showLoading(false);
                return;
            }

            // Step 3: ลบข้อมูล (ผ่านการตรวจสอบแล้ว)
            const { error: deleteError } = await supabaseClient
                .from('company')
                .delete()
                .eq('company_id', id);

            if (deleteError) throw deleteError;

            alert(`✅ ลบบริษัท "${name}" เรียบร้อยแล้ว`);
            await fetchCompanies(); // Refresh ข้อมูล

        } catch (err) {
            console.error("Delete error:", err);
            alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
            showLoading(false);
        }
    }

    // --- 6. Event Listeners ---
    searchInput.addEventListener('input', applyFilters);
    stakeholderFilter.addEventListener('change', applyFilters);

    // Event Delegation for Edit & Delete buttons
    container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            openModal(editBtn.dataset.id);
        } else if (deleteBtn) {
            handleDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
        }
    });

    addBtn.addEventListener('click', () => openModal());
    
    // ... (ส่วน Modal Logic เดิม: openModal, renderGroupCheckboxes, saveBtn.addEventListener) ...
    // Copy โค้ดส่วน Modal เดิมมาใส่ตรงนี้ได้เลยครับ (ไม่มีการเปลี่ยนแปลง Logic ภายใน Modal)
    
    // (เพื่อความสมบูรณ์ ผมใส่ Code Modal เดิมให้ครับ)
    function openModal(companyId = null) {
        document.getElementById('company-form').reset();
        formInputs.id.value = '';
        lastUpdatedText.innerText = '';
        renderGroupCheckboxes([]);

        if (companyId) {
            const com = allCompanies.find(c => String(c.company_id) === String(companyId));
            if (!com) return;

            modalLabel.innerText = 'แก้ไขข้อมูลบริษัท';
            formInputs.id.value = com.company_id;
            formInputs.name.value = com.company_name || '';
            formInputs.email.value = com.email || '';
            formInputs.phone.value = com.phone || '';
            formInputs.address.value = com.address || '';
            formInputs.map.value = com.map_link || '';
            formInputs.contactName.value = com.contact_person || '';
            formInputs.contactPhone.value = com.contact_phone || '';
            
            lastUpdatedText.innerText = `Last Updated: ${com.updated_at ? new Date(com.updated_at).toLocaleString('th-TH') : '-'}`;

            const currentGroupIds = com.stakeholder_company_links?.map(l => l.stakeholder_groups?.id) || [];
            renderGroupCheckboxes(currentGroupIds);
        } else {
            modalLabel.innerText = 'เพิ่มบริษัทใหม่';
            lastUpdatedText.innerText = '';
        }
        modal.show();
    }

    function renderGroupCheckboxes(checkedIds) {
        stakeholderContainer.innerHTML = '';
        allStakeholderGroups.forEach(g => {
            const isChecked = checkedIds.includes(g.id);
            const div = document.createElement('div');
            div.className = 'form-check form-check-inline mb-2 col-5'; 
            div.innerHTML = `
                <input class="form-check-input group-checkbox" type="checkbox" value="${g.id}" id="g-${g.id}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label small" for="g-${g.id}">${g.name}</label>
            `;
            stakeholderContainer.appendChild(div);
        });
    }

    saveBtn.addEventListener('click', async () => {
        const id = formInputs.id.value;
        const name = formInputs.name.value.trim();
        if (!name) { alert('กรุณาระบุชื่อบริษัท'); return; }

        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';

        try {
            const payload = {
                company_name: name,
                email: formInputs.email.value.trim(),
                phone: formInputs.phone.value.trim(),
                address: formInputs.address.value.trim(),
                map_link: formInputs.map.value.trim(),
                contact_person: formInputs.contactName.value.trim(),
                contact_phone: formInputs.contactPhone.value.trim(),
                updated_at: new Date()
            };

            let savedCompanyId;
            if (id) {
                const { error } = await supabaseClient.from('company').update(payload).eq('company_id', id);
                if (error) throw error;
                savedCompanyId = id;
            } else {
                const { data, error } = await supabaseClient.from('company').insert(payload).select('company_id').single();
                if (error) throw error;
                savedCompanyId = data.company_id;
            }

            const selectedGroupIds = Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.value);
            await supabaseClient.from('stakeholder_company_links').delete().eq('company_id', savedCompanyId);

            if (selectedGroupIds.length > 0) {
                const links = selectedGroupIds.map(gid => ({ company_id: savedCompanyId, group_id: gid }));
                const { error: linkError } = await supabaseClient.from('stakeholder_company_links').insert(links);
                if (linkError) throw linkError;
            }

            modal.hide();
            fetchCompanies(); 

        } catch (err) {
            console.error(err);
            alert('บันทึกไม่สำเร็จ: ' + err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = 'บันทึกข้อมูล';
        }
    });

    function showLoading(show) {
        loadingEl.style.display = show ? 'block' : 'none';
        if(show) container.style.display = 'none';
    }

    // Init
    init();
});