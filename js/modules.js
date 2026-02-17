// =================================================================
// PCS Test Case - Modules Overview Script (Debug & Fix Version)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('modules-container');
    const loadingState = document.getElementById('loading-state');

    // --- 1. Initial Load ---
    async function init() {
        if (typeof supabaseClient === 'undefined') {
            console.error('Supabase client missing');
            return;
        }
        await loadModulesData();
    }

    // --- 2. Data Fetching & Processing ---
    async function loadModulesData() {
        try {
            console.log('--- Starting Data Load ---');

            // 1. ดึง Master Modules (12 ระบบ)
            const { data: modules, error: modError } = await supabaseClient
                .from('Modules')
                .select('module_id, module_name')
                .order('module_id');
            if (modError) throw modError;
            console.log(`Loaded ${modules.length} Modules`);

            // 2. ดึง TORs ทั้งหมด
            const { data: torsData, error: torError } = await supabaseClient
                .from('TORs')
                .select('module_id, tor_id');
            if (torError) throw torError;
            console.log(`Loaded ${torsData.length} TORs`);

            // 3. ดึง View Data (หัวใจสำคัญ)
            // เพิ่ม field 'module_group' หรือที่ใกล้เคียงเผื่อใช้ Cross check
            const { data: viewData, error: viewError } = await supabaseClient
                .from('test_case_report_view')
                .select('tor_id, test_case_id, scenario_id, module_group'); 
            if (viewError) throw viewError;
            console.log(`Loaded ${viewData.length} View Rows`);

            // --- เริ่มกระบวนการนับ ---

            // Map: TOR_ID -> MODULE_ID
            const torToModuleMap = {};
            const torCountMap = {}; 

            torsData.forEach(t => {
                if (t.module_id) {
                    const mid = String(t.module_id);
                    torToModuleMap[t.tor_id] = mid;
                    
                    if (!torCountMap[mid]) torCountMap[mid] = new Set();
                    torCountMap[mid].add(t.tor_id);
                }
            });

            // Map: MODULE_ID -> Stats
            const statsMap = new Map();
            
            // วนลูป View Data เพื่อจัดลงถัง
            viewData.forEach(row => {
                let mid = null;

                // Priority 1: หาจาก TOR ที่ผูกไว้
                if (row.tor_id && torToModuleMap[row.tor_id]) {
                    mid = torToModuleMap[row.tor_id];
                } 
                // Priority 2: หาจาก module_group ใน view (ถ้ามี และหาจาก TOR ไม่เจอ)
                else if (row.module_group) {
                    mid = String(row.module_group);
                }

                // ถ้าหา Module ไม่เจอ ข้าม
                if (!mid) return;

                if (!statsMap.has(mid)) {
                    statsMap.set(mid, { tcs: new Set(), scenarios: new Set() });
                }

                const entry = statsMap.get(mid);
                if (row.test_case_id) entry.tcs.add(row.test_case_id);
                if (row.scenario_id) entry.scenarios.add(row.scenario_id);
            });

            // Debug Module 01 specifically
            const mod01Stats = statsMap.get('01');
            if (mod01Stats) {
                console.log('--- Debug Module 01 ---');
                console.log('Test Cases:', mod01Stats.tcs.size);
                console.log('Scenarios:', mod01Stats.scenarios.size);
            }

            // 4. ประกอบร่างข้อมูลเข้า Card
            const modulesWithStats = modules.map(mod => {
                const mid = String(mod.module_id);
                const stats = statsMap.get(mid) || { tcs: new Set(), scenarios: new Set() };
                
                return {
                    ...mod,
                    torCount: torCountMap[mid] ? torCountMap[mid].size : 0,
                    tcCount: stats.tcs.size,
                    scenarioCount: stats.scenarios.size
                };
            });

            renderModules(modulesWithStats);

        } catch (err) {
            console.error('Error loading modules:', err);
            if(container) container.innerHTML = `<div class="col-12 text-center text-danger">Error loading data: ${err.message}</div>`;
            if(loadingState) loadingState.style.display = 'none';
        }
    }

    // --- 3. Rendering (Logic เดิม) ---
    function renderModules(modules) {
        if(!container) return;
        container.innerHTML = '';
        if(loadingState) loadingState.style.display = 'none';
        container.style.display = 'flex';

        const colors = ['#3f6ad8'];

        modules.forEach((mod, index) => {
            const color = colors[index % colors.length];
            
            // Icon Logic
            let iconClass = 'bi-folder';
            const name = (mod.module_name || '').toLowerCase();
            if (name.includes('เรือ') || name.includes('vessel')) iconClass = 'bi-folder';
            else if (name.includes('นำเข้า') || name.includes('import')) iconClass = 'bi-box-arrow-in-down';
            else if (name.includes('ส่งออก') || name.includes('export')) iconClass = 'bi-box-arrow-up';
            else if (name.includes('ศุลกากร') || name.includes('customs')) iconClass = 'bi-shield-check';
            else if (name.includes('รถ') || name.includes('ขนส่ง') || name.includes('truck')) iconClass = 'bi-truck';
            else if (name.includes('ราง') || name.includes('rail')) iconClass = 'bi-train-front';
            else if (name.includes('บริหาร') || name.includes('admin')) iconClass = 'bi-gear-wide-connected';
            else if (name.includes('general') || name.includes('ทั่วไป')) iconClass = 'bi-grid';

            const torClass = mod.torCount > 0 ? '' : 'opacity-50';
            const tcClass = mod.tcCount > 0 ? '' : 'opacity-50';
            const scClass = mod.scenarioCount > 0 ? '' : 'opacity-50';

            // HTML Structure
            const html = `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="folder-card" style="border-left-color: ${color};">
                        
                        <div class="folder-header">
                            <div class="folder-title" title="${mod.module_name}">
                                ${mod.module_name}
                            </div>
                            <i class="bi ${iconClass} module-icon" style="color: ${color};"></i>
                        </div>

                        <div class="stats-container">
                            <div class="stat-item ${torClass}" onclick="redirectToTorPage('${mod.module_id}')" title="ดู TOR ทั้งหมด">
                                <div class="stat-value" style="color: ${color}">${mod.torCount}</div>
                                <div class="stat-label">TORs</div>
                            </div>
                            <div class="stat-item border-start border-end ${tcClass}" onclick="redirectToTorPage('${mod.module_id}')" title="ดู Test Case ทั้งหมด">
                                <div class="stat-value" style="color: ${color}">${mod.tcCount}</div>
                                <div class="stat-label">Test Cases</div>
                            </div>
                            <div class="stat-item ${scClass}" onclick="redirectToTorPage('${mod.module_id}')" title="ดู Scenario ทั้งหมด">
                                <div class="stat-value" style="color: ${color}">${mod.scenarioCount}</div>
                                <div class="stat-label">Scenarios</div>
                            </div>
                        </div>

                        <div class="folder-footer">
                            <button class="btn-action-icon" title="Download Excel" onclick="exportToExcel('${mod.module_id}')">
                                <i class="bi bi-file-earmark-excel"></i>
                            </button>
                        </div>

                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }

    // Navigation
    window.redirectToTorPage = (moduleId) => {
        // ไม่ต้องหา Group ID แล้ว ส่งไปแบบโล่งๆ เลย
        console.log(`Navigating to Overview: Module=${moduleId}`);
        window.location.href = `/stk_torwtc.html?module=${moduleId}&from=module`;
    };
    
    // (ฟังก์ชัน exportToExcel ต้องมีอยู่แล้ว หรือถ้าไม่มีก็แปะเพิ่มได้ครับ)

    init();
});

// =================================================================
// EXPORT EXCEL MODULE (FULL VERSION: Draft & Final Modes)
// =================================================================

// --- 1. Helper: แปลง HTML เป็น Text (ล้าง Tag) ---
function formatHtmlToExcel(html) {
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

// --- 2. Helper: แสดง Loading Overlay ---
function showLoadingOverlay() {
    let overlay = document.getElementById('excel-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'excel-loading-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;';
        overlay.innerHTML = `
            <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status"></div>
            <div style="font-size: 1.5rem; margin-top: 15px; font-weight:bold;">กำลังสร้างไฟล์ Excel...</div>
            <div style="margin-top: 5px; opacity: 0.8;">ระบบกำลังเตรียมข้อมูลและจัด Format (Version Control Mode)</div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

// --- 3. Helper: ซ่อน Loading ---
function hideLoadingOverlay() {
    const overlay = document.getElementById('excel-loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --- 4. MAIN FUNCTION: Export to Excel ---
// param: moduleId (Required)
// param: isFinal (Optional, Default = false) -> true = Final Version (No Edit), false = Draft (Editable)
async function exportToExcel(moduleId, isFinal = false) {
    if (!moduleId) return alert("ไม่พบ Module ID");

    showLoadingOverlay();

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PCS System';
        workbook.created = new Date();

        // 4.1 Config ชื่อไฟล์และ Mapping
        const fileNameMapping = {
            '01': 'General', 'M01': 'General', 'M001': 'General',
            '02': 'Vessel', 'M02': 'Vessel', 'M002': 'Vessel',
            '03': 'Import', 'M03': 'Import', 'M003': 'Import',
            '04': 'Customs', 'M04': 'Customs', 'M004': 'Customs',
            '05': 'Export', 'M05': 'Export', 'M005': 'Export',
            '06': 'Container', 'M06': 'Container', 'M006': 'Container',
            '07': 'Hinterland', 'M07': 'Hinterland', 'M007': 'Hinterland',
            '08': 'Banking', 'M08': 'Banking', 'M008': 'Banking',
            '09': 'PCSIntelligence', 'M09': 'PCSIntelligence', 'M009': 'PCSIntelligence',
            '10': 'SetupUtility', 'M10': 'SetupUtility', 'M010': 'SetupUtility',
            '11': 'Administration', 'M11': 'Administration', 'M011': 'Administration',
            '12': 'Report', 'M12': 'Report', 'M012': 'Report'
        };

        let fileModuleName = fileNameMapping[moduleId] || `Module-${moduleId}`;

        // 4.2 Query TORs
        const { data: tors, error: torError } = await supabaseClient
            .from('TORs')
            .select('*')
            .eq('module_id', moduleId)
            .order('tor_id');

        if (torError) throw torError;
        if (!tors || tors.length === 0) throw new Error("ไม่พบข้อมูล TOR ใน Module นี้");

        // 4.3 Generate Reference Data (Version Control)
        // ใช้วันที่ปัจจุบันเป็น Data As Of (ในอนาคตเปลี่ยนเป็น Max Updated_at จาก DB ได้)
        const dataDate = new Date();
        const yyyy = dataDate.getFullYear();
        const mm = String(dataDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dataDate.getDate()).padStart(2, '0');
        const hh = String(dataDate.getHours()).padStart(2, '0');
        const min = String(dataDate.getMinutes()).padStart(2, '0');

        const statusSuffix = isFinal ? "FINAL" : "DRAFT";
        const refId = `REF-${moduleId}-${yyyy}${mm}${dd}-${hh}${min}-${statusSuffix}`;
        const dataAsOfStr = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

        // =========================================================
        // SHEET 1: INSTRUCTION (คำแนะนำ)
        // =========================================================
        const sheetInstr = workbook.addWorksheet('READ ME (คำแนะนำ)');
        sheetInstr.getColumn('A').width = 8;
        sheetInstr.getColumn('B').width = 90;

        // Title
        const instrTitle = sheetInstr.getCell('B2');
        instrTitle.value = isFinal ? 
            "คำแนะนำ: เอกสารฉบับสมบูรณ์ (Final Version)" : 
            "คำแนะนำ: การตรวจสอบและแก้ไข Test Case (Draft Version)";
        instrTitle.font = { size: 16, bold: true, color: { argb: 'FF1F4E78' } }; // น้ำเงินเข้ม

        // Instruction Content
        let instructions = [];
        if (isFinal) {
            instructions = [
                { title: "1. เอกสารฉบับสมบูรณ์ (Final Version)", detail: "เอกสารนี้เป็นเวอร์ชันสรุปสุดท้ายสำหรับการทดสอบ (Test Execution) ข้อมูลในนี้ถือเป็น Master Data ล่าสุด" },
                { title: "2. การอ้างอิง (Reference)", detail: `ข้อมูล ณ วันที่: ${dataAsOfStr}\nReference ID: ${refId}\n(กรุณาใช้ Ref ID นี้ในการอ้างอิงเมื่อแจ้งผลการทดสอบ)` },
                { title: "3. การแก้ไขข้อมูล", detail: "หากต้องการแก้ไขข้อมูลในเอกสารนี้ กรุณาติดต่อ Admin เพื่อทำการปรับปรุงในระบบและ Export เอกสารใหม่ (ห้ามแก้ไขในไฟล์นี้โดยตรง)" }
            ];
        } else {
            instructions = [
                { title: "1. ห้ามแก้ไขข้อมูลเดิม (Do Not Edit Original Data)", detail: "ข้อมูลในช่องสีเทา (Columns A-E) เป็นข้อมูลตั้งต้นจากระบบ ถูกล็อคไว้ห้ามแก้ไข เพื่อใช้ในการอ้างอิงและป้องกันความผิดพลาดของ ID" },
                { title: "2. การแจ้งแก้ไข (Modify/Delete)", detail: "หากพบข้อผิดพลาดหรือต้องการแก้ไข ให้เลือกสถานะในช่อง 'Change Status' (Column F) เป็น 'Modify' หรือ 'Delete' แล้วกรอกข้อมูลใหม่ในช่องสีขาวด้านขวา" },
                { title: "3. การเพิ่ม Test Case ใหม่ (Add New)", detail: "หากต้องการเพิ่ม Test Case ใหม่ ให้เลื่อนลงไปด้านล่างสุดของตาราง จะมีโซน '--- เพิ่มรายการใหม่ (New Items) ---' ท่านสามารถกรอกข้อมูลต่อท้ายได้เลย" },
                { title: "4. Version Control", detail: `Reference ID: ${refId}\nโปรดตรวจสอบ Ref ID ทุกครั้งก่อนเริ่มทำงาน เพื่อให้มั่นใจว่าเป็นไฟล์เวอร์ชันล่าสุด` },
                { title: "5. การส่งคืนไฟล์", detail: "เมื่อแก้ไขเสร็จแล้ว ให้บันทึกไฟล์ (Save) แล้วส่งคืนทีมงานโดยไม่ต้องเปลี่ยนชื่อไฟล์" }
            ];
        }

        let currentRow = 4;
        instructions.forEach(inst => {
            // หัวข้อ (Bold)
            const cellTitle = sheetInstr.getCell(`B${currentRow}`);
            cellTitle.value = inst.title;
            cellTitle.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
            
            // รายละเอียด
            currentRow++;
            const cellDetail = sheetInstr.getCell(`B${currentRow}`);
            cellDetail.value = inst.detail;
            cellDetail.alignment = { wrapText: true, vertical: 'top' };
            cellDetail.font = { color: { argb: 'FF404040' } }; // เทาเข้ม
            
            currentRow += 2; // เว้นบรรทัด
        });

        // Protect Instruction Sheet (อ่านได้อย่างเดียว)
        await sheetInstr.protect('pcs1234', { selectLockedCells: true, selectUnlockedCells: true });


        // =========================================================
        // SHEET 2+: TOR SHEETS
        // =========================================================
        for (const tor of tors) {
            // Get Detail from TORDetail
            const { data: torDetail } = await supabaseClient
                .from('TORDetail')
                .select('tord_header, tord_prototype')
                .eq('tor_id', tor.tor_id)
                .maybeSingle();

            // Set Sheet Name (Safe Chars & Length)
            let sheetName = tor.tor_name ? tor.tor_name.split(' ')[0] : tor.tor_id;
            sheetName = sheetName.replace(/[\/\\\?\*\[\]]/g, '_').substring(0, 31);
            
            // กันชื่อซ้ำ
            if (workbook.getWorksheet(sheetName)) {
                sheetName = sheetName.substring(0, 28) + "_" + tor.tor_id.slice(-2);
            }
            const worksheet = workbook.addWorksheet(sheetName);

            // Get Test Case Data
            let { data: testData } = await supabaseClient
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
            
            // Sort Data
            if (testData) {
                testData.sort((a, b) => (a.test_cases?.test_id_code || "").localeCompare(b.test_cases?.test_id_code || ""));
            }

            // Prepare Header Variables
            let pcsModuleName = "Unknown";
            if (testData && testData.length > 0 && testData[0].test_cases?.pcs_module?.name) {
                pcsModuleName = testData[0].test_cases.pcs_module.name;
            }

            const nameParts = pcsModuleName.split('-');
            let moduleNameHeader = pcsModuleName.startsWith("Co-Service") ? "Co-Service" : (nameParts[0]?.trim() || "-");
            let functionNameHeader = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : "-";

            // --- 4.4 Set Columns Width ---
            if (isFinal) {
                // Final: A-G (No Edit Columns)
                worksheet.columns = [
                    { width: 35 }, { width: 45 }, { width: 8 }, 
                    { width: 45 }, { width: 45 }, { width: 15 }, { width: 30 }
                ];
            } else {
                // Draft: A-J (With Edit Columns)
                worksheet.columns = [
                    { width: 35 }, { width: 45 }, { width: 8 }, 
                    { width: 45 }, { width: 45 }, // A-E: Original
                    { width: 15 }, { width: 45 }, { width: 45 }, // F-H: Edit Zone
                    { width: 15 }, { width: 30 }  // I-J: Result/Remark
                ];
            }

            // --- 4.5 Header Rows (Rows 1-6) ---
            const headerRows = [
                ['Project Name :', 'Port Community System'],
                ['Module :', moduleNameHeader], 
                ['Function :', functionNameHeader],
                ['Path :', pcsModuleName],
                ['Data As Of :', dataAsOfStr], // Row 5
                ['Reference ID :', refId]      // Row 6
            ];

            headerRows.forEach((data, index) => {
                const row = worksheet.getRow(index + 1);
                row.getCell(1).value = data[0]; 
                row.getCell(2).value = data[1];
                
                // Style: Label Column
                const cellA = row.getCell(1);
                cellA.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; // น้ำเงิน
                cellA.alignment = { vertical: 'top' };
                row.getCell(2).alignment = { vertical: 'top', wrapText: true };

                // 🔥 Special Style for Date & Ref ID (Row 5 & 6)
                if (index === 4 || index === 5) {
                    // Label แดง
                    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }; // แดงเข้ม
                    // Value แดง ตัวใหญ่
                    const cellB = row.getCell(2);
                    cellB.font = { size: 12, bold: true, color: { argb: 'FFC00000' } };
                    cellB.border = { bottom: {style:'double', color: {argb:'FFC00000'}} };
                }
            });

            // --- 4.6 TOR Detail Row (Row 7) ---
            const row7 = worksheet.getRow(7);
            
            // Cell 1: Label
            row7.getCell(1).value = 'Test ID/NAME :';
            row7.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            row7.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
            row7.getCell(1).alignment = { vertical: 'top' };

            // Cell 2: TOR Name
            row7.getCell(2).value = tor.tor_name || "-";
            row7.getCell(2).alignment = { vertical: 'top', wrapText: true };

            // Cell 3: Relate
            row7.getCell(3).value = "Design/Proto";
            row7.getCell(3).font = { bold: true };
            row7.getCell(3).alignment = { vertical: 'top', horizontal: 'center' };

            // Cell 4: Detail Design
            row7.getCell(4).value = { richText: [{ text: 'Detail\n', font: { bold: true } }, { text: formatHtmlToExcel(torDetail?.tord_header) }] };
            row7.getCell(4).alignment = { vertical: 'top', wrapText: true };

            // Cell 5: Prototype
            row7.getCell(5).value = { richText: [{ text: 'Proto\n', font: { bold: true } }, { text: formatHtmlToExcel(torDetail?.tord_prototype) }] };
            row7.getCell(5).alignment = { vertical: 'top', wrapText: true };


            // --- 4.7 Table Header (Row 9) ---
            const tableHeadRow = worksheet.getRow(9);
            let headers = [];
            
            if (isFinal) {
                headers = ['Test Case Name', 'Function / Scenario', 'Step', 'Action', 'Expected Result', 'Pass/Fail', 'Remark'];
            } else {
                headers = ['Test Case Name', 'Function / Scenario', 'Step', 'Original Action', 'Original Expected', 'Change Status', 'New Action', 'New Expected', 'Result', 'Remark'];
            }
            tableHeadRow.values = headers;
            
            tableHeadRow.eachCell((cell, colNum) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                
                // Draft Mode: Highlight Edit Zone Columns (F, G, H)
                if (!isFinal && colNum >= 6 && colNum <= 8) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } }; // สีส้ม
                }
            });


            // --- 4.8 Data Rows ---
            if (testData) {
                testData.forEach(link => {
                    const tc = link.test_cases;
                    if (!tc || !tc.scenarios) return;
                    
                    // Sort Scenarios inside TC
                    tc.scenarios.sort((a, b) => (a.scenario_id_code || "").localeCompare(b.scenario_id_code || ""));

                    let isFirst = true;
                    tc.scenarios.forEach((sc, idx) => {
                        const row = worksheet.addRow([]);
                        
                        // Col A: Test Case Name (Merge logic visually)
                        if (isFirst) {
                            row.getCell(1).value = { richText: [{ text: (tc.test_id_code||"")+' :\n', font:{bold:true}}, { text: tc.name||"" }] };
                        }

                        // Col B: Scenario
                        const scCode = (sc.scenario_id_code||"").trim();
                        const sessionPrefix = scCode.startsWith("ST") ? "SIT Session\n" : (scCode.startsWith("UT") ? "UAT Session\n" : "");
                        row.getCell(2).value = { richText: [{ text: sessionPrefix, font:{bold:true}}, { text: scCode+' :\n', font:{bold:true}}, { text: sc.name||"" }] };
                        
                        // Col C: Step
                        row.getCell(3).value = idx + 1;
                        
                        // Col D-E: Original Data
                        row.getCell(4).value = formatHtmlToExcel(sc.action);
                        row.getCell(5).value = formatHtmlToExcel(sc.expected_result);

                        if (isFinal) {
                            // Final Mode
                            // Col F: Pass/Fail (Blank for checking)
                            // Col G: Remark
                            row.getCell(7).value = formatHtmlToExcel(sc.information);
                        } else {
                            // Draft Mode
                            // Col F: Status Dropdown
                            const statusCell = row.getCell(6);
                            statusCell.value = 'Keep';
                            statusCell.dataValidation = { type: 'list', allowBlank: false, formulae: ['"Keep,Modify,Delete"'] };
                            statusCell.alignment = { horizontal: 'center', vertical: 'top' };
                            
                            // Col J: Remark
                            row.getCell(10).value = formatHtmlToExcel(sc.information);

                            // Protection Logic & Coloring
                            row.eachCell((cell, colNum) => {
                                if (colNum >= 6 && colNum <= 8) {
                                    cell.protection = { locked: false }; // Unlock Edit Zone
                                    if(colNum === 6) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }; // เหลืองอ่อน
                                } else if (colNum <= 5) {
                                    // Original Zone Locked
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // เทาอ่อน
                                }
                            });
                        }

                        // Common Styles
                        row.eachCell((cell) => {
                            cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true };
                            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                        });

                        isFirst = false;
                    });
                });
            }

            // --- 4.9 Add New Items Zone (Draft Only) ---
            if (!isFinal) {
                worksheet.addRow([]);
                const newHeader = worksheet.addRow(['--- เพิ่มรายการใหม่ (New Items) ---']);
                newHeader.getCell(1).font = { bold: true, color: { argb: 'FF006100' } }; // เขียวเข้ม
                newHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // เขียวอ่อน
                worksheet.mergeCells(`A${newHeader.number}:J${newHeader.number}`);
                
                // Add 10 Empty Rows
                for(let i=0; i<10; i++) {
                    const r = worksheet.addRow([]);
                    r.getCell(6).value = 'New';
                    r.getCell(6).font = { bold: true, color: { argb: 'FF006100' } };
                    
                    r.eachCell({includeEmpty:true}, cell => {
                        cell.protection = { locked: false }; // Unlock ทั้งแถว
                        cell.border = { top:{style:'dotted'}, left:{style:'dotted'}, bottom:{style:'dotted'}, right:{style:'dotted'} };
                    });
                }
            }

            // --- 4.10 Protect Sheet ---
            // Password: pcs1234
            await worksheet.protect('pcs1234', { 
                selectLockedCells: true, 
                selectUnlockedCells: true, 
                formatCells: true, 
                formatColumns: true 
            });
        }

        // --- 5. Download File ---
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Naming: TC_Module_FINAL_YYMMDD.xlsx
        const fileName = `TC_${fileModuleName}_${statusSuffix}_${dataAsOfStr.replace(/[\/ :]/g,'')}.xlsx`;
        saveAs(blob, fileName);

    } catch (err) {
        console.error('Export Error:', err);
        alert('เกิดข้อผิดพลาดในการ Export: ' + err.message);
    } finally {
        hideLoadingOverlay();
    }
}