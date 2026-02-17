// =================================================================
// PCS Test Case - Stakeholder Matrix Mapping Script
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const stakeholderSelect = document.getElementById('stakeholder-select');
    const moduleFilter = document.getElementById('module-filter');
    const searchInput = document.getElementById('search-input');
    const showSelectedSwitch = document.getElementById('show-selected-only');
    const saveBtn = document.getElementById('save-mapping-btn');
    const tbody = document.getElementById('mapping-tbody');

    // Data Stores
    let allTORs = [];
    let currentLinks = new Set(); // เก็บ TOR IDs ที่กลุ่มปัจจุบันเลือกไว้
    let currentGroupId = null;

    // --- 1. Initial Load ---
    async function init() {
        if (typeof supabaseClient === 'undefined') {
            console.error('Supabase client not found.');
            return;
        }

        await Promise.all([
            fetchStakeholderGroups(),
            fetchModules(),
            fetchTORs() // โหลด TORs ทั้งหมดมารอไว้
        ]);
    }

    // --- 2. Data Fetching ---

    async function fetchStakeholderGroups() {
        const { data, error } = await supabaseClient
            .from('stakeholder_groups')
            .select('id, name')
            .order('display_order');
        
        if (error) { console.error(error); return; }

        data.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            stakeholderSelect.appendChild(opt);
        });
    }

    async function fetchModules() {
        const { data, error } = await supabaseClient
            .from('Modules') // หรือ pcs_module ตามที่คุณใช้จริง
            .select('module_id, module_name')
            .order('module_id');

        if (error) return;

        data.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.module_id;
            opt.textContent = m.module_name;
            moduleFilter.appendChild(opt);
        });
    }

    async function fetchTORs() {
        // ดึง TORs และ Join กับ Module เพื่อมาแสดงผล
        const { data, error } = await supabaseClient
            .from('TORs')
            .select(`
                tor_id, 
                tor_name, 
                module_id,
                Modules ( module_name )
            `)
            .order('tor_id'); // เรียงตามเลขข้อ 1.1, 1.2...

        if (error) {
            console.error('Error fetching TORs:', error);
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Failed to load TORs: ${error.message}</td></tr>`;
            return;
        }

        allTORs = data || [];
    }

    async function fetchGroupLinks(groupId) {
        // ดึงข้อมูลการจับคู่ที่มีอยู่แล้ว (X ใน Excel)
        const { data, error } = await supabaseClient
            .from('stakeholder_tor_links')
            .select('tor_id')
            .eq('group_id', groupId);

        if (error) { console.error(error); return; }

        currentLinks = new Set(data.map(item => item.tor_id));
        renderTable();
    }

    // --- 3. Rendering ---

    function renderTable() {
        if (!currentGroupId) return;

        const modVal = moduleFilter.value;
        const searchVal = searchInput.value.toLowerCase().trim();
        const onlySelected = showSelectedSwitch.checked;

        tbody.innerHTML = '';

        let visibleCount = 0;

        allTORs.forEach(tor => {
            // Filter Logic
            const isChecked = currentLinks.has(tor.tor_id);
            
            // 1. Show Selected Only
            if (onlySelected && !isChecked) return;

            // 2. Module Filter
            if (modVal !== 'all' && tor.module_id !== modVal) return;

            // 3. Search Filter
            if (searchVal) {
                const text = `${tor.tor_id} ${tor.tor_name}`.toLowerCase();
                if (!text.includes(searchVal)) return;
            }

            visibleCount++;

            // Render Row
            const tr = document.createElement('tr');
            if (isChecked) tr.classList.add('table-success'); // Highlight แถวที่เลือก

            const moduleName = tor.Modules?.module_name || '-';

            tr.innerHTML = `
                <td class="text-center">
                    <input class="form-check-input tor-checkbox" type="checkbox" 
                        value="${tor.tor_id}" 
                        ${isChecked ? 'checked' : ''}
                        style="transform: scale(1.2);">
                </td>
                <td class="fw-bold text-primary">${tor.tor_id}</td>
                <td>${tor.tor_name}</td>
                <td class="small text-muted">${moduleName}</td>
                <td><span class="badge bg-light text-dark border">${isChecked ? 'Mapped' : '-'}</span></td>
            `;

            tbody.appendChild(tr);
        });

        if (visibleCount === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">ไม่พบข้อมูลตามเงื่อนไข</td></tr>`;
        }
    }

    // --- 4. Event Listeners ---

    stakeholderSelect.addEventListener('change', (e) => {
        currentGroupId = e.target.value;
        if (currentGroupId) {
            saveBtn.disabled = false;
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-5"><div class="spinner-border text-primary"></div><div class="mt-2">กำลังโหลดข้อมูล Matrix...</div></td></tr>`;
            fetchGroupLinks(currentGroupId);
        } else {
            saveBtn.disabled = true;
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">กรุณาเลือกกลุ่ม Stakeholder</td></tr>`;
        }
    });

    moduleFilter.addEventListener('change', renderTable);
    searchInput.addEventListener('input', renderTable);
    showSelectedSwitch.addEventListener('change', renderTable);

    // Click Row to Toggle Checkbox
    tbody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        if (!tr || e.target.type === 'checkbox') return; // ถ้าคลิกที่ checkbox โดยตรงให้ทำงานปกติ
        
        const checkbox = tr.querySelector('.tor-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            // Update Visual Class
            if (checkbox.checked) tr.classList.add('table-success');
            else tr.classList.remove('table-success');
        }
    });

    // Update Visual on Checkbox Change
    tbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('tor-checkbox')) {
            const tr = e.target.closest('tr');
            if (e.target.checked) tr.classList.add('table-success');
            else tr.classList.remove('table-success');
        }
    });

    // --- 5. Save Logic ---

    saveBtn.addEventListener('click', async () => {
        if (!currentGroupId) return;

        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> กำลังบันทึก...`;

        try {
            // 1. รวบรวม TOR ID ที่ถูกติ๊ก (จาก UI + ที่มีอยู่เดิมแต่ถูกซ่อนโดย Filter)
            // วิธีที่ปลอดภัยคือ:
            // - เอา currentLinks เดิมตั้งต้น
            // - วนลูป checkbox ในหน้าจอ:
            //   - ถ้า checked -> add เข้า set
            //   - ถ้า unchecked -> delete ออกจาก set
            
            const checkboxes = document.querySelectorAll('.tor-checkbox');
            checkboxes.forEach(cb => {
                if (cb.checked) {
                    currentLinks.add(cb.value);
                } else {
                    currentLinks.delete(cb.value);
                }
            });

            const finalTorIds = Array.from(currentLinks);

            // 2. ส่งไปบันทึก (ลบของเก่า Insert ของใหม่)
            // เทคนิค: ใช้ RPC หรือ Delete/Insert ธรรมดา
            // เพื่อความง่าย ใช้ Delete All for Group -> Insert New
            
            // 2.1 ลบของเดิมทั้งหมดของกลุ่มนี้
            const { error: delError } = await supabaseClient
                .from('stakeholder_tor_links')
                .delete()
                .eq('group_id', currentGroupId);
            
            if (delError) throw delError;

            // 2.2 Insert ของใหม่ (ถ้ามี)
            if (finalTorIds.length > 0) {
                const records = finalTorIds.map(torId => ({
                    group_id: currentGroupId,
                    tor_id: torId
                }));
                
                // Supabase Insert limits (batch insert recommended for large data)
                const { error: insError } = await supabaseClient
                    .from('stakeholder_tor_links')
                    .insert(records);
                
                if (insError) throw insError;
            }

            alert('บันทึกข้อมูล Matrix เรียบร้อยแล้ว!');
            fetchGroupLinks(currentGroupId); // Refresh เพื่อความชัวร์

        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="bi bi-save me-1"></i> บันทึกการจับคู่`;
        }
    });

    // Start
    init();
});