// =================================================================
// PCS Test Case - Stakeholder Management Script (Final Fixed)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------
    // 1. CONFIG: ตั้งค่า Role จำลอง (True=Admin / False=User)
    // -----------------------------------------------------------
    const isUserAdmin = false; 

    // -----------------------------------------------------------
    // 2. DOM Elements & Setup
    // -----------------------------------------------------------
    const container = document.getElementById('stakeholders-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    
    // ปุ่มด้านบน (Top Actions)
    const addBtn = document.getElementById('add-group-btn');
    const mappingBtn = document.querySelector('a[href*="mapping"]');

    // Modal Elements (ประกาศไว้เพื่อป้องกัน Error แม้ไม่ได้ใช้ในโหมด User)
    const groupModalEl = document.getElementById('groupModal');
    let groupModal = null;
    if (groupModalEl) {
        groupModal = new bootstrap.Modal(groupModalEl);
    }
    
    const modalIdInput = document.getElementById('modal-group-id');
    const modalNameInput = document.getElementById('modal-group-name');
    const modalDescInput = document.getElementById('modal-group-desc');
    const modalOrderInput = document.getElementById('modal-display-order');
    const saveBtn = document.getElementById('save-group-btn');
    const modalTitle = document.getElementById('groupModalLabel');

    let allGroups = [];

    // -----------------------------------------------------------
    // 3. Initialize UI based on Role
    // -----------------------------------------------------------
    function initRoleUI() {
        if (!isUserAdmin) {
            // User: ซ่อนปุ่ม Admin ด้านบน
            if (addBtn) addBtn.style.display = 'none';
            if (mappingBtn) mappingBtn.style.display = 'none';
        } else {
            // Admin: แสดงครบ
            if (addBtn) addBtn.style.display = 'inline-block';
            if (mappingBtn) mappingBtn.style.display = 'inline-block';
        }
    }

    // -----------------------------------------------------------
    // 4. Data Fetching
    // -----------------------------------------------------------
    async function fetchGroups() {
        initRoleUI();
        showLoading(true);
        
        try {
            // Query ข้อมูล Group พร้อม Count
            const { data, error } = await supabaseClient
                .from('stakeholder_groups')
                .select(`
                    *,
                    stakeholder_company_links (count),
                    stakeholder_tor_links (count)
                `)
                .order('display_order', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            allGroups = data || [];
            renderGroups(allGroups);

        } catch (err) {
            console.error('Error fetching groups:', err);
            container.innerHTML = `<div class="alert alert-danger w-100">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}</div>`;
        } finally {
            showLoading(false);
        }
    }

    // -----------------------------------------------------------
    // 5. Rendering (หัวใจสำคัญ: การสร้าง Card)
    // -----------------------------------------------------------
    function renderGroups(groups) {
        container.innerHTML = '';

        if (!groups || groups.length === 0) {
            container.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        container.style.display = 'flex'; // หรือ row

        groups.forEach(group => {
            // Logic ดึงตัวเลขที่ปลอดภัย (กัน Error null/undefined)
            const companyArr = group.stakeholder_company_links || [];
            const torArr = group.stakeholder_tor_links || [];
            
            const companyCount = companyArr.length > 0 ? companyArr[0].count : 0;
            const torCount = torArr.length > 0 ? torArr[0].count : 0;

            // สร้าง Element Column
            const cardCol = document.createElement('div');
            // กำหนดขนาด Grid: 4 ใบต่อแถว (บนจอใหญ่)
            cardCol.className = 'col-md-6 col-lg-3 col-xl-3'; 

            // --- เตรียม HTML ตาม Role ---
            let headerActionHtml = '';
            let footerActionHtml = '';

            if (isUserAdmin) {
                // [ADMIN MODE] ปุ่ม 3 จุด
                headerActionHtml = `
                    <div class="dropdown action-buttons">
                        <button class="btn btn-sm btn-light rounded-circle text-muted" type="button" data-bs-toggle="dropdown" style="width: 30px; height: 30px; padding: 0;">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                            <li><a class="dropdown-item text-success download-btn" href="#" data-id="${group.id}"><i class="bi bi-file-earmark-excel me-2"></i>Download Test Case</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item edit-btn" href="#" data-id="${group.id}"><i class="bi bi-pencil me-2 text-warning"></i>แก้ไข</a></li>
                            <li><a class="dropdown-item text-danger delete-btn" href="#" data-id="${group.id}" data-name="${group.name}"><i class="bi bi-trash me-2"></i>ลบ</a></li>
                        </ul>
                    </div>`;
            } else {
                // [USER MODE] ปุ่ม Download ด้านล่าง
                headerActionHtml = ''; 
                footerActionHtml = `
                    <div class="mt-3 pt-2 border-top text-center">
                        <button class="btn btn-success btn-sm w-100 download-btn shadow-sm" data-id="${group.id}">
                            <i class="bi bi-file-earmark-excel me-1"></i> Download Test Case
                        </button>
                    </div>`;
            }

            // --- HTML ของการ์ด ---
            cardCol.innerHTML = `
                <div class="card h-100 shadow-sm border-0 stakeholder-card">
                    <div class="card-body p-3 d-flex flex-column">
                        
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="text-truncate pe-2" style="max-width: ${isUserAdmin ? '85%' : '100%'};">
                                <h6 class="card-title text-primary mb-1 text-truncate fw-bold" title="${group.name}" style="font-size: 1rem;">
                                    ${group.name}
                                </h6>
                            </div>
                            ${headerActionHtml}
                        </div>
                        
                        <p class="card-text text-muted small flex-grow-1 mb-3" style="font-size: 0.85rem; min-height: 40px; line-height: 1.4;">
                            ${group.description || '-'}
                        </p>

                        <div class="d-flex justify-content-between align-items-center mt-auto">
                            <a href="/stakeholder-detail.html?id=${group.id}" class="text-decoration-none" title="คลิกเพื่อดูรายชื่อบริษัท">
                                <span class="stat-badge" style="font-size: 0.75rem; background: #f8f9fa; padding: 4px 8px; border-radius: 12px; border: 1px solid #eee; cursor: pointer; color: #6c757d;">
                                    <i class="bi bi-building-fill text-secondary me-1"></i> ${companyCount}
                                </span>
                            </a>

                            <a href="/stakeholder-detail.html?id=${group.id}" class="text-decoration-none" title="คลิกเพื่อดูขอบเขตงานทดสอบ">
                                <span class="stat-badge" style="font-size: 0.75rem; background: #e6f4ea; color: #198754; padding: 4px 8px; border-radius: 12px; border: 1px solid #c3e6cb; cursor: pointer;">
                                    <i class="bi bi-file-earmark-text-fill me-1"></i> ${torCount} TORs
                                </span>
                            </a>
                        </div>

                        ${footerActionHtml}

                    </div>
                </div>
            `;
            
            container.appendChild(cardCol);
        });
    }

    // -----------------------------------------------------------
    // 6. Event Handlers (คลิกปุ่มต่างๆ)
    // -----------------------------------------------------------
    container.addEventListener('click', (e) => {
        // Handle Download (ใช้ได้ทั้ง User/Admin)
        const downloadBtn = e.target.closest('.download-btn');
        if (downloadBtn) {
            e.preventDefault();
            const id = downloadBtn.dataset.id;
            exportStakeholderExcel(id);
            return;
        }

        // Handle Edit/Delete (เฉพาะ Admin)
        if (isUserAdmin) {
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                e.preventDefault();
                const id = editBtn.dataset.id;
                const group = allGroups.find(g => g.id === id);
                if(group && groupModal) {
                    modalTitle.textContent = 'แก้ไขกลุ่ม Stakeholder';
                    modalIdInput.value = group.id;
                    modalNameInput.value = group.name;
                    modalDescInput.value = group.description || '';
                    modalOrderInput.value = group.display_order || 0;
                    groupModal.show();
                }
            }
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.preventDefault();
                const id = deleteBtn.dataset.id;
                handleDelete(id, deleteBtn.dataset.name);
            }
        }
    });

    // Create New Group (Admin Only)
    if (isUserAdmin && addBtn) {
        addBtn.addEventListener('click', () => {
             if(groupModal) {
                 modalTitle.textContent = 'สร้างกลุ่ม Stakeholder ใหม่';
                 modalIdInput.value = '';
                 modalNameInput.value = '';
                 modalDescInput.value = '';
                 modalOrderInput.value = allGroups.length + 1;
                 groupModal.show();
             }
        });
    }

    // Save Logic
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const id = modalIdInput.value;
            const name = modalNameInput.value.trim();
            const desc = modalDescInput.value.trim();
            const order = parseInt(modalOrderInput.value) || 0;

            if (!name) return alert('กรุณาระบุชื่อกลุ่ม');

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> กำลังบันทึก...';

            try {
                const payload = { name: name, description: desc, display_order: order, updated_at: new Date() };
                let error;
                if (id) {
                    const { error: upError } = await supabaseClient.from('stakeholder_groups').update(payload).eq('id', id);
                    error = upError;
                } else {
                    const { error: inError } = await supabaseClient.from('stakeholder_groups').insert(payload);
                    error = inError;
                }
                if (error) throw error;
                if(groupModal) groupModal.hide();
                fetchGroups();
            } catch (err) {
                console.error(err);
                alert('Error: ' + err.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'บันทึก';
            }
        });
    }

    async function handleDelete(id, name) {
        if(!confirm('Delete ' + name + '?')) return;
        const { error } = await supabaseClient.from('stakeholder_groups').delete().eq('id', id);
        if(!error) fetchGroups();
    }

    function showLoading(isLoading) {
        if (loadingIndicator) {
            loadingIndicator.style.display = isLoading ? 'block' : 'none';
        }
        if (container) {
            container.style.display = isLoading ? 'none' : 'flex';
        }
    }

    // Run Init
    if (typeof supabaseClient !== 'undefined') {
        fetchGroups();
    } else {
        container.innerHTML = '<p class="text-danger text-center">Supabase Client Missing!</p>';
    }

});

// =================================================================
// STAKEHOLDER EXCEL EXPORT (Dual Mode: Draft & Final)
// =================================================================

// --- 1. Helper Functions ---
function stkFormatHtml(html) {
    if (!html) return "";
    let text = html.toString()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<li>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/&nbsp;/gi, ' ');
    let tmp = document.createElement("DIV");
    tmp.innerHTML = text;
    return (tmp.textContent || tmp.innerText || "").trim();
}

function showLoadingOverlay() {
    let overlay = document.getElementById('excel-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'excel-loading-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;';
        overlay.innerHTML = `
            <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status"></div>
            <div style="font-size: 1.5rem; margin-top: 15px; font-weight:bold;">กำลังสร้างไฟล์ Excel...</div>
            <div id="loading-text" style="margin-top: 5px; opacity: 0.8;">ระบบกำลังเตรียมข้อมูลและจัด Format</div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('excel-loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function updateLoadingText(text) {
    const el = document.getElementById('loading-text');
    if(el) el.innerText = text;
}

// --- 2. Configuration ---
const PCS_MODULE_NAMES = {
    '01': 'General', '02': 'Vessel', '03': 'Import', '04': 'Customs',
    '05': 'Export', '06': 'ContainerCargo', '07': 'Hinterland', '08': 'Banking',
    '09': 'PCSIntelligence', '10': 'SetupUtility', '11': 'Administration', '12': 'Report'
};

// --- 3. Main Function ---
// param: isFinal (true = Final No Edit, false = Draft Editable)
async function exportStakeholderExcel(stakeholderGroupId, isFinal = false) {
    if (!stakeholderGroupId) return alert("ไม่พบ Group ID");

    showLoadingOverlay();

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PCS System';
        workbook.created = new Date();

        // 3.1 Fetch Group Name
        updateLoadingText("กำลังดึงข้อมูลกลุ่มผู้ใช้งาน...");
        const { data: groupData } = await supabaseClient
            .from('stakeholder_groups').select('name').eq('id', stakeholderGroupId).single();
        const groupName = groupData ? groupData.name.replace(/[^a-zA-Z0-9ก-๙\- ]/g, '') : 'UnknownGroup';

        // 3.2 Fetch Linked TORs
        updateLoadingText("กำลังดึงรายการ TOR...");
        const { data: links, error: linkError } = await supabaseClient
            .from('stakeholder_tor_links')
            .select(`tor_id, TORs (tor_id, tor_name, module_id, Modules (module_name))`)
            .eq('group_id', stakeholderGroupId);

        if (linkError) throw linkError;
        if (!links || links.length === 0) throw new Error("กลุ่มนี้ยังไม่มีการผูก TOR");

        // 3.3 Group TORs by Module
        const torsByModule = {};
        links.forEach(link => {
            const tor = link.TORs;
            if (!tor) return;
            
            // Extract Module ID (e.g. '01', '02')
            let modId = '99';
            const rawId = String(tor.module_id || '');
            const match = rawId.match(/\d+/);
            if (match) modId = String(parseInt(match[0], 10)).padStart(2, '0');

            if (!torsByModule[modId]) torsByModule[modId] = [];
            torsByModule[modId].push(tor);
        });

        // 3.4 Generate Reference Data
        const dataDate = new Date();
        const yyyy = dataDate.getFullYear();
        const mm = String(dataDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dataDate.getDate()).padStart(2, '0');
        const hh = String(dataDate.getHours()).padStart(2, '0');
        const min = String(dataDate.getMinutes()).padStart(2, '0');
        
        const statusSuffix = isFinal ? "FINAL" : "DRAFT";
        // Ref ID: REF-GRP-{GroupIDFirst4Chars}-{Date}
        const shortGrpId = stakeholderGroupId.substring(0, 4).toUpperCase();
        const refId = `REF-GRP-${shortGrpId}-${yyyy}${mm}${dd}-${hh}${min}-${statusSuffix}`;
        const dataAsOfStr = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

        // ---------------------------------------------------------
        // SHEET 1: INSTRUCTION
        // ---------------------------------------------------------
        const sheetInstr = workbook.addWorksheet('READ ME (คำแนะนำ)');
        sheetInstr.getColumn('A').width = 8;
        sheetInstr.getColumn('B').width = 90;

        const instrTitle = sheetInstr.getCell('B2');
        instrTitle.value = isFinal ? 
            "คำแนะนำ: เอกสารฉบับสมบูรณ์ (Final Version)" : 
            "คำแนะนำ: การตรวจสอบและแก้ไข Test Case (Draft Version)";
        instrTitle.font = { size: 16, bold: true, color: { argb: 'FF1F4E78' } };

        let instructions = [];
        if (isFinal) {
            instructions = [
                { title: "1. เอกสารฉบับสมบูรณ์ (Final Version)", detail: "เอกสารนี้เป็นเวอร์ชันสรุปสุดท้ายสำหรับการทดสอบ (Test Execution) สำหรับกลุ่มผู้ใช้งานนี้" },
                { title: "2. การอ้างอิง (Reference)", detail: `ข้อมูล ณ วันที่: ${dataAsOfStr}\nReference ID: ${refId}\n(กรุณาใช้ Ref ID นี้ในการอ้างอิง)` },
                { title: "3. การแก้ไขข้อมูล", detail: "หากต้องการแก้ไขข้อมูล กรุณาติดต่อ Admin เพื่อทำการปรับปรุงในระบบ" }
            ];
        } else {
            instructions = [
                { title: "1. ห้ามแก้ไขข้อมูลเดิม (Do Not Edit Original)", detail: "ช่องสีเทาคือข้อมูลตั้งต้นจากระบบ ห้ามแก้ไขโดยเด็ดขาด" },
                { title: "2. การแจ้งแก้ไข (Modify/Delete)", detail: "เลือก 'Change Status' เป็น Modify/Delete แล้วกรอกข้อมูลใหม่ในช่องสีขาว" },
                { title: "3. การเพิ่มรายการใหม่ (Add New)", detail: "เลื่อนลงล่างสุดเพื่อเพิ่ม Test Case ใหม่ในโซน 'New Items'" },
                { title: "4. Version Control", detail: `Ref ID: ${refId}\nโปรดตรวจสอบ Ref ID ทุกครั้งก่อนเริ่มทำงาน` }
            ];
        }

        let currentRow = 4;
        instructions.forEach(inst => {
            const cellTitle = sheetInstr.getCell(`B${currentRow}`);
            cellTitle.value = inst.title;
            cellTitle.font = { bold: true, size: 12 };
            currentRow++;
            const cellDetail = sheetInstr.getCell(`B${currentRow}`);
            cellDetail.value = inst.detail;
            cellDetail.alignment = { wrapText: true };
            currentRow += 2;
        });
        await sheetInstr.protect('pcs1234', { selectLockedCells: true, selectUnlockedCells: true });


        // ---------------------------------------------------------
        // SHEET 2+: MODULE SHEETS (Loop Modules)
        // ---------------------------------------------------------
        const sortedModuleIds = Object.keys(torsByModule).sort();

        for (const modId of sortedModuleIds) {
            const torsInModule = torsByModule[modId];
            if (!torsInModule || torsInModule.length === 0) continue;

            const sheetNamePrefix = PCS_MODULE_NAMES[modId] || `Module-${modId}`;
            const sheetName = sheetNamePrefix.substring(0, 31); // Safe Name
            let worksheet;
            try {
                worksheet = workbook.addWorksheet(sheetName);
            } catch (e) {
                worksheet = workbook.addWorksheet(`Mod-${modId}`);
            }

            updateLoadingText(`สร้าง Sheet: ${sheetName}...`);

            // --- Columns Config ---
            if (isFinal) {
                worksheet.columns = [
                    { width: 35 }, { width: 45 }, { width: 8 }, 
                    { width: 45 }, { width: 45 }, { width: 15 }, { width: 30 }
                ];
            } else {
                worksheet.columns = [
                    { width: 35 }, { width: 45 }, { width: 8 }, 
                    { width: 45 }, { width: 45 }, // Original
                    { width: 15 }, { width: 45 }, { width: 45 }, // Edit
                    { width: 15 }, { width: 30 }
                ];
            }

            let currentRowIndex = 1;

            // --- Loop TORs in this Module ---
            for (const tor of torsInModule) {
                // Fetch Detail
                const { data: torDetail } = await supabaseClient.from('TORDetail')
                    .select('tord_header, tord_prototype').eq('tor_id', tor.tor_id).maybeSingle();

                // Fetch Test Cases
                const { data: testData } = await supabaseClient.from('tor_test_case_links')
                    .select(`test_cases (id, test_id_code, name, pcs_module_id, pcs_module:pcs_module_id(name), scenarios(id, scenario_id_code, name, action, expected_result, information))`)
                    .eq('tor_id', tor.tor_id);
                
                if (testData) {
                    testData.sort((a, b) => (a.test_cases?.test_id_code || "").localeCompare(b.test_cases?.test_id_code || ""));
                }

                // Header Info
                let pcsModuleName = testData?.[0]?.test_cases?.pcs_module?.name || "Unknown";
                const nameParts = pcsModuleName.split('-');
                let moduleNameHeader = pcsModuleName.startsWith("Co-Service") ? "Co-Service" : (nameParts[0]?.trim() || "-");
                let functionNameHeader = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : "-";

                // 🔥 Separator Row
                const separatorRow = worksheet.getRow(currentRowIndex);
                worksheet.mergeCells(`A${currentRowIndex}:${isFinal?'G':'J'}${currentRowIndex}`);
                const sepCell = separatorRow.getCell(1);
                sepCell.value = `${sheetName} - ${tor.tor_name}`;
                sepCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006400' } }; // Dark Green
                sepCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
                sepCell.alignment = { vertical: 'middle' };
                separatorRow.height = 30;
                currentRowIndex++;

                // Main Header Block
                const headerRows = [
                    ['Project Name :', 'Port Community System'],
                    ['Application Name :', 'Port Community System'],
                    ['Module :', moduleNameHeader], 
                    ['Function :', functionNameHeader],
                    ['Path :', pcsModuleName],
                    ['Data As Of :', dataAsOfStr], // 🔥 Row +5
                    ['Reference ID :', refId]      // 🔥 Row +6
                ];

                headerRows.forEach((data, idx) => {
                    const r = worksheet.getRow(currentRowIndex + idx);
                    r.getCell(1).value = data[0]; r.getCell(2).value = data[1];
                    const cellA = r.getCell(1);
                    cellA.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; // Blue
                    r.getCell(2).alignment = { wrapText: true };

                    // Highlight Date & Ref
                    if (idx === 5 || idx === 6) {
                        cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }; // Red
                        r.getCell(2).font = { size: 12, bold: true, color: { argb: 'FFC00000' } };
                        r.getCell(2).border = { bottom: {style:'double', color: {argb:'FFC00000'}} };
                    }
                });
                currentRowIndex += 7;

                // TOR Detail Row
                const rowTOR = worksheet.getRow(currentRowIndex);
                rowTOR.getCell(1).value = 'Test ID/NAME :';
                rowTOR.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                rowTOR.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                rowTOR.getCell(2).value = tor.tor_name || "-";
                rowTOR.getCell(3).value = "Detail/Proto";
                rowTOR.getCell(3).font = { bold: true, color: { argb: 'FF000000' } };
                rowTOR.getCell(3).alignment = { horizontal: 'center' };
                rowTOR.getCell(4).value = { richText: [{ text: 'Detail\n', font: { bold: true } }, { text: stkFormatHtml(torDetail?.tord_header) }] };
                rowTOR.getCell(5).value = { richText: [{ text: 'Proto\n', font: { bold: true } }, { text: stkFormatHtml(torDetail?.tord_prototype) }] };
                rowTOR.height = 60; // Set min height
                currentRowIndex += 2;

                // Table Header
                const tableHeadRow = worksheet.getRow(currentRowIndex);
                let headers = [];
                if (isFinal) headers = ['Test Case Name', 'Function / Scenario', 'Step', 'Action', 'Expected Result', 'Pass/Fail', 'Remark'];
                else headers = ['Test Case Name', 'Function / Scenario', 'Step', 'Original Action', 'Original Expected', 'Change Status', 'New Action', 'New Expected', 'Result', 'Remark'];
                
                tableHeadRow.values = headers;
                tableHeadRow.eachCell((cell, colNum) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    
                    if (!isFinal && colNum >= 6 && colNum <= 8) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } }; // Orange for Edit Zone
                    }
                });
                currentRowIndex++;

                // Data Rows
                if (testData) {
                    testData.forEach(link => {
                        const tc = link.test_cases;
                        if (!tc || !tc.scenarios) return;
                        tc.scenarios.sort((a, b) => (a.scenario_id_code || "").localeCompare(b.scenario_id_code || ""));

                        let isFirst = true;
                        tc.scenarios.forEach((sc, idx) => {
                            const row = worksheet.getRow(currentRowIndex);
                            
                            // Col A
                            if (isFirst) {
                                row.getCell(1).value = { richText: [{ text: (tc.test_id_code||"")+' :\n', font:{bold:true}}, { text: tc.name||"" }] };
                            }
                            // Col B
                            const scCode = (sc.scenario_id_code||"").trim();
                            const sessionPrefix = scCode.startsWith("ST") ? "SIT\n" : (scCode.startsWith("UT") ? "UAT\n" : "");
                            row.getCell(2).value = { richText: [{ text: sessionPrefix, font:{bold:true}}, { text: scCode+' :\n', font:{bold:true}}, { text: sc.name||"" }] };
                            // Col C
                            row.getCell(3).value = idx + 1;
                            // Col D-E
                            row.getCell(4).value = stkFormatHtml(sc.action);
                            row.getCell(5).value = stkFormatHtml(sc.expected_result);

                            if (isFinal) {
                                row.getCell(7).value = stkFormatHtml(sc.information);
                            } else {
                                // Draft Mode Logic
                                const statusCell = row.getCell(6);
                                statusCell.value = 'Keep';
                                statusCell.dataValidation = { type: 'list', allowBlank: false, formulae: ['"Keep,Modify,Delete"'] };
                                statusCell.alignment = { horizontal: 'center', vertical: 'top' };
                                row.getCell(10).value = stkFormatHtml(sc.information);

                                // Protection
                                row.eachCell((cell, colNum) => {
                                    if (colNum >= 6 && colNum <= 8) {
                                        cell.protection = { locked: false };
                                        if(colNum===6) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
                                    } else {
                                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                                    }
                                });
                            }

                            // Common Style
                            row.eachCell((cell) => {
                                cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true };
                                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                            });

                            currentRowIndex++;
                            isFirst = false;
                        });
                    });
                }
                
                currentRowIndex += 2; // Gap between TORs
            }

            // --- Add New Items (Draft Only) ---
            if (!isFinal) {
                const newHeader = worksheet.getRow(currentRowIndex);
                newHeader.getCell(1).value = '--- เพิ่มรายการใหม่ (New Items) ---';
                newHeader.getCell(1).font = { bold: true, color: { argb: 'FF006100' } };
                newHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
                worksheet.mergeCells(`A${currentRowIndex}:J${currentRowIndex}`);
                currentRowIndex++;

                for(let i=0; i<10; i++) {
                    const r = worksheet.getRow(currentRowIndex + i);
                    r.getCell(6).value = 'New';
                    r.getCell(6).font = { bold: true, color: { argb: 'FF006100' } };
                    r.eachCell({includeEmpty:true}, cell => {
                        cell.protection = { locked: false };
                        cell.border = { top:{style:'dotted'}, left:{style:'dotted'}, bottom:{style:'dotted'}, right:{style:'dotted'} };
                    });
                }
            }

            // --- Protect Sheet ---
            await worksheet.protect('pcs1234', { selectLockedCells: true, selectUnlockedCells: true, formatCells: true });
        }

        // --- Download ---
        updateLoadingText("กำลังบันทึกไฟล์...");
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = `TC_${groupName}_${statusSuffix}_${dataAsOfStr.replace(/[\/ :]/g,'')}.xlsx`;
        saveAs(blob, fileName);

    } catch (err) {
        console.error('Export Error:', err);
        alert('เกิดข้อผิดพลาดในการ Export: ' + err.message);
    } finally {
        hideLoadingOverlay();
    }
}