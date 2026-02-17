// =================================================================
// PCS Test Case - Prototype Test Script (Format: Modules.js Style)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL VARIABLES ---
    let reportViewData = []; 
    let allSubModules = []; 
    let allTestPhases = []; 
    let modulePrototypeMap = {}; 

    // DOM Elements
    const reportTableContainer = document.getElementById('report-table-container');
    const reportTableBody = reportTableContainer?.querySelector('tbody');
    
    // Filters
    const moduleFilter = document.getElementById('report-module-filter');
    const subModuleFilter = document.getElementById('report-submodule-filter');
    const phaseFilter = document.getElementById('report-phase-filter');
    const statusFilter = document.getElementById('report-status-filter');

    // --- 1. HELPER FUNCTIONS (จาก Modules.js) ---

    // Helper: แปลง HTML เป็น Text
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

    // Helper: Loading
    function showLoadingOverlay() {
        let overlay = document.getElementById('excel-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'excel-loading-overlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;';
            overlay.innerHTML = `
                <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status"></div>
                <div style="font-size: 1.5rem; margin-top: 15px; font-weight:bold;">กำลังสร้างไฟล์ Excel...</div>
                <div style="margin-top: 5px; opacity: 0.8;">กรุณารอสักครู่...</div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('excel-loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // Helper: Parse Module Name
    function parseModuleName(fullName) {
        if (!fullName) return { main: '-', sub: '-' };
        const parts = fullName.split('-');
        let main = '', sub = '';
        if (fullName.startsWith('Co-Service')) {
            main = parts.length >= 2 ? parts.slice(0, 2).join('-') : fullName;
            sub = parts.length > 2 ? parts.slice(2).join('-') : '-';
        } else {
            main = parts.length >= 1 ? parts[0] : fullName;
            sub = parts.length > 1 ? parts.slice(1).join('-') : '-';
        }
        return { main: main.trim(), sub: sub ? sub.trim() : '-' };
    }

    // --- 2. DATA FETCHING ---

    async function fetchData() {
        if (reportTableBody) reportTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5">Loading...</td></tr>`;
        if (typeof supabaseClient === 'undefined') { alert('Initialization Error.'); return []; }
        try {
            // 1. Report Data
            const { data, error } = await supabaseClient
                .from('test_case_report_view')
                .select('*')
                .range(0, 4999)
                .order('overall_row_num', { ascending: true });
            if (error) throw error;

            // 2. Prototype Data
            const { data: modData } = await supabaseClient.from('pcs_module').select('id, prototype_url');
            if (modData) {
                modData.forEach(m => modulePrototypeMap[m.id] = m.prototype_url);
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching data:', error);
            if (reportTableBody) reportTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-danger">Failed to load data.</td></tr>`;
            return [];
        }
    }

    // =================================================================
    // 3. MAIN EXPORT EXCEL (FIXED: Created_at Column Error & Data Mapping)
    // =================================================================
    
    function formatHtmlToExcel(html) {
        if (!html) return "";
        let text = html.toString()
            .replace(/\\n/g, '\n') // เปลี่ยนข้อความ "\n" ให้กลายเป็นบรรทัดใหม่
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<li>/gi, '• ')
            .replace(/<\/li>/gi, '\n')
            .replace(/&nbsp;/gi, ' ');
        let tmp = document.createElement("DIV");
        tmp.innerHTML = text;
        return (tmp.textContent || tmp.innerText || "").trim();
    }

    window.exportModuleExcel = async (mainModuleGroup, isFinal = false) => {
        if (!mainModuleGroup) return;
        
        showLoadingOverlay();

        try {
            // 1. Filter ข้อมูลเบื้องต้น
            const basicData = reportViewData.filter(r => r.module_group === mainModuleGroup);
            if (basicData.length === 0) throw new Error("ไม่พบข้อมูลสำหรับ Module นี้");

            const firstRowData = basicData[0];
            const nameInfo = parseModuleName(firstRowData.module_name);
            const mainModuleName = nameInfo.main.toUpperCase().replace(/[^A-Z0-9]/g, '_');

            // --- STEP A: PREPARE DATA ---
            const scenarioIds = basicData.map(r => r.scenario_id).filter(id => id);
            const torIds = [...new Set(basicData.map(r => r.tor_id).filter(id => id))];

            // 1.2 FETCH ข้อมูล Scenario (แก้ไข: ลบ created_at ออกตาม Schema จริง)
            let scenarioMap = {};
            let maxLastUpdate = new Date(0);
            if (scenarioIds.length > 0) {
                const { data: scData, error: scErr } = await supabaseClient
                    .from('scenarios')
                    .select('id, action, expected_result, information, remark, updated_at') // ใช้คอลัมน์ที่มีจริง
                    .in('id', scenarioIds);
                
                if (scErr) throw scErr;
                if (scData) {
                    scData.forEach(sc => {
                        scenarioMap[sc.id] = sc;
                        const d = sc.updated_at ? new Date(sc.updated_at) : new Date(0);
                        if (d > maxLastUpdate) maxLastUpdate = d;
                    });
                }
            }

            // 1.3 Fetch TOR Detail
            let torDetailMap = {};
            if (torIds.length > 0) {
                const { data: tdData } = await supabaseClient
                    .from('TORDetail')
                    .select('tor_id, tord_header, tord_prototype')
                    .in('tor_id', torIds);
                if (tdData) tdData.forEach(td => torDetailMap[td.tor_id] = td);
            }

            // --- STEP B: BUILD EXCEL ---
            const workbook = new ExcelJS.Workbook();
            const dataDate = maxLastUpdate.getTime() > 0 ? maxLastUpdate : new Date();
            const yyyy = dataDate.getFullYear();
            const mm = String(dataDate.getMonth() + 1).padStart(2, '0');
            const dd = String(dataDate.getDate()).padStart(2, '0');
            const hh = String(dataDate.getHours()).padStart(2, '0');
            const min = String(dataDate.getMinutes()).padStart(2, '0');
            const statusSuffix = isFinal ? "FINAL" : "DRAFT";
            const refId = `REF-${mainModuleGroup}-${yyyy}${mm}${dd}-${hh}${min}-${statusSuffix}`;
            const dataAsOfStr = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

            // --- SHEET 1: READ ME (ตามภาพที่ 2) ---
            const sheetInstr = workbook.addWorksheet('READ ME (คำแนะนำ)');
            sheetInstr.getColumn('A').width = 10;
            sheetInstr.getColumn('B').width = 95;
            const instrTitle = sheetInstr.getCell('B2');
            instrTitle.value = isFinal ? "คำแนะนำการใช้งาน: เอกสารฉบับสมบูรณ์ (Final Version)" : "คำแนะนำการใช้งาน: การตรวจสอบและแก้ไข Test Case (Draft Version)";
            instrTitle.font = { size: 16, bold: true, color: { argb: 'FF1F4E78' } };

            const instructions = [
                { title: "1. ห้ามแก้ไขข้อมูลเดิม (Do Not Edit Original Data)", detail: "ข้อมูลในช่องสีเทา (Columns A-E) เป็นข้อมูลตั้งต้นจากระบบ ถูกล็อคไว้ห้ามแก้ไข เพื่อป้องกันรหัส ID คลาดเคลื่อนและใช้ในการอ้างอิง" },
                { title: "2. การแจ้งแก้ไข (Modify/Delete)", detail: "หากท่านต้องการแก้ไขข้อมูล ให้เลือกสถานะในช่อง 'Change Status' (Column F) เป็น 'Modify' หรือ 'Delete' แล้วกรอกข้อมูลใหม่ลงในช่องสีขาวด้านขวา (Column G-H)" },
                { title: "3. การเพิ่ม Test Case ใหม่ (Add New)", detail: "หากต้องการเพิ่มรายการใหม่ ให้เลื่อนลงไปด้านล่างสุดของตาราง จะมีโซน '--- เพิ่มรายการใหม่ (New Items) ---' ท่านสามารถกรอกข้อมูลต่อท้ายได้ทันที" },
                { title: "4. Version Control (Reference ID)", detail: `ไฟล์นี้อ้างอิงข้อมูล ณ วันที่: ${dataAsOfStr} (Reference ID: ${refId})\nโปรดตรวจสอบรหัสนี้ทุกครั้งเพื่อให้มั่นใจว่าท่านกำลังทำงานบนไฟล์เวอร์ชันล่าสุด` },
                { title: "5. การส่งคืนไฟล์", detail: "เมื่อทำการแก้ไขหรือตรวจสอบเสร็จสิ้นแล้ว ให้บันทึกไฟล์ (Save) และส่งคืนผู้ดูแลระบบโดยไม่ต้องเปลี่ยนชื่อไฟล์ต้นฉบับ" }
            ];

            let curI = 4;
            instructions.forEach(inst => {
                sheetInstr.getCell(`B${curI}`).value = inst.title;
                sheetInstr.getCell(`B${curI}`).font = { bold: true, size: 12 };
                curI++;
                sheetInstr.getCell(`B${curI}`).value = inst.detail;
                sheetInstr.getCell(`B${curI}`).alignment = { wrapText: true };
                curI += 2;
            });
            await sheetInstr.protect('pcs1234');

            // --- SHEET 2+: DATA (ตามภาพที่ 4 และ 5) ---
            const subModules = {};
            basicData.forEach(row => {
                const { sub } = parseModuleName(row.module_name);
                const subKey = sub || 'General';
                if (!subModules[subKey]) subModules[subKey] = [];
                subModules[subKey].push(row);
            });

            for (const [subKey, rows] of Object.entries(subModules)) {
                const worksheet = workbook.addWorksheet(subKey.replace(/[:\\\/?*\[\]]/g, '').substring(0, 30) || "Data");

                if (isFinal) {
                    worksheet.columns = [{width:35},{width:45},{width:8},{width:45},{width:45},{width:15},{width:30}];
                } else {
                    worksheet.columns = [{width:35},{width:45},{width:8},{width:45},{width:45},{width:18},{width:45},{width:45},{width:15},{width:30}];
                }

                const headerRows = [
                    ['Project Name :', 'Port Community System'],
                    ['Module :', nameInfo.main], ['Function :', subKey], ['Path :', rows[0].module_name],
                    ['Data As Of :', dataAsOfStr], ['Reference ID :', refId]
                ];
                headerRows.forEach((data, idx) => {
                    const r = worksheet.getRow(idx + 1);
                    r.getCell(1).value = data[0]; r.getCell(2).value = data[1];
                    r.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                    if (idx >= 4) {
                        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
                        r.getCell(2).font = { bold: true, color: { argb: 'FFC00000' }, size: 12 };
                    }
                });

                const td = torDetailMap[rows[0].tor_id] || {};
                const r7 = worksheet.getRow(7);
                r7.getCell(1).value = 'Test ID/NAME :'; r7.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                r7.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                r7.getCell(2).value = rows[0].tor_name || "-";
                r7.getCell(3).value = "สัมพันธ์กับ"; r7.getCell(3).font = { bold: true };
                r7.getCell(4).value = { richText: [{ text: 'Detail Design\n', font: { bold: true } }, { text: formatHtmlToExcel(td.tord_header) }] };
                r7.getCell(5).value = { richText: [{ text: 'Prototype\n', font: { bold: true } }, { text: formatHtmlToExcel(td.tord_prototype) }] };
                r7.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }; c.alignment = { vertical:'top', wrapText:true }; });

                const tableHead = worksheet.getRow(9);
                if (isFinal) {
                    tableHead.values = ['Test Case Name', 'Scenario', 'Step', 'Action', 'Expected Result', 'Pass/Fail', 'Remark'];
                } else {
                    tableHead.values = ['Test Case Name', 'Scenario', 'Step', 'Original Action', 'Original Expected', 'Change Status', 'New Action', 'New Expected', 'Result', 'Remark'];
                }
                tableHead.eachCell((c, colNum) => {
                    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                    c.alignment = { horizontal: 'center', vertical: 'middle' };
                    c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
                    if (!isFinal && colNum >= 6 && colNum <= 8) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
                });

                const tcGroups = {};
                rows.forEach(r => {
                    const tcKey = r.test_case_id || 'Unknown';
                    if(!tcGroups[tcKey]) tcGroups[tcKey] = [];
                    tcGroups[tcKey].push(r);
                });

                Object.values(tcGroups).forEach(tcRows => {
                    tcRows.sort((a, b) => (a.scenario_id_code || "").localeCompare(b.scenario_id_code || ""));
                    let isFirst = true;
                    tcRows.forEach((item, idx) => {
                        const row = worksheet.addRow([]);
                        // 🔥 ดึงข้อมูลลึกจาก Map
                        const fullScenario = scenarioMap[item.scenario_id] || {};
                        
                        if (isFirst) row.getCell(1).value = { richText: [{ text: (item.test_id_code||"")+'\n', font:{bold:true}}, { text: item.test_case_name||"" }] };
                        const scCode = (item.scenario_id_code||"").trim();
                        const prefix = scCode.startsWith("ST") ? "SIT Session\n" : (scCode.startsWith("UT") ? "UAT Session\n" : "");
                        row.getCell(2).value = { richText: [{ text: prefix, font:{bold:true}}, { text: scCode+' :\n', font:{bold:true}}, { text: item.scenario_name||"" }] };
                        row.getCell(3).value = idx + 1;
                        
                        // 🔥 เขียนข้อมูล Action / Expected ที่ Fetch มาได้
                        row.getCell(4).value = formatHtmlToExcel(fullScenario.action || "");
                        row.getCell(5).value = formatHtmlToExcel(fullScenario.expected_result || "");
                        
                        if (!isFinal) {
                            row.getCell(6).value = 'Keep';
                            row.getCell(6).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Keep,Modify,Delete"'] };
                            row.getCell(10).value = formatHtmlToExcel(fullScenario.information || fullScenario.remark || "");

                            row.eachCell((cell, col) => {
                                cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
                                cell.alignment = { vertical: 'top', wrapText: true };
                                if (col >= 6 && col <= 8) {
                                    cell.protection = { locked: false };
                                    if(col === 6) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
                                } else {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                                }
                            });
                        } else {
                            row.getCell(7).value = formatHtmlToExcel(fullScenario.information || fullScenario.remark || "");
                            row.eachCell(c => { c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }; c.alignment = { vertical:'top', wrapText:true }; });
                        }
                        isFirst = false;
                    });
                });

                if (!isFinal) {
                    worksheet.addRow([]);
                    const nHead = worksheet.addRow(['--- เพิ่มรายการใหม่ (New Items) ---']);
                    nHead.getCell(1).font = { bold: true, color: { argb: 'FF006100' } };
                    nHead.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
                    worksheet.mergeCells(`A${nHead.number}:J${nHead.number}`);
                    for(let i=0; i<10; i++) {
                        const nr = worksheet.addRow([]);
                        nr.getCell(6).value = 'New';
                        nr.getCell(6).font = { bold: true, color: { argb: 'FF006100' } };
                        nr.eachCell({includeEmpty:true}, cell => {
                            cell.protection = { locked: false };
                            cell.border = { top:{style:'dotted'}, left:{style:'dotted'}, bottom:{style:'dotted'}, right:{style:'dotted'} };
                        });
                    }
                }
                await worksheet.protect('pcs1234', { selectLockedCells: true, selectUnlockedCells: true });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `TC_${mainModuleName}_${statusSuffix}.xlsx`);

        } catch (err) {
            console.error(err);
            alert('Export Failed: ' + err.message);
        } finally {
            hideLoadingOverlay();
        }
    };

    // --- 5. RENDER TABLE (UI Display) ---

    function getPhaseBadgeClass(phaseCode) {
        switch (phaseCode?.toUpperCase()) {
            case 'UNIT': return 'text-bg-secondary';
            case 'SIT': return 'text-bg-warning';  
            case 'UAT': return 'text-bg-primary';  
            default: return 'text-bg-dark';
        }
    }

    function getResultBadge(status) {
        switch (status?.toLowerCase()) {
            case 'passed': return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Passed</span>';
            case 'failed': return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Failed</span>';
            case 'blocked': return '<span class="badge bg-warning text-dark"><i class="bi bi-slash-circle me-1"></i>Blocked</span>';
            case 'skipped': return '<span class="badge bg-secondary">Skipped</span>';
            default: return `<span class="badge bg-light text-secondary border">${status || 'Pending'}</span>`;
        }
    }

    function renderTable(dataToRender) {
        if (!reportTableBody) return;
        if (!dataToRender || dataToRender.length === 0) { 
            reportTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">No data found matching your criteria.</td></tr>`; 
            return; 
        }

        let html = '';

        for (let i = 0; i < dataToRender.length; i++) {
            const row = dataToRender[i];
            
            // 1. Module Info
            const isFirstRowOfModule = (i === 0) || (dataToRender[i - 1].module_id !== row.module_id);
            html += `<tr>`;

            if (isFirstRowOfModule) {
                let moduleRowSpan = 1;
                for (let j = i + 1; j < dataToRender.length && dataToRender[j].module_id === row.module_id; j++) { moduleRowSpan++; }

                const { main, sub } = parseModuleName(row.module_name);
                const mainUpper = main.toUpperCase();

                // Download Button (Circle, Minimal)
                const downloadBtn = `
                    <div class="mt-2">
                        <button class="btn btn-light rounded-circle border shadow-sm d-inline-flex align-items-center justify-content-center" 
                                style="width: 32px; height: 32px; padding: 0;"
                                onclick="exportModuleExcel('${row.module_group}')" 
                                title="Download Test Case" 
                                data-bs-toggle="tooltip">
                            <i class="bi bi-file-earmark-excel-fill text-success" style="opacity: 0.6; font-size: 0.85rem;"></i>
                        </button>
                    </div>`;

                // Prototype Badge
                const protoUrl = modulePrototypeMap[row.module_id];
                const protoDisplay = protoUrl 
                    ? `<div class="mt-2">
                         <a href="${protoUrl}" target="_blank" class="badge bg-info-subtle text-info-emphasis text-decoration-none border border-info-subtle" title="Click to view prototype">
                           <i class="bi bi-window me-1"></i>Prototype
                         </a>
                       </div>` 
                    : '';

                // Col 1: Main Module
                html += `<td rowspan="${moduleRowSpan}" class="align-top bg-white border-end text-center p-3">
                            <div class="fw-bold text-primary text-uppercase mb-1" style="font-size:0.9rem; letter-spacing:0.5px;">${mainUpper}</div>
                            ${downloadBtn}
                         </td>`;
                
                // Col 2: Sub Module
                html += `<td rowspan="${moduleRowSpan}" class="align-top bg-white border-end text-dark p-3" style="font-size:0.9rem;">
                            <div class="fw-medium">${sub}</div>
                            ${protoDisplay}
                         </td>`;
            }

            // 2. Test Objective
            const isFirstRowOfTc = (i === 0) || (dataToRender[i - 1].test_case_id !== row.test_case_id) || (dataToRender[i - 1].module_id !== row.module_id);
            if (isFirstRowOfTc) {
                let tcRowSpan = 1;
                for (let j = i + 1; j < dataToRender.length && dataToRender[j].module_id === row.module_id && dataToRender[j].test_case_id === row.test_case_id; j++) { tcRowSpan++; }

                const phase = allTestPhases.find(p => p.id === row.test_phase_id);
                const phaseBadge = phase 
                    ? `<span class="badge ${getPhaseBadgeClass(phase.phase_code)} me-1" style="font-size:0.7rem">${phase.phase_code}</span>` 
                    : '';
                const tcIdBadge = row.test_id_code 
                    ? `<span class="badge bg-light text-dark border me-1" style="font-size:0.7rem; font-weight:600;">${row.test_id_code}</span>` 
                    : '';

                html += `<td rowspan="${tcRowSpan}" class="align-top border-end p-3">
                            <div class="mb-1">${phaseBadge}${tcIdBadge}</div>
                            <div class="fw-medium text-dark" style="font-size:0.9rem;">${row.test_case_name || '-'}</div>
                         </td>`;
            }

            // 3. Test Name (Scenario)
            const scIdBadge = row.scenario_id_code 
                ? `<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle me-1" style="font-size:0.75rem;">${row.scenario_id_code}</span>` 
                : '';
            
            const scenarioLink = row.scenario_id 
                ? `<a href="/stk_scendt.html?sc_id=${row.scenario_id}" class="text-primary text-decoration-underline fw-medium" title="View Detail">${row.scenario_name || '-'}</a>` 
                : '-';

            const typeBadge = row.scenario_type 
                ? `<span class="ms-1 text-muted fst-italic small">[${row.scenario_type}]</span>` 
                : '';

            html += `<td class="align-middle p-2">
                        <div style="line-height: 1.6;">${scIdBadge}${scenarioLink}${typeBadge}</div>
                     </td>`;

            // 4. Result
            html += `<td class="text-center align-middle">${getResultBadge(row.result)}</td>`;

            html += `</tr>`;
        }
        reportTableBody.innerHTML = html;
    }

    // --- 5. OPTIONS & INIT ---

    async function populateModuleFilter() {
        if (!moduleFilter) return;
        try {
            const { data } = await supabaseClient.from('MasterOptions').select('option_id, option_label').eq('option_group', 'PCSMODULE').order('display_order').order('option_label');
            moduleFilter.innerHTML = '<option value="all" selected>แสดงทุก Module หลัก</option>';
            data?.forEach(opt => {
                const el = document.createElement('option'); el.value = opt.option_id; el.textContent = opt.option_label; moduleFilter.appendChild(el);
            });
        } catch (e) { console.error(e); }
    }

    async function fetchAllSubModules() {
        try {
            const { data } = await supabaseClient.from('MasterOptions').select('*').eq('option_group', 'PCSSUBMOD').order('display_order');
            allSubModules = data || [];
        } catch (e) { console.error(e); }
    }

    function populateSubModuleFilter(selectedMainId) {
        if (!subModuleFilter) return;
        subModuleFilter.innerHTML = '<option value="all" selected>แสดงทุก Sub Module</option>';
        if (!selectedMainId || selectedMainId === 'all') { subModuleFilter.disabled = true; return; }
        subModuleFilter.disabled = false;
        allSubModules.filter(sub => sub.option_relation === selectedMainId).forEach(opt => {
            const el = document.createElement('option'); el.value = opt.option_id; el.textContent = opt.option_label; subModuleFilter.appendChild(el);
        });
    }

    async function fetchTestPhases() {
        const { data } = await supabaseClient.from('test_phases').select('*').order('display_order');
        allTestPhases = data || [];
        if (phaseFilter) {
            phaseFilter.innerHTML = '<option value="all" selected>All Phases</option>';
            allTestPhases.forEach(p => {
                const el = document.createElement('option'); el.value = p.id; el.textContent = `${p.name} (${p.phase_code})`; phaseFilter.appendChild(el);
            });
        }
    }

    function applyFiltersAndRender() {
        const selModule = moduleFilter?.value || 'all';
        const selSubMod = subModuleFilter?.value || 'all';
        const selPhase = phaseFilter?.value || 'all';
        const selStatus = statusFilter?.value || 'all';

        let filtered = reportViewData;
        if (selModule !== 'all') filtered = filtered.filter(r => r.module_group === selModule);
        if (selSubMod !== 'all') filtered = filtered.filter(r => r.module_subgroup === selSubMod);
        if (selPhase !== 'all') filtered = filtered.filter(r => r.test_phase_id === selPhase);
        if (selStatus !== 'all') filtered = filtered.filter(r => (r.result || 'N/A').toLowerCase() === selStatus.toLowerCase());

        renderTable(filtered);
    }

    async function init() {
        if (typeof supabaseClient === 'undefined') { showError('DB Error'); return; }
        await Promise.all([ populateModuleFilter(), fetchAllSubModules(), fetchTestPhases() ]);
        reportViewData = await fetchData();
        applyFiltersAndRender();

        moduleFilter.addEventListener('change', () => { populateSubModuleFilter(moduleFilter.value); applyFiltersAndRender(); });
        subModuleFilter.addEventListener('change', applyFiltersAndRender);
        phaseFilter.addEventListener('change', applyFiltersAndRender);
        statusFilter.addEventListener('change', applyFiltersAndRender);
    }

    init();
});