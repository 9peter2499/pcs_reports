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
// STAKEHOLDER EXCEL EXPORT (Full Package - No Dependencies)
// =================================================================

// --- 1. Helper Functions (ฟังก์ชันตัวช่วย ต้องมีอยู่ตรงนี้เสมอ) ---

function showLoadingOverlay() {
    let overlay = document.getElementById('excel-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'excel-loading-overlay';
        // ใช้ z-index สูงๆ เพื่อให้บังทุกอย่าง
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;';
        overlay.innerHTML = `
            <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status"></div>
            <div style="font-size: 1.5rem; margin-top: 15px; font-weight:bold;">กำลังสร้างไฟล์ Excel...</div>
            <div id="loading-text" style="margin-top: 5px; opacity: 0.8;">กรุณารอสักครู่</div>
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

function stkFormatHtml(html) {
    if (!html) return "";
    // แปลง HTML Tags เป็น Text ธรรมดาสำหรับ Excel
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

// --- 2. Configuration (ชื่อ Sheet) ---
const PCS_MODULE_NAMES = {
    '01': 'General',
    '02': 'Vessel',
    '03': 'Import',
    '04': 'Customs',
    '05': 'Export',
    '06': 'ContainerCargo',
    '07': 'Hinterland',
    '08': 'Banking',
    '09': 'PCSIntelligence',
    '10': 'SetupUtility',
    '11': 'Administration',
    '12': 'Report'
};

// --- 3. Main Function (ฟังก์ชันหลัก) ---
async function exportStakeholderExcel(stakeholderGroupId) {
    // Check ID
    if (!stakeholderGroupId) {
        console.error("No Stakeholder Group ID provided");
        alert("ไม่พบ Group ID");
        return;
    }

    // เรียก Helper (ตอนนี้อยู่ไฟล์เดียวกันแล้ว ต้องเจอแน่นอน)
    showLoadingOverlay();

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PCS System';
        workbook.created = new Date();

        // 1. ดึงข้อมูลชื่อกลุ่ม
        updateLoadingText("กำลังดึงข้อมูลกลุ่มผู้ใช้งาน...");
        const { data: groupData, error: groupError } = await supabaseClient
            .from('stakeholder_groups')
            .select('name')
            .eq('id', stakeholderGroupId)
            .single();
        
        if (groupError || !groupData) throw new Error("ไม่พบข้อมูลกลุ่ม Stakeholder");
        const groupName = groupData.name.replace(/[^a-zA-Z0-9ก-๙\- ]/g, '');

        // 2. ดึงรายการ TOR ที่เกี่ยวข้อง
        updateLoadingText("กำลังดึงรายการ TOR...");
        const { data: links, error: linkError } = await supabaseClient
            .from('stakeholder_tor_links')
            .select(`
                tor_id,
                TORs (
                    tor_id, tor_name, module_id,
                    Modules ( module_name )
                )
            `)
            .eq('group_id', stakeholderGroupId);

        if (linkError) throw linkError;
        if (!links || links.length === 0) throw new Error("กลุ่มนี้ยังไม่มีการผูก TOR");

        // 3. จัดกลุ่ม TOR ตาม Module
        const torsByModule = {};
        
        links.forEach(link => {
            const tor = link.TORs;
            if (!tor) return;
            
            // Logic แปลง ID: 1, 01, 001 -> '01'
            let modId = '99'; 
            try {
                const rawId = String(tor.module_id);
                const match = rawId.match(/\d+/); 
                if (match) {
                    const num = parseInt(match[0], 10);
                    modId = String(num).padStart(2, '0');
                }
            } catch (e) {
                console.warn("ID Parse Error:", tor.module_id);
            }

            if (!torsByModule[modId]) {
                torsByModule[modId] = [];
            }
            torsByModule[modId].push(tor);
        });

        // 4. วนลูปสร้าง Sheet ตาม Module
        const sortedModuleIds = Object.keys(torsByModule).sort();

        for (const modId of sortedModuleIds) {
            const torsInModule = torsByModule[modId];
            if (!torsInModule || torsInModule.length === 0) continue;

            // ตั้งชื่อ Sheet
            const sheetName = PCS_MODULE_NAMES[modId] || `Module-${modId}`;
            updateLoadingText(`กำลังสร้าง Sheet: ${sheetName}...`);
            
            let worksheet;
            try {
                worksheet = workbook.addWorksheet(sheetName);
            } catch (err) {
                worksheet = workbook.addWorksheet(`Mod-${modId}-${Date.now().toString().slice(-4)}`);
            }

            // Setup Columns
            worksheet.getColumn('A').width = 35; 
            worksheet.getColumn('B').width = 50; 
            worksheet.getColumn('C').width = 15; 
            worksheet.getColumn('D').width = 50; 
            worksheet.getColumn('E').width = 50; 
            worksheet.getColumn(6).width = 8;
            worksheet.getColumn(7).width = 8; 
            worksheet.getColumn(8).width = 10;
            worksheet.getColumn(9).width = 15; 
            worksheet.getColumn(10).width = 30;

            let currentRowIndex = 1;

            // --- วนลูป TOR ใน Module นี้ ---
            for (const tor of torsInModule) {
                
                // ดึง Detail
                const { data: torDetail } = await supabaseClient
                    .from('TORDetail')
                    .select('tord_header, tord_prototype')
                    .eq('tor_id', tor.tor_id)
                    .maybeSingle();

                // ดึง Test Cases
                const { data: testData } = await supabaseClient
                    .from('tor_test_case_links')
                    .select(`
                        test_cases (
                            id, test_id_code, name, pcs_module_id,
                            pcs_module:pcs_module_id ( name ), 
                            scenarios (
                                id, scenario_id_code, name, action, expected_result, information
                            )
                        )
                    `)
                    .eq('tor_id', tor.tor_id);

                // Sort Test Cases
                if (testData) {
                    testData.sort((a, b) => {
                        const codeA = a.test_cases?.test_id_code || "";
                        const codeB = b.test_cases?.test_id_code || "";
                        return codeA.localeCompare(codeB);
                    });
                }

                // Header Info
                let pcsModuleName = "Unknown";
                if (testData && testData.length > 0 && testData[0].test_cases?.pcs_module?.name) {
                    pcsModuleName = testData[0].test_cases.pcs_module.name;
                }
                const nameParts = pcsModuleName.split('-');
                let moduleNameHeader = nameParts[0] ? nameParts[0].trim() : "-";
                let functionNameHeader = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : "-";

                // 🔥 SEPARATOR: แถบสีเขียวคั่นแต่ละ TOR
                const separatorRow = worksheet.getRow(currentRowIndex);
                worksheet.mergeCells(`A${currentRowIndex}:J${currentRowIndex}`);
                const sepCell = separatorRow.getCell(1);
                
                // ข้อความในแถบเขียว: ชื่อ Sheet - รหัส TOR - ชื่อ TOR
                sepCell.value = `${sheetName} - ${tor.tor_name || "TOR Details"}`; 
                
                sepCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006400' } }; // Dark Green
                sepCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }; // White
                sepCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
                sepCell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                separatorRow.height = 30; 

                currentRowIndex++; 

                // Header Data
                const headerData = [
                    ['Project Name :', 'Port Community System, PORT Authority of Thailand'],
                    ['Application Name :', 'Port Community System'],
                    ['Module :', moduleNameHeader], 
                    ['Function :', functionNameHeader],
                    ['Path :', pcsModuleName]
                ];

                headerData.forEach((data, idx) => {
                    const r = worksheet.getRow(currentRowIndex + idx);
                    r.getCell(1).value = data[0]; r.getCell(2).value = data[1];
                    
                    const cellA = r.getCell(1);
                    cellA.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                    cellA.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    
                    r.getCell(2).alignment = { wrapText: true };
                    r.getCell(2).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                });
                currentRowIndex += 5;

                // TOR Detail Row
                const row6 = worksheet.getRow(currentRowIndex);
                const styleBlueHeader = { bold: true, color: { argb: 'FFFFFFFF' } };
                const fillBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                const borderAll = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

                const cellA6 = row6.getCell(1); cellA6.value = 'Test ID/NAME :';
                cellA6.font = styleBlueHeader; cellA6.fill = fillBlue; cellA6.border = borderAll; cellA6.alignment = { vertical: 'top' };

                const cellB6 = row6.getCell(2); cellB6.value = tor.tor_name || "-";
                cellB6.alignment = { vertical: 'top', wrapText: true }; cellB6.border = borderAll;

                const cellC6 = row6.getCell(3); cellC6.value = "สัมพันธ์กับ"; cellC6.font = { bold: true }; cellC6.alignment = { vertical: 'top', horizontal: 'center' }; cellC6.border = borderAll;
                const cellD6 = row6.getCell(4); cellD6.value = { richText: [{ text: 'Detail Design\n', font: { bold: true } }, { text: stkFormatHtml(torDetail?.tord_header) }] }; cellD6.alignment = { vertical: 'top', wrapText: true }; cellD6.border = borderAll;
                const cellE6 = row6.getCell(5); cellE6.value = { richText: [{ text: 'Prototype\n', font: { bold: true } }, { text: stkFormatHtml(torDetail?.tord_prototype) }] }; cellE6.alignment = { vertical: 'top', wrapText: true }; cellE6.border = borderAll;

                currentRowIndex += 2;

                // Table Header
                const tableHeaderRow = worksheet.getRow(currentRowIndex);
                const tableHeaders = ['Test Case Name', 'Test Case Function', 'Test Step #', 'Action', 'Expected Result', 'Pass', 'Fail', 'Not Run', 'Test By', 'Remark / Fail Detail'];
                
                tableHeaders.forEach((txt, i) => {
                    const cell = tableHeaderRow.getCell(i + 1);
                    cell.value = txt;
                    cell.font = styleBlueHeader; cell.fill = fillBlue;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = borderAll;
                });
                currentRowIndex++;

                // Data Rows
                if (testData) {
                    testData.forEach(link => {
                        const tc = link.test_cases;
                        if (!tc || !tc.scenarios) return;
                        tc.scenarios.sort((a, b) => (a.scenario_id_code || "").localeCompare(b.scenario_id_code || ""));

                        let isFirstScenario = true;
                        tc.scenarios.forEach((sc, idx) => {
                            const row = worksheet.getRow(currentRowIndex);

                            if (isFirstScenario) {
                                const moduleNameTitle = tc.pcs_module?.name || "-"; 
                                row.getCell(1).value = { richText: [{ text: moduleNameTitle + '\n', font: { bold: true } }, { text: (tc.test_id_code || "") + ' :\n', font: { bold: true } }, { text: (tc.name || ""), font: { bold: false } }] };
                            }

                            let sessionPrefix = "";
                            const scCode = (sc.scenario_id_code || "").trim();
                            if (scCode.startsWith("ST")) sessionPrefix = "SIT Session\n";
                            else if (scCode.startsWith("UT")) sessionPrefix = "UAT Session\n";

                            row.getCell(2).value = { richText: [{ text: sessionPrefix, font: { bold: true } }, { text: scCode + ' :\n', font: { bold: true } }, { text: (sc.name || ""), font: { bold: false } }] };
                            row.getCell(3).value = idx + 1;
                            row.getCell(4).value = stkFormatHtml(sc.action);
                            row.getCell(5).value = stkFormatHtml(sc.expected_result);
                            row.getCell(10).value = stkFormatHtml(sc.information);

                            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                                if (colNum > 10) return;
                                cell.alignment = { vertical: 'top', wrapText: true };
                                cell.border = borderAll;
                                if ([3, 6, 7, 8].includes(colNum)) cell.alignment = { vertical: 'top', horizontal: 'center' };
                            });
                            
                            currentRowIndex++;
                            isFirstScenario = false;
                        });
                    });
                }
                
                currentRowIndex += 2; // เว้นบรรทัดก่อนขึ้นข้อใหม่
            }
        }

        // 5. Save File
        updateLoadingText("กำลังบันทึกไฟล์...");
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const fileName = `Test Case-${groupName}-${timestamp}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, fileName);

    } catch (err) {
        console.error('Export Error:', err);
        alert('เกิดข้อผิดพลาดในการ Export: ' + err.message);
    } finally {
        hideLoadingOverlay();
    }
}