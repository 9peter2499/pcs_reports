// =================================================================
// PCS Test Case - Stakeholder Scenario Detail (Read-only V2)
// File: js/stk_scendt.js
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {

    const urlParams = new URLSearchParams(window.location.search);
    const scenarioId = urlParams.get('sc_id');
    const groupId = urlParams.get('group'); 

    // DOM Elements Mapping
    const dom = {
        loading: document.getElementById('loading-area'),
        detailArea: document.getElementById('detail-area'),
        btnBack: document.getElementById('btn-back'),
        
        // Context Inputs
        inpTestId: document.getElementById('inp-test-id'),
        inpTestName: document.getElementById('inp-test-name'),
        inpModule: document.getElementById('inp-module'),
        inpScId: document.getElementById('inp-sc-id'),
        inpScName: document.getElementById('inp-sc-name'),
        inpRemark: document.getElementById('inp-remark'),
        
        // Rich Text Areas
        pre: document.getElementById('view-pre-condition'),
        info: document.getElementById('view-info'),
        action: document.getElementById('view-action'),
        expected: document.getElementById('view-expected'),
        related: document.getElementById('view-related-tor')
    };

    // Setup Back Button
    if (dom.btnBack) {
        dom.btnBack.onclick = () => {
            if (groupId) {
                window.location.href = `/stk_torwtc.html?group=${groupId}`;
            } else {
                window.history.back();
            }
        };
    }

    if (!scenarioId) {
        dom.loading.innerHTML = '<div class="alert alert-danger">ไม่พบรหัส Scenario (ID Missing)</div>';
        return;
    }

    try {
        // 🔥 Update Query: ดึง Module Name และ Remark
        const { data: sc, error } = await supabaseClient
            .from('scenarios')
            .select(`
                *,
                test_cases (
                    test_id_code, 
                    name,
                    pcs_module:pcs_module_id ( name ), 
                    tor_test_case_links ( 
                        tor_id, 
                        TORs ( tor_name ) 
                    )
                )
            `)
            .eq('id', scenarioId)
            .single();

        if (error) throw error;
        if (!sc) throw new Error('Scenario not found');

        renderData(sc);

    } catch (err) {
        console.error(err);
        dom.loading.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }

    function renderData(sc) {
        dom.loading.style.display = 'none';
        dom.detailArea.style.display = 'block';
        
        const tc = sc.test_cases || {};

        // 1. Fill Context Inputs
        dom.inpTestId.value = tc.test_id_code || '-';
        dom.inpTestName.value = tc.name || '-';
        dom.inpModule.value = tc.pcs_module?.name || '-'; // Module Name
        
        dom.inpScId.value = sc.scenario_id_code || '-';
        dom.inpScName.value = sc.name || '-';
        dom.inpRemark.value = sc.remark || ''; // Remark

        // 2. Fill Rich Text Areas (แปลง \n เป็น <br> เพื่อความสวยงาม)
        const formatText = (text) => text ? text.replace(/\n/g, '<br>') : '-';

        dom.pre.innerHTML = formatText(sc.pre_condition);
        dom.info.innerHTML = formatText(sc.information);
        dom.action.innerHTML = formatText(sc.action);
        dom.expected.innerHTML = formatText(sc.expected_result);

        // 3. Related TOR Info
        if (tc.tor_test_case_links && tc.tor_test_case_links.length > 0) {
            const torNames = tc.tor_test_case_links.map(l => l.TORs?.tor_name).filter(Boolean).join(', ');
            dom.related.innerHTML = `
                <div>
                    <strong class="d-block text-info-emphasis mb-1">Related TORs:</strong>
                    <span>${torNames}</span>
                </div>`;
        } else {
            dom.related.textContent = 'No linked TOR';
        }
    }
});