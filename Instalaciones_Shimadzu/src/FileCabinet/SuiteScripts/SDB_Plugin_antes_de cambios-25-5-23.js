/**
 * - PlugIn Implementation - 
 */

 function customizeGlImpact(transactionRecord, standardLines, customLines, book) {

    if (standardLines.getCount() == 0) return;
    var recordType = transactionRecord.getRecordType();
    var rcdId = transactionRecord.getId();
    var moneda = transactionRecord.getFieldText('currency');
    var itemDescription = transactionRecord.getLineItemValue('inventory', 'description', 1);
    nlapiLogExecution("DEBUG", "description", transactionRecord.getLineItemValue('inventory', 'description', 1));
    //var cuentaMonedaExt = transactionRecord.getFieldValue('custbody_sdb_cuenta_extranjera');
    nlapiLogExecution("DEBUG", "recordType", recordType);

    var isAdjutment = recordType == 'inventoryadjustment';
    // inventory adjustment and Item recipt logic
    if (isAdjutment || recordType == "itemreceipt") {
        nlapiLogExecution("DEBUG", "RUN", 'RUN... inventoryadjustment || itemreceipt');
        try {
            var installed = false;
            //Validacion si esta instalado para el inventoryadjustment negativo
            if (isAdjutment && transactionRecord.getFieldValue('custbody_sdb_ifulfill_req_install')) {
                var customrecord_sdb_item_installed_rec_recSearch = nlapiSearchRecord("customrecord_sdb_item_installed_rec", null,
                    [
                        ["custrecord_sdb_inv_adj_installed_rec", "anyof", rcdId]
                    ],
                    null
                );
                if (customrecord_sdb_item_installed_rec_recSearch) installed = true;
            }
            if(isAdjutment) installed = transactionRecord.getFieldValue('custbody_sdb_install_gl_usage')
            nlapiLogExecution("AUDIT", "inventoryadjustment installed ", installed);
            var configData = nlapiLookupField('customrecord_sdb_rcd_conf_plugin', 1, ['custrecord_sdb_intercompany_if','custrecord_sdb_cuenta_costo', 'custrecord_sdb_inv_cost_3ro', 'custrecord_sdb_inv_cost_ic', 'custrecord_sdb_momento_vta_ci', 'custrecord_sdb_inv_art_intercom', 'custrecord_sdb_inv_art_3ro', 'custrecord_sdb_adj_acc_puente', 'custrecord_sdb_adj_tr1_tr2', 'custrecord_sdb_adj_j1', 'custrecord_sdb_adj_ds', 'custrecord_sdb_adj_iac', 'custrecordsdb_adj_a1', 'custrecord_sdb_discount_puente', 'custrecord_sdb_discount_inter_acc', 'custrecord_sdb_discount_3ro_acc'])
            nlapiLogExecution("AUDIT", "standardLines.getCount() ", standardLines.getCount());
            var iter_3ro_acc = [configData.custrecord_sdb_inv_art_intercom, configData.custrecord_sdb_inv_art_3ro];
            var accCost = [configData.custrecord_sdb_inv_cost_ic, configData.custrecord_sdb_inv_cost_3ro, configData.custrecord_sdb_cuenta_costo]
            nlapiLogExecution("AUDIT", "accCostaccCost ", accCost);
            //INSTALLED
            if (installed || installed == "T") {//Si el inventoryadjustment (-) se crea al instalar 
                var itemFulFill = transactionRecord.getFieldValue('custbody_sdb_ifulfill_req_install')
                if (!itemFulFill) return;
                var fulfillData = nlapiLookupField('itemfulfillment', itemFulFill, ['createdfrom', 'trandate'])

                var invoice;
                var items = itemListIf(itemFulFill, 'itemfulfillment')
                if (items) invoice = getShipDate(items, fulfillData.createdfrom)
                nlapiLogExecution("DEBUG", "ifulfillData.createdfrom ", fulfillData.createdfrom);
                nlapiLogExecution("DEBUG", "invoice ", invoice.id);
                var validateDare = fulfillData.trandate == invoice.date;
                var invoice_Gl = getGlImpact('invoice', invoice.id);
                var fulfill_Gl = getGlImpact('itemfulfillment', itemFulFill);
                var isInterCompany;
                var terceros;
                var customerData = nlapiLookupField('customer', invoice.customer, ['custentity_sdb_posting_group'], 'T');
                if (customerData.custentity_sdb_posting_group) {
                    isInterCompany = customerData.custentity_sdb_posting_group.indexOf('INTERCOMP');
                    terceros = customerData.custentity_sdb_posting_group.indexOf('3RDCOMPANY');
                }
                nlapiLogExecution("AUDIT", "invoice_Gl ", JSON.stringify(invoice_Gl));
                nlapiLogExecution("AUDIT", "fulfill_Gl ", JSON.stringify(fulfill_Gl));
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, ['type', 'name']);
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var debitValue;
                    // if (accType.name.indexOf('Inventory') == -1 && accType.name.indexOf('Interim') == -1 && recordType == "itemreceipt") continue;
                    var custrecord_sdb_adj_iac;
                    if (currentAcc == configData.custrecord_sdb_adj_iac) custrecord_sdb_adj_iac = parseFloat(standardLines.getLine(i).getDebitAmount()) || parseFloat(standardLines.getLine(i).getCreditAmount());
                    nlapiLogExecution("AUDIT", "currentLocation ", currentLocation);
                    if (i == 0) continue;
                    if (parseFloat(standardLines.getLine(i).getDebitAmount()) > 0) {
                        debitValue = parseFloat(standardLines.getLine(i).getDebitAmount())
                        // var locationline = standardLines.getLine(i).getLocationId();
                        nlapiLogExecution("AUDIT", "currentLocation ", currentLocation);
                        var locationline;
                        if (currentLocation) locationline = nlapiLookupField('location', currentLocation, 'name');
                        // if (currentLocation == '' || !currentLocation) continue;
                     
                        var location = returnAccounForLocation(locationline, configData);
                        nlapiLogExecution("AUDIT", "account to set ", location);
                        if (!location) continue;
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(location));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(currentAcc));



                        //var fulfill_Gl = fiterInvData(fulfill_Gl, configData.custrecord_sdb_adj_iac, null);
                        // var filterInv = fiterInvData(invoice_Gl, configData.custrecord_sdb_inv_art_intercom, configData.custrecord_sdb_inv_art_3ro);

                        // // custrecord_sdb_cuenta_costo, custrecord_sdb_inv_cost_ic, custrecord_sdb_inv_cost_3ro
                        // // var filterCostShip = arr.filter(function (pos) {
                        // //     return (pos.account == configData.custrecord_sdb_inv_cost_ic || pos.account == configData.custrecord_sdb_inv_cost_3ro,configData.custrecord_sdb_cuenta_costo) ;
                        // // });

                        // if (fulfill_Gl && fulfill_Gl.length) {

                        //     for (var t = 0; t < fulfill_Gl.length; t++) {
                        //         if (fulfill_Gl[t].debit && fulfill_Gl[t].account == configData.custrecord_sdb_adj_iac) {
                        //             nlapiLogExecution("AUDIT", "fulfill_Gl[t]1", JSON.stringify(fulfill_Gl[t]));
                        //             var newLine = customLines.addNewLine();
                        //             newLine.setCreditAmount(fulfill_Gl[t].debit);
                        //             if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                        //             if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                        //             if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                        //             if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                        //             if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                        //             if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //             newLine.setAccountId(parseInt(fulfill_Gl[t].account));
                        //         } else if (accCost.indexOf(fulfill_Gl[t].account) != -1 && fulfill_Gl[t].debit) {
                        //             nlapiLogExecution("AUDIT", "fulfill_Gl[t]2", JSON.stringify(fulfill_Gl[t]));
                        //             var newLine = customLines.addNewLine();
                        //             newLine.setdebitAmount(fulfill_Gl[t].debit);
                        //             if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                        //             if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                        //             if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                        //             if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                        //             if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                        //             if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //             newLine.setAccountId(parseInt(fulfill_Gl[t].account));
                        //         }
                        //     }
                        // }
                        // if (filterInv && filterInv.length && validateDare) {

                        //     for (var x = 0; x < filterInv.length; x++) {
                        //         nlapiLogExecution("AUDIT", "filterInv", JSON.stringify(filterInv[x]));
                        //         var newLine = customLines.addNewLine();
                        //         newLine.setDebitAmount(filterInv[x].debit);
                        //         if (filterInv[x].memo) newLine.setMemo(filterInv[x].memo)
                        //         if (filterInv[x].class) newLine.setClassId(parseInt(filterInv[x].class));
                        //         if (filterInv[x].department) newLine.setDepartmentId(parseInt(filterInv[x].department));
                        //         if (entity && accType != 'AcctRec') newLine.setEntityId(filterInv[x].entity)
                        //         if (filterInv[x].segment) newLine.setSegmentValueId('cseg1', filterInv[x].segment);
                        //         if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //         newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));
                        //     }
                        // }else if(fulfill_Gl && fulfill_Gl.length && !validateDare){
                        //     for (var x = 0; x < fulfill_Gl.length; x++) {
                        //         nlapiLogExecution("AUDIT", "fulfill_Gl", JSON.stringify(fulfill_Gl[x]));
                        //         var newLine = customLines.addNewLine();
                        //         newLine.setDebitAmount(filterInv[x].debit);
                        //         if (fulfill_Gl[x].memo) newLine.setMemo(fulfill_Gl[x].memo)
                        //         if (fulfill_Gl[x].class) newLine.setClassId(parseInt(fulfill_Gl[x].class));
                        //         if (fulfill_Gl[x].department) newLine.setDepartmentId(parseInt(fulfill_Gl[x].department));
                        //         if (entity && accType != 'AcctRec') newLine.setEntityId(fulfill_Gl[x].entity)
                        //         if (fulfill_Gl[x].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[x].segment);
                        //         if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //         newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));
                        //     }
                        // }

                    } else if (parseFloat(standardLines.getLine(i).getCreditAmount()) > 0) {

                        debitValue = parseFloat(standardLines.getLine(i).getCreditAmount())
                        // var locationline = standardLines.getLine(i).getLocationId();
                        nlapiLogExecution("AUDIT", "currentLocation ", currentLocation);
                        var locationline;
                        if (currentLocation) locationline = nlapiLookupField('location', currentLocation, 'name');
                        // if (currentLocation == '' || !currentLocation) continue;
                        nlapiLogExecution("AUDIT", "locationline 2", locationline);
                        nlapiLogExecution("DEBUG", "debitValue-currentAcc -entity ", debitValue + ' - ' + currentAcc + '-' + entity);
                        nlapiLogExecution("AUDIT", "setCreditAmount ", standardLines.getLine(i).getCreditAmount());
                        nlapiLogExecution("AUDIT", "segment 2", standardLines.getLine(i).getSegmentValueId('cseg1'))

                        // nlapiLogExecution("AUDIT", "account to set ", configData.custrecordsdb_adj_a1);
                        var location = returnAccounForLocation(locationline, configData);
                        nlapiLogExecution("AUDIT", "account to set ", location);

                        if (!location) continue;
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(parseInt(standardLines.getLine(i).getClassId()));
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(location));

                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(parseInt(standardLines.getLine(i).getClassId()));
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(currentAcc));

                        // var filterInv = fiterInvData(invoice_Gl, configData.custrecord_sdb_inv_art_intercom, configData.custrecord_sdb_inv_art_3ro);
                        // if (fulfill_Gl && fulfill_Gl.length) {

                        //     for (var t = 0; t < fulfill_Gl.length; t++) {
                        //         if (fulfill_Gl[t].debit && fulfill_Gl[t].account == configData.custrecord_sdb_adj_iac) {
                        //             nlapiLogExecution("AUDIT", "fulfill_Gl[t]3", JSON.stringify(fulfill_Gl[t]));
                        //             var newLine = customLines.addNewLine();
                        //             newLine.setCreditAmount(fulfill_Gl[t].debit);
                        //             if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                        //             if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                        //             if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                        //             if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                        //             if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                        //             if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //             newLine.setAccountId(parseInt(fulfill_Gl[t].account));
                        //         } else if (accCost.indexOf(fulfill_Gl[t].account) != -1 && fulfill_Gl[t].debit) {
                        //             nlapiLogExecution("AUDIT", "fulfill_Gl[t]4", JSON.stringify(fulfill_Gl[t]));
                        //             var newLine = customLines.addNewLine();
                        //             newLine.setdebitAmount(fulfill_Gl[t].debit);
                        //             if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                        //             if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                        //             if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                        //             if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                        //             if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                        //             if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //             newLine.setAccountId(parseInt(fulfill_Gl[t].account));
                        //         }
                        //     }
                        // }
                        // if (filterInv && filterInv.length && validateDare) {

                        //     for (var x = 0; x < filterInv.length; x++) {
                        //         nlapiLogExecution("AUDIT", "filterInv", JSON.stringify(filterInv[x]));
                        //         var newLine = customLines.addNewLine();
                        //         newLine.setDebitAmount(filterInv[x].debit);
                        //         if (filterInv[x].memo) newLine.setMemo(filterInv[x].memo)
                        //         if (filterInv[x].class) newLine.setClassId(parseInt(filterInv[x].class));
                        //         if (filterInv[x].department) newLine.setDepartmentId(parseInt(filterInv[x].department));
                        //         if (entity && accType != 'AcctRec') newLine.setEntityId(filterInv[x].entity)
                        //         if (filterInv[x].segment) newLine.setSegmentValueId('cseg1', parseInt(filterInv[x].segment));
                        //         if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //         newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));
                        //     }
                        // }else if(fulfill_Gl && fulfill_Gl.length && !validateDare){
                        //     for (var x = 0; x < fulfill_Gl.length; x++) {
                        //         nlapiLogExecution("AUDIT", "fulfill_Gl", JSON.stringify(fulfill_Gl[x]));
                        //         var newLine = customLines.addNewLine();
                        //         newLine.setDebitAmount(filterInv[x].debit);
                        //         if (fulfill_Gl[x].memo) newLine.setMemo(fulfill_Gl[x].memo)
                        //         if (fulfill_Gl[x].class) newLine.setClassId(parseInt(fulfill_Gl[x].class));
                        //         if (fulfill_Gl[x].department) newLine.setDepartmentId(parseInt(fulfill_Gl[x].department));
                        //         if (entity && accType != 'AcctRec') newLine.setEntityId(fulfill_Gl[x].entity)
                        //         if (fulfill_Gl[x].segment) newLine.setSegmentValueId('cseg1', parseInt(fulfill_Gl[x].segment));
                        //         if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        //         newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));
                        //     }
                        // }
                    }
                }

                var filterInv = fiterInvData(invoice_Gl, configData.custrecord_sdb_inv_art_intercom, configData.custrecord_sdb_inv_art_3ro);

                // custrecord_sdb_cuenta_costo, custrecord_sdb_inv_cost_ic, custrecord_sdb_inv_cost_3ro
                // var filterCostShip = arr.filter(function (pos) {
                //     return (pos.account == configData.custrecord_sdb_inv_cost_ic || pos.account == configData.custrecord_sdb_inv_cost_3ro,configData.custrecord_sdb_cuenta_costo) ;
                // });

                if (fulfill_Gl && fulfill_Gl.length) {

                    for (var t = 0; t < fulfill_Gl.length; t++) {
                        nlapiLogExecution("AUDIT", "accCost1", JSON.stringify(accCost));
                        nlapiLogExecution("AUDIT", "accCost.indexOf(fulfill_Gl[t].account)1", accCost.indexOf(fulfill_Gl[t].account));
                        nlapiLogExecution("AUDIT", "fulfill_Gl[t].account)1", fulfill_Gl[t].account);
                        nlapiLogExecution("AUDIT", "fulfill_Gl[t].debit1", JSON.stringify(fulfill_Gl[t]));
                        if(!fulfill_Gl[t].account) continue;
                        if (fulfill_Gl[t].debit && fulfill_Gl[t].account == configData.custrecord_sdb_adj_iac && custrecord_sdb_adj_iac == fulfill_Gl[t].debit) {
                            nlapiLogExecution("AUDIT", "fulfill_Gl[t]1", JSON.stringify(fulfill_Gl[t]));
                            // var newLine = customLines.addNewLine();
                            // newLine.setDebitAmount(fulfill_Gl[t].debit);
                            // if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                            // if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                            // if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                            // if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                            // if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            // newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(fulfill_Gl[t].debit);
                            if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                            if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                            if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                            if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                            if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));

                            // var newLine = customLines.addNewLine();
                            // newLine.setDebitAmount('1143.22');
                            // if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                            // if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                            // if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                            // if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                            // if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            // newLine.setAccountId(parseInt(configData.custrecord_sdb_intercompany_if));

                           
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(fulfill_Gl[t].debit);
                            if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                            if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                            if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                            if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                            if (currentLocation) newLine.setLocationId(parseInt(currentLocation))
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));//51450 Cost of Sales : Cost of Sales, Intercompany
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));//51400 Cost of Sales : Cost of Sales, 3rd Company
                        } else if (accCost.indexOf(fulfill_Gl[t].account) != -1 && fulfill_Gl[t].debit) {//<><><><<><>
                            nlapiLogExecution("AUDIT", "fulfill_Gl <><><><<><>>>>",fulfill_Gl[t].debit );
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(fulfill_Gl[t].debit);
                            if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                            if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                            if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                            if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                            if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            newLine.setAccountId(parseInt(fulfill_Gl[t].account));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(fulfill_Gl[t].debit);
                            if (fulfill_Gl[t].memo) newLine.setMemo(fulfill_Gl[t].memo)
                            if (fulfill_Gl[t].class) newLine.setClassId(parseInt(fulfill_Gl[t].class));
                            if (fulfill_Gl[t].department) newLine.setDepartmentId(parseInt(fulfill_Gl[t].department));
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(fulfill_Gl[t].name))
                            if (fulfill_Gl[t].segment) newLine.setSegmentValueId('cseg1', fulfill_Gl[t].segment);
                            if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                        }
                    }
                }
                // return;
                if (filterInv && filterInv.length && validateDare) {

                    for (var x = 0; x < filterInv.length; x++) {
                        nlapiLogExecution("AUDIT", "filterInv--", JSON.stringify(filterInv[x]));

                        if (itemDescription == filterInv[x].memo) {
                            // var newLine = customLines.addNewLine();
                            // newLine.setCreditAmount(filterInv[x].debit);
                            // if (filterInv[x].memo) newLine.setMemo(filterInv[x].memo)
                            // if (filterInv[x].class) newLine.setClassId(parseInt(filterInv[x].class));
                            // if (filterInv[x].department) newLine.setDepartmentId(parseInt(filterInv[x].department));
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(filterInv[x].entity)
                            // if (filterInv[x].segment) newLine.setSegmentValueId('cseg1', parseInt(filterInv[x].segment));
                            // if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            // newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(filterInv[x].debit);
                            if (filterInv[x].memo) newLine.setMemo(filterInv[x].memo)
                            if (filterInv[x].class) newLine.setClassId(parseInt(filterInv[x].class));
                            if (filterInv[x].department) newLine.setDepartmentId(parseInt(filterInv[x].department));
                            if (entity && accType != 'AcctRec') newLine.setEntityId(filterInv[x].entity)
                            if (filterInv[x].segment) newLine.setSegmentValueId('cseg1', parseInt(filterInv[x].segment));
                            if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(filterInv[x].debit);
                            if (filterInv[x].memo) newLine.setMemo(filterInv[x].memo)
                            if (filterInv[x].class) newLine.setClassId(parseInt(filterInv[x].class));
                            if (filterInv[x].department) newLine.setDepartmentId(parseInt(filterInv[x].department));
                            if (entity && accType != 'AcctRec') newLine.setEntityId(filterInv[x].entity)
                            if (filterInv[x].segment) newLine.setSegmentValueId('cseg1', parseInt(filterInv[x].segment));
                            if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));//41200 Sales : Sales, Intercompany
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));//41100 Sales : Sales, 3rd Company

                        }
                    }
                } else if (fulfill_Gl && fulfill_Gl.length && !validateDare) {// Validar estos seteaos estan bien
                    for (var x = 0; x < fulfill_Gl.length; x++) {
                       nlapiLogExecution("AUDIT", "fulfill_Gl==", JSON.stringify(fulfill_Gl[x]));
                       if(!fulfill_Gl[x].account || !fulfill_Gl[x].debit) continue;
                        if (fulfill_Gl[x].debit != custrecord_sdb_adj_iac) {// se modifico por error al itear inv y IF
                            
                            // var newLine = customLines.addNewLine();
                            // newLine.setDebitAmount(fulfill_Gl[x].debit);
                            // if (fulfill_Gl[x].memo) newLine.setMemo(fulfill_Gl[x].memo)
                            // if (fulfill_Gl[x].class) newLine.setClassId(parseInt(fulfill_Gl[x].class));
                            // if (fulfill_Gl[x].department) newLine.setDepartmentId(parseInt(fulfill_Gl[x].department));
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(fulfill_Gl[x].entity)
                            // if (fulfill_Gl[x].segment) newLine.setSegmentValueId('cseg1', parseInt(fulfill_Gl[x].segment));
                            // if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            // newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));

                            // var newLine = customLines.addNewLine();
                            // newLine.setDebitAmount(fulfill_Gl[x].debit);
                            // if (fulfill_Gl[x].memo) newLine.setMemo(fulfill_Gl[x].memo)
                            // if (fulfill_Gl[x].class) newLine.setClassId(parseInt(fulfill_Gl[x].class));
                            // if (fulfill_Gl[x].department) newLine.setDepartmentId(parseInt(fulfill_Gl[x].department));
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(fulfill_Gl[x].entity)
                            // if (fulfill_Gl[x].segment) newLine.setSegmentValueId('cseg1', parseInt(fulfill_Gl[x].segment));
                            // if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            // //newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));
                            // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));//41200 Sales : Sales, Intercompany
                            // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));//41100 Sales : Sales, 3rd Company
                        }
                    }
                }
            } else {
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, ['type', 'name']);
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var debitValue;
                    if (accType.name.indexOf('Inventory') == -1 && accType.name.indexOf('Interim') == -1 && recordType == "itemreceipt") continue;
                    nlapiLogExecution("AUDIT", "currentLocation ", currentLocation);
                    if (i == 0) continue;
                    if (parseFloat(standardLines.getLine(i).getDebitAmount()) > 0) {

                        debitValue = parseFloat(standardLines.getLine(i).getDebitAmount())
                        // var locationline = standardLines.getLine(i).getLocationId();
                        nlapiLogExecution("AUDIT", "currentLocation ", currentLocation);
                        var locationline;
                        if (currentLocation) locationline = nlapiLookupField('location', currentLocation, 'name');
                        // if (currentLocation == '' || !currentLocation) continue;
                        nlapiLogExecution("AUDIT", "locationline 1", locationline);
                        nlapiLogExecution("DEBUG", "debitValue-currentAcc -entity ", debitValue + ' - ' + currentAcc + '-' + entity);
                        nlapiLogExecution("AUDIT", "getDebitAmount ", standardLines.getLine(i).getDebitAmount());
                        nlapiLogExecution("AUDIT", "segment 1", standardLines.getLine(i).getSegmentValueId('cseg1'))

                        var location = returnAccounForLocation(locationline, configData);
                        nlapiLogExecution("AUDIT", "account to set ", location);
                        if (!location) continue;
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(location));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(currentAcc));

                    } else if (parseFloat(standardLines.getLine(i).getCreditAmount()) > 0) {

                        debitValue = parseFloat(standardLines.getLine(i).getCreditAmount())
                        // var locationline = standardLines.getLine(i).getLocationId();
                        nlapiLogExecution("AUDIT", "currentLocation ", currentLocation);
                        var locationline;
                        if (currentLocation) locationline = nlapiLookupField('location', currentLocation, 'name');
                        // if (currentLocation == '' || !currentLocation) continue;
                        nlapiLogExecution("AUDIT", "locationline 2", locationline);
                        nlapiLogExecution("DEBUG", "debitValue-currentAcc -entity ", debitValue + ' - ' + currentAcc + '-' + entity);
                        nlapiLogExecution("AUDIT", "setCreditAmount ", standardLines.getLine(i).getCreditAmount());
                        nlapiLogExecution("AUDIT", "segment 2", standardLines.getLine(i).getSegmentValueId('cseg1'))

                        // nlapiLogExecution("AUDIT", "account to set ", configData.custrecordsdb_adj_a1);
                        var location = returnAccounForLocation(locationline, configData);
                        nlapiLogExecution("AUDIT", "account to set ", location);

                        if (!location) continue;
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(location));

                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(debitValue);
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        newLine.setAccountId(parseInt(currentAcc));
                    }
                }
            }

        } catch (er) {
            nlapiLogExecution("ERROR", "ERROR " + recordType, er);
        }
    }

    // Invoice Logic

    if (recordType == 'invoice') {

        try {
            var shipdate = transactionRecord.getFieldValue('shipdate');
            var invAccount = transactionRecord.getFieldValue('account');
            var flag = transactionRecord.getFieldValue('custbody_sdb_date_gl_plugin');
            var instalacion = transactionRecord.getFieldValue('custbody_sdb_requires_installation');
            var createFrom = transactionRecord.getFieldValue('createdfrom');
            var installed = transactionRecord.getFieldValue('custbody_sdb_if_installed');
            var trandate = transactionRecord.getFieldValue('trandate');

            // if (instalacion == 'T') installed = itemValuesList(createFrom, 'salesorder', false)
            // var d = nlapiDateToString(trandate, 'date')
            //nlapiLogExecution("AUDIT", "d", d);
              if (instalacion == 'F' || instalacion) return;
            nlapiLogExecution("AUDIT", "shipdate", shipdate);
            nlapiLogExecution("AUDIT", "trandate", trandate);
            var diff = false;
            if (shipdate) {
                // shipdate = shipdate.split('/').reverse().join('/');
                diff = trandate == shipdate;
            }
            nlapiLogExecution("AUDIT", "diff", diff);
            var configData = nlapiLookupField('customrecord_sdb_rcd_conf_plugin', 1, ['custrecord_sdb_adj_iac', 'custrecord_sdb_momento_vta_ci', 'custrecord_sdb_is_3ros_acc', 'custrecord_sdb_inv_puente_acc', 'custrecord_sdb_inv_art_3ro', 'custrecord_sdb_inv_art_intercom', 'custrecord_sdb_inv_cos_intercom', 'custrecord_sdb_inv_gasto_3ro', 'custrecord_sdb_intercompany_acc_invoice', 'custrecord_sdb_cost_account', 'custrecord_sdb_cat_por_cobrar_inv', 'custrecord_sdb_inv_item_acc', 'custrecord_sdb_cuenta_costo', 'custrecord_sdb_inv_cost_ic', 'custrecord_sdb_art_account', 'custrecord_sdb_acc_expense', 'custrecord_sdb_inv_cost_3ro', 'custrecord_sdb_discount_puente', 'custrecord_sdb_discount_inter_acc', 'custrecord_sdb_discount_3ro_acc'])
            var isInterCompany = configData.custrecord_sdb_intercompany_acc_invoice;
            var terceros = configData.custrecord_sdb_is_3ros_acc;
            var ctaPuenteInv = configData.custrecord_sdb_inv_puente_acc;
            var venta_instalacion = configData.custrecord_sdb_momento_vta_ci;
            var costosAcc = [configData.custrecord_sdb_inv_cost_ic, configData.custrecord_sdb_inv_cost_3ro]
            //  var arrData = itemValuesList(transactionRecord);
            nlapiLogExecution("AUDIT", "location ", JSON.stringify(configData));
            var iter_3ro_acc = [configData.custrecord_sdb_inv_art_intercom, configData.custrecord_sdb_inv_art_3ro];
            if (isInterCompany) {
                isInterCompany = isInterCompany.split(',').indexOf(invAccount);
            }
            if (terceros) {
                terceros = terceros.split(',').indexOf(invAccount);
            }

            // nlapiLogExecution("DEBUG", "customLines.getCount()", customLines.getCount());
            nlapiLogExecution("DEBUG", "isInterCompany + '< >' + terceros", isInterCompany + '< >' + terceros);
            nlapiLogExecution("DEBUG", "diff date", diff);
            nlapiLogExecution("DEBUG", "Req instalacion", instalacion);
            nlapiLogExecution("AUDIT", " installed ", installed);
            if (installed == 'T') {// Si se intalo 100%
                nlapiLogExecution("AUDIT", " installed <<>>", installed);
                var count = 0;
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;

                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var validateACC = iter_3ro_acc.indexOf(currentAcc);// Si es pertenece a cuenta de tercero || intercompany
                    // nlapiLogExecution("AUDIT", " currentAcc <<>>", currentAcc);
                    // if (i > 0) {
                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0 && currentAcc == configData.custrecord_sdb_inv_puente_acc) {

                        nlapiLogExecution("AUDIT", " installed if1 <<>>", instalacion);
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        //  newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));//41200 Sales : Sales, Intercompany
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));//41100 Sales : Sales, 3rd Company

                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));//41200 Sales : Sales, Intercompany
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));//41100 Sales : Sales, 3rd Company
                        // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                        // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));

                    }// } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0 && currentAcc == configData.custrecord_sdb_inv_puente_acc) {// Si la cuenta es puente ("41799 Sales : Sales, (Interim)) se balancea y se setea nueva linea con cuenta descuento (intercompany o terceros)
                    //     nlapiLogExecution("AUDIT", " installed if2 <<>>", instalacion);
                    //     var newLine = customLines.addNewLine();
                    //     newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                    //     newLine.setLocationId(parseInt(currentLocation));
                    //     if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                    //     if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                    //     if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                    //     if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                    //     if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    //     newLine.setAccountId(parseInt(currentAcc));

                    //     var newLine = customLines.addNewLine();
                    //     newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                    //     newLine.setLocationId(parseInt(currentLocation));
                    //     if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                    //     if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                    //     if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                    //     if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                    //     if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    //     // newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                    //     if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));//41200 Sales : Sales, Intercompany
                    //     if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));//41100 Sales : Sales, 3rd Company
                    //     var newLine = customLines.addNewLine();

                    //     newLine.setDebitAmount(Number(standardLines.getLine(i).getDebitAmount()));
                    //     newLine.setLocationId(parseInt(currentLocation));
                    //     if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                    //     if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                    //     if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                    //     if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                    //     if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    //     // newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                    //     if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));//41200 Sales : Sales, Intercompany
                    //     if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));//41100 Sales : Sales, 3rd Company
                    //     // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                    //     // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));
                    //     var newLine = customLines.addNewLine();
                    //     newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                    //     newLine.setLocationId(parseInt(currentLocation));
                    //     if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                    //     if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                    //     if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                    //     if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                    //     if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    //      newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));

                    // } 

                    //}
                }
            } else if (diff && instalacion == 'F' && installed == 'F') {

                // nlapiLogExecution("DEBUG", "instalacion -- diff", diff + '--' + instalacion + '--' + installed);
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    nlapiLogExecution("DEBUG", "currentAcc", currentAcc);
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    if (i > 0) {

                        var amountValue = 1;
                        // nlapiLogExecution("DEBUG", "amountValue---", amountValue);
                        if (currentAcc == configData.custrecord_sdb_cuenta_costo) { //51999 Cost of Sales : Cost of Sales, (Interim)

                            if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                                nlapiLogExecution("DEBUG", "custrecord_sdb_cuenta_costo if", standardLines.getLine(i).getCreditAmount());
                                var newLine = customLines.addNewLine();
                                newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                                newLine.setAccountId(parseInt(currentAcc));
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                amountValue = Number(standardLines.getLine(i).getCreditAmount());

                                var newLine = customLines.addNewLine();
                                newLine.setDebitAmount(amountValue);
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                                if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                            } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                                nlapiLogExecution("DEBUG", "custrecord_sdb_cuenta_costo else if", standardLines.getLine(i).getCreditAmount());
                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                                newLine.setAccountId(parseInt(currentAcc));
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                amountValue = Number(standardLines.getLine(i).getDebitAmount());

                                var newLine = customLines.addNewLine();
                                newLine.setDebitAmount(amountValue);
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                                if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));

                            }
                        } else if (currentAcc == configData.custrecord_sdb_inv_item_acc) {// Si la cuenta es puente ("41799 Sales : Sales, (Interim)) se balancea y se setea nueva linea con cuenta descuento (intercompany o terceros)

                            if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                                nlapiLogExecution("DEBUG", "custrecord_sdb_inv_item_acc  if", standardLines.getLine(i).getCreditAmount());
                                var newLine = customLines.addNewLine();
                                newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                                newLine.setAccountId(parseInt(currentAcc));
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                amountValue = Number(standardLines.getLine(i).getCreditAmount());

                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(amountValue);
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                                if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                                // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                                // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));
                            } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                                nlapiLogExecution("DEBUG", "custrecord_sdb_inv_item_acc  else if", standardLines.getLine(i).getCreditAmount());
                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                                newLine.setAccountId(parseInt(currentAcc));
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                amountValue = Number(standardLines.getLine(i).getDebitAmount());

                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(amountValue);
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                                if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                                // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                                // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));
                            }

                        } else {
                          
                            if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                                nlapiLogExecution("DEBUG", " else getCreditAmount", standardLines.getLine(i).getCreditAmount());
                                var newLine = customLines.addNewLine();//ERROR EN INVOICE SE cometa por eso
                                newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                                newLine.setAccountId(parseInt(currentAcc));
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                amountValue = Number(standardLines.getLine(i).getCreditAmount());
                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(amountValue);   //ERROR EN INVOICE SE cometa por eso
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cos_intercom));
                                if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_gasto_3ro));
                            } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                                nlapiLogExecution("DEBUG", " else getDebitAmount", standardLines.getLine(i).getDebitAmount());
                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));//ERROR EN INVOICE SE cometa por eso
                                newLine.setAccountId(parseInt(currentAcc));
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                amountValue = Number(standardLines.getLine(i).getDebitAmount());
                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(amountValue); 
                                if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cos_intercom));
                                if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_gasto_3ro));
                            }
                        }
                        //   } 
                    }
                }
                // nlapiSubmitField(recordType, rcdId, 'custbody_sdb_date_gl_plugin', 'T', true);
            } else if (!diff && instalacion == 'F') {
                nlapiLogExecution("DEBUG", "!diff && instalacion == 'F'", diff + '--' + instalacion);
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    //  if (i > 0) {

                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));

                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    }
                    // }
                }
            } else if (instalacion == 'T' && installed == 'F' && !diff) {// Verificar si esto de que necesite instalacion y no este instalada || !diff

                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();

                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    // if (i > 0) {
                    //Por el momento con esta condicion solo se balancea la invoice
                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0 /*&& currentAcc == ctaPuenteInv*/) {// Si la cuenta es puente ("41799 Sales : Sales, (Interim)) se balancea y se setea nueva linea con cuenta descuento (intercompany o terceros)
                        nlapiLogExecution("DEBUG", "if 1 >>", instalacion);
                        nlapiLogExecution("DEBUG", "currentAcc if 1 >>", currentAcc);
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setAccountId(parseInt(currentAcc));

                        /*  var newLine = customLines.addNewLine();
                          newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                          newLine.setLocationId(parseInt(currentLocation));
                          if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                          if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                          if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                          if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                          if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                          newLine.setAccountId(parseInt(venta_instalacion));*/
                        //if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                        //if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));

                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "if 2 >>", instalacion);
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setAccountId(parseInt(currentAcc));

                        /*   var newLine = customLines.addNewLine();
                           newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                           newLine.setLocationId(parseInt(currentLocation));
                           if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                           if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                           if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                           if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                           if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                           newLine.setAccountId(parseInt(venta_instalacion)); */
                        // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                        // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));
                    }
                    // }
                }
            } else if (instalacion == 'T' && installed == 'F' && diff) {// Verificar si esto de que necesite instalacion y no este instalada || !diff falsa

                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    if (!currentLocation) continue;
                    var entity = standardLines.getLine(i).getEntityId();
                    // if (i > 0) {

                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0 && currentAcc == ctaPuenteInv) {// Si la cuenta es puente ("41799 Sales : Sales, (Interim)) se balancea y se setea nueva linea con cuenta descuento (intercompany o terceros)
                        nlapiLogExecution("DEBUG", "if 1 diff>>", instalacion);

                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));

                        nlapiLogExecution("DEBUG", "standardLines.getLine(i).getCreditAmount())", standardLines.getLine(i).getCreditAmount());
                        nlapiLogExecution("DEBUG", "venta_instalacion", venta_instalacion);
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        // newLine.setAccountId(parseInt(venta_instalacion));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        // newLine.setAccountId(parseInt(venta_instalacion));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setAccountId(parseInt(venta_instalacion));


                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "if 2 diff>>", instalacion);
                        nlapiLogExecution("DEBUG", "standardLines.getLine(i).getCreditAmount())2", standardLines.getLine(i).getDebitAmount());
                        nlapiLogExecution("DEBUG", "currentAcc2", currentAcc);

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setAccountId(parseInt(venta_instalacion));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));

                    }
                    //}
                }
            }
        } catch (e) {
            nlapiLogExecution("ERROR", "ERROR invoice", e);
        }
    }
    //Credit Memo Logic
    if (recordType == "creditmemo") {

        try {

            var invAccount = transactionRecord.getFieldValue('account');
            var createdfrom = transactionRecord.getFieldValue('createdfrom');
            var validateDates = false;
            var configData = nlapiLookupField('customrecord_sdb_rcd_conf_plugin', 1, ['custrecord_sdb_is_3ros_acc', 'custrecord_sdb_adj_acc_puente', 'custrecordsdb_adj_a1', 'custrecord_sdb_inv_puente_acc', 'custrecord_sdb_inv_art_3ro', 'custrecord_sdb_inv_art_intercom', 'custrecord_sdb_inv_cos_intercom', 'custrecord_sdb_inv_gasto_3ro', 'custrecord_sdb_intercompany_acc_invoice', 'custrecord_sdb_cost_account', 'custrecord_sdb_cat_por_cobrar_inv', 'custrecord_sdb_inv_item_acc', 'custrecord_sdb_cuenta_costo', 'custrecord_sdb_inv_cost_ic', 'custrecord_sdb_art_account', 'custrecord_sdb_acc_expense', 'custrecord_sdb_inv_cost_3ro', 'custrecord_sdb_momento_vta_ci', 'custrecord_sdb_discount_puente', 'custrecord_sdb_discount_inter_acc', 'custrecord_sdb_discount_3ro_acc'])
            var isInterCompany = configData.custrecord_sdb_intercompany_acc_invoice;
            var terceros = configData.custrecord_sdb_is_3ros_acc;
            var invdata = getGlImpact('invoice', createdfrom);

            if (createdfrom) {
                installation = nlapiLookupField('invoice', createdfrom, ['custbody_sdb_requires_installation', 'createdfrom', 'shipdate', 'trandate']);
                //   if (installation.custbody_sdb_requires_installation == 'T') itemValuesList(installation.createdfrom, transactionRecord, true); nlapiLogExecution("AUDIT", "installation ", JSON.stringify(installation));
                if (installation && installation.shipdate) validateDates = installation.shipdate == installation.trandate;
                nlapiLogExecution("AUDIT", "validateDates ", validateDates);
            }
            //  nlapiLogExecution("AUDIT", "location ", JSON.stringify(configData));
            if (isInterCompany) {
                isInterCompany = isInterCompany.split(',').indexOf(invAccount);
            }
            if (terceros) {
                terceros = terceros.split(',').indexOf(invAccount);
            }

            nlapiLogExecution("DEBUG", "isInterCompany < > terceros", isInterCompany + '< >' + terceros);
            nlapiLogExecution("AUDIT", "standardLines.getCount() ", standardLines.getCount());
            //  nlapiLogExecution("AUDIT", "invdata.length ", invdata.length);
            for (var i = 0; i < standardLines.getCount(); i++) {
                var currentAcc = standardLines.getLine(i).getAccountId();
                var accType = nlapiLookupField('account', currentAcc, 'type');
                var locationline = standardLines.getLine(i).getLocationId();
                if (locationline) locationline = nlapiLookupField('location', locationline, 'name');
                var acclocation = returnAccounForLocation(locationline, configData)
                var entityCM = standardLines.getLine(i).getEntityId();
                // nlapiLogExecution("DEBUG", "entity ", entityCM);
                // if (i > 0) {
                var amountValue = 1;
                if (currentAcc == configData.custrecord_sdb_cuenta_costo) {//"51999 Cost of Sales : Cost of Sales, (Interim)"
                    // nlapiLogExecution("DEBUG", "currentAcc IF", currentAcc);
                    // nlapiLogExecution("DEBUG", "configData.custrecord_sdb_cuenta_costo IF", configData.custrecord_sdb_cuenta_costo);
                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "Costo creditmemo if", standardLines.getLine(i).getCreditAmount());
                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));

                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));//"51450 Cost of Sales : Cost of Sales, Intercompany",
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));

                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "Costo creditmemo elseif", standardLines.getLine(i).getDebitAmount());
                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));

                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));//"51450 Cost of Sales : Cost of Sales, Intercompany"
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                    }
                } else if (currentAcc == configData.custrecord_sdb_inv_item_acc) {// Si la cuenta es puente ("41799 Sales : Sales, (Interim)) se balancea y se setea nueva linea con cuenta descuento (intercompany o terceros)
                    // nlapiLogExecution("DEBUG", "currentAcc IF", currentAcc);
                    // nlapiLogExecution("DEBUG", "configData.custrecord_sdb_inv_item_acc IF", configData.custrecord_sdb_inv_item_acc);
                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "ART creditmemo if", standardLines.getLine(i).getCreditAmount());
                        // nlapiLogExecution("DEBUG", "acclocation IF. ", acclocation);
                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));

                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        //  newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));//41200 Sales : Sales, Intercompany
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));//41100 
                        // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                        // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));

                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "ART creditmemo elseif", standardLines.getLine(i).getDebitAmount());
                        // nlapiLogExecution("DEBUG", "acclocation IF. ", acclocation);
                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));

                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        //  newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));//41200 Sales : Sales, Intercompany
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        // if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_inter_acc));
                        // if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_discount_3ro_acc));
                        amountValue = Number(standardLines.getLine(i).getDebitAmount());
                    }

                } else if (currentAcc == configData.custrecord_sdb_adj_acc_puente) {//14101 Inventory : Inventory (Interim)
                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "Gasto creditmemo if", standardLines.getLine(i).getCreditAmount());
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        // newLine.setAccountId(parseInt(currentAcc));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getCreditAmount());
                        newLine.setAccountId(parseInt(currentAcc));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        // newLine.setAccountId(parseInt(currentAcc));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getCreditAmount());
                        newLine.setAccountId(parseInt(acclocation));// Ej: A1 "14100 Inventory : Inventory"

                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                        nlapiLogExecution("DEBUG", "Gasto creditmemo elseif", Number(standardLines.getLine(i).getDebitAmount()));
                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));

                        var newLine = customLines.addNewLine();
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(acclocation));// Ej: A1 "14100 Inventory : Inventory"
                        amountValue = Number(standardLines.getLine(i).getDebitAmount());
                    }
                }
                // }
            }
            var compareAcc = [configData.custrecord_sdb_momento_vta_ci, configData.custrecord_sdb_inv_art_3ro, configData.custrecord_sdb_inv_art_intercom, configData.custrecord_sdb_inv_gasto_3ro, configData.custrecord_sdb_inv_cos_intercom, configData.custrecord_sdb_inv_cost_ic, configData.custrecord_sdb_inv_cost_3ro]
            nlapiLogExecution("DEBUG", "invdata for CM", JSON.stringify(invdata));
            if (invdata && invdata.length && !validateDates) {
                for (var x = 0; x < invdata.length; x++) {
                    // nlapiLogExecution("audit", "invdata[x]", JSON.stringify(invdata[x]));
                    // nlapiLogExecution("audit", "custrecord_sdb_momento_vta_ci", configData.custrecord_sdb_momento_vta_ci);
                    //  if (invdata[x].account == configData.custrecord_sdb_momento_vta_ci || invdata[x].account == configData.custrecord_sdb_inv_art_3ro || invdata[x].account == configData.custrecord_sdb_inv_art_intercom || invdata[x].account == configData.custrecord_sdb_inv_gasto_3ro || invdata[x].account == configData.custrecord_sdb_inv_cos_intercom || invdata[x].account == configData.custrecord_sdb_inv_cost_ic || invdata[x].account == configData.custrecord_sdb_inv_cost_3ro) {
                    if (invdata[x].account && compareAcc.indexOf(invdata[x].account) != -1) {
                        if (invdata[x].debit) {
                            nlapiLogExecution("DEBUG", "INV data invdata[x].debit", invdata[x].accountNumber);
                            var newLine = customLines.addNewLine();
                            if (invdata[x].memo) newLine.setMemo(invdata[x].memo)
                            if (invdata[x].class) newLine.setClassId(parseInt(invdata[x].class));
                            if (invdata[x].department) newLine.setDepartmentId(parseInt(invdata[x].department));
                            if (invdata[x].name) newLine.setEntityId(parseInt(parseInt(invdata[x].name)))
                            if (invdata[x].segment) newLine.setSegmentValueId('cseg1', parseInt(invdata[x].segment));
                            newLine.setCreditAmount(Number(invdata[x].debit));
                            newLine.setAccountId(parseInt(invdata[x].account));
                        } else if (invdata[x].credit) {
                            nlapiLogExecution("DEBUG", "INV data invdata[x].credit number", invdata[x].accountNumber);

                            var newLine = customLines.addNewLine();
                            if (invdata[x].memo) newLine.setMemo(invdata[x].memo)
                            if (invdata[x].class) newLine.setClassId(parseInt(invdata[x].class));
                            if (invdata[x].department) newLine.setDepartmentId(parseInt(invdata[x].department));
                            if (invdata[x].name) newLine.setEntityId(parseInt(parseInt(invdata[x].name)))
                            if (invdata[x].segment) newLine.setSegmentValueId('cseg1', parseInt(invdata[x].segment));
                            newLine.setDebitAmount(Number(invdata[x].credit));
                            newLine.setAccountId(parseInt(invdata[x].account));
                        }
                    }
                }
            }
        } catch (e) {
            nlapiLogExecution("ERROR", "ERROR creditmemo", e);
        }
    }
    //Logic for Item Fulfillment
    if (recordType == 'itemfulfillment') {

        try {
            var shipstatus = transactionRecord.getFieldValue('shipstatus');
            var createdfrom = transactionRecord.getFieldValue('createdfrom');
            var trandate = transactionRecord.getFieldValue('trandate');
            var installation;
            var invoice;
            var invdata;
            var shipdate;
            var count = 0;
            nlapiLogExecution("AUDIT", "shipstatus", shipstatus);
            if (shipstatus != 'C') return;
            var items = itemListIf(rcdId, recordType)
            if (items) invoice = getShipDate(items, createdfrom)
            if (invoice.id) invdata = getGlImpact('invoice', invoice.id); shipdate = invoice.date;
            nlapiLogExecution("AUDIT", "shipdate inv", shipdate);
            nlapiLogExecution("AUDIT", "invdata", JSON.stringify(invdata));
            //nlapiLogExecution("AUDIT", "shipstatus", shipstatus);
            var validateDate = shipdate == trandate;
            nlapiLogExecution("AUDIT", "validateDate", validateDate);
            var installaded = transactionRecord.getFieldValue('custbody_sdb_if_installed');
            if (createdfrom) {
                installation = nlapiLookupField('salesorder', createdfrom, ['custbody_sdb_requires_installation']);
                // installaded = getInvoice(createdfrom);
            }
            nlapiLogExecution("AUDIT", "installation", installation.custbody_sdb_requires_installation);
            var customer = transactionRecord.getFieldValue('entity');
            var customerData = nlapiLookupField('customer', customer, ['custentity_sdb_posting_group'], 'T');

            // nlapiLogExecution("AUDIT", "customerData", customerData.custentity_sdb_posting_group);
            var configData = nlapiLookupField('customrecord_sdb_rcd_conf_plugin', 1, ['custrecord_sdb_momento_vta_ci', 'custrecord_sdb_adj_acc_puente', 'custrecord_sdb_3ro_acc_if', 'custrecord_sdb_intercompany_if', 'custrecord_sdb_adj_j1', 'custrecord_sdb_adj_tr1_tr2', 'custrecordsdb_adj_a1', 'custrecord_sdb_iac_location', 'custrecord_sdb_adj_ds', 'custrecord_sdb_is_3ros_acc', 'custrecord_sdb_inv_puente_acc', 'custrecord_sdb_inv_art_3ro', 'custrecord_sdb_inv_art_intercom', 'custrecord_sdb_inv_cos_intercom', 'custrecord_sdb_inv_gasto_3ro', 'custrecord_sdb_intercompany_acc_invoice', 'custrecord_sdb_cost_account', 'custrecord_sdb_cat_por_cobrar_inv', 'custrecord_sdb_inv_item_acc', 'custrecord_sdb_cuenta_costo', 'custrecord_sdb_inv_cost_ic', 'custrecord_sdb_art_account', 'custrecord_sdb_acc_expense', 'custrecord_sdb_inv_cost_3ro', 'custrecord_sdb_adj_iac', 'custrecord_sdb_discount_puente', 'custrecord_sdb_discount_inter_acc', 'custrecord_sdb_discount_3ro_acc'])
            var isInterCompany;
            var terceros;
            var interAccount = configData.custrecord_sdb_intercompany_if;
            var terceroAcount = configData.custrecord_sdb_3ro_acc_if;
            var costosAcc = [configData.custrecord_sdb_inv_cost_ic, configData.custrecord_sdb_inv_cost_3ro];
            var salesAcc = [configData.custrecord_sdb_inv_art_3ro, configData.custrecord_sdb_inv_art_intercom];
            var inv_data_to_set;
            if (customerData.custentity_sdb_posting_group) {
                isInterCompany = customerData.custentity_sdb_posting_group.indexOf('INTERCOMP');
                terceros = customerData.custentity_sdb_posting_group.indexOf('3RDCOMPANY');
            }
            // var typeAcc = isInterCompany > 0 ? interAccount : terceroAcount
            nlapiLogExecution("ERROR", "costosAcc", costosAcc);
            nlapiLogExecution("ERROR", "costosAcc.length", costosAcc.length);
            if (invdata) inv_data_to_set = fiterInvData(invdata, interAccount, terceroAcount);
            nlapiLogExecution("DEBUG", "inv_data_to_set", JSON.stringify(inv_data_to_set));
            nlapiLogExecution("DEBUG", "isInterCompany <> terceros", isInterCompany + '<>' + terceros);

            if (installaded == 'T') {/*IF  INSTALLED*/
                nlapiLogExecution("AUDIT", "installaded <><>", installaded);

                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var locationline = standardLines.getLine(i).getLocationId();
                    if (locationline) locationline = nlapiLookupField('location', locationline, 'name');
                    var acclocation = returnAccounForLocation(locationline, configData)
                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0 && configData.custrecord_sdb_cuenta_costo == currentAcc) {

                        //Prueba S/ insatll y agrego debajo lo instalado =====
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getCreditAmount());

                        var newLine = customLines.addNewLine();
                        if (isInterCompany != -1) newLine.setDebitAmount(amountValue);
                        if (terceros != -1) newLine.setDebitAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                        //======

                        nlapiLogExecution("AUDIT", "costo IF istalled ", configData.custrecord_sdb_cuenta_costo);
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        // newLine.setAccountId(parseInt(currentAcc));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getCreditAmount());

                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setLocationId(parseInt(configData.custrecord_sdb_iac_location));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));

                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0 && configData.custrecord_sdb_cuenta_costo == currentAcc) {
                        nlapiLogExecution("AUDIT", "costo else IF istalled ", configData.custrecord_sdb_cuenta_costo);
                        //Prueba S/ insatll y agrego debajo lo instalado ======
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getDebitAmount());

                        var newLine = customLines.addNewLine();
                        if (isInterCompany != -1) newLine.setDebitAmount(amountValue);
                        if (terceros != -1) newLine.setDebitAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                        //==================

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        // newLine.setAccountId(parseInt(currentAcc));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                        if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));

                        amountValue = Number(standardLines.getLine(i).getDebitAmount());
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setLocationId(parseInt(configData.custrecord_sdb_iac_location));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));

                    } else if (costosAcc.indexOf(currentAcc) != -1 && Number(standardLines.getLine(i).getDebitAmount())) {//Si es alguna de estas cuentas "51400 Cost of Sales : Cost of Sales, 3rd Company" || "51450 Cost of Sales : Cost of Sales, Intercompany"
                        nlapiLogExecution("ERROR", "costosAcc.indexOF(currentAcc)", costosAcc.indexOF(currentAcc));

                        //Prueba ----------------------------------
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getCreditAmount());
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        if (isInterCompany != -1) newLine.setAccountId(parseInt(acclocation));
                        if (terceros != -1) newLine.setAccountId(parseInt(acclocation));
                        //-----------------------
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac)); //14500 Inventory : Goods in 3rd party property  cuando esta instalado por completo

                    } else if (currentAcc == configData.custrecord_sdb_adj_acc_puente && acclocation) {// 14101 Inventory : Inventory (Interim)

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));

                            // //prueba --- No iria 
                            // var newLine = customLines.addNewLine();
                            // newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            // newLine.setAccountId(parseInt(currentAcc));
                            // newLine.setLocationId(parseInt(currentLocation));
                            // if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            // if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            // if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            // if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            // amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            // var newLine = customLines.addNewLine();
                            // newLine.setCreditAmount(amountValue);
                            // newLine.setLocationId(parseInt(currentLocation));
                            // if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            // if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            // if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            // if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            // if (acclocation) newLine.setAccountId(parseInt(acclocation));

                            // //
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                            // //Prueba --- No iria 
                            // var newLine = customLines.addNewLine();
                            // newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            // newLine.setAccountId(parseInt(currentAcc));
                            // newLine.setLocationId(parseInt(currentLocation));
                            // if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            // if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            // if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            // if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            // amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            // var newLine = customLines.addNewLine();
                            // newLine.setDebitAmount(amountValue);
                            // newLine.setLocationId(parseInt(currentLocation));
                            // if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            // if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            // if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            // if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            // if (acclocation) newLine.setAccountId(parseInt(acclocation));
                            // //
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        }

                    }

                    //Prueba
                    if (invdata && !validateDate) {
                        var dataForAcc = fiterInvData(invdata, configData.custrecord_sdb_inv_item_acc, null);
                    } else { continue; }
                    //if (!fiterInvData.arr && !fiterInvData.arr.length) continue;
                    if (count > 0) continue;
                    var hash = {};
                    dataForAcc = dataForAcc.filter(function (current) {
                        var exists = !hash[current.debit];
                        hash[current.debit] = true;
                        return exists;
                    });
                    nlapiLogExecution("DEBUG", "dataForAcc", JSON.stringify(dataForAcc));
                    for (var x = 0; x < dataForAcc.length; x++) {
                        // var newLine = customLines.addNewLine();
                        // newLine.setCreditAmount(dataForAcc[0].credit);
                        // newLine.setLocationId(parseInt(currentLocation));
                        // if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        // if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        // if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        // if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        // if (isInterCompany != -1 && configData.custrecord_sdb_inv_art_intercom) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                        // if (terceros != -1 && configData.custrecord_sdb_inv_art_3ro) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));

                        //Value setting item 2 TETING 5/5/23
                        nlapiLogExecution("DEBUG", "dataForAcc[x]>>>>>>", JSON.stringify(dataForAcc[x].debit));
                        var newLine = customLines.addNewLine();
                        // newLine.setCreditAmount(dataForAcc[x].debit);
                        newLine.setDebitAmount(dataForAcc[x].debit);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo('Testttt')//newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));

                        // if (isInterCompany != -1 && configData.custrecord_sdb_inv_art_intercom) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                        // if (terceros != -1 && configData.custrecord_sdb_inv_art_3ro) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                    }

                    if (!inv_data_to_set) continue;
                    nlapiLogExecution("DEBUG", "dataForAcc[x]", JSON.stringify(inv_data_to_set));
                    var newLine = customLines.addNewLine();
                    newLine.setCreditAmount(inv_data_to_set[0].debit);
                    newLine.setLocationId(parseInt(currentLocation));
                    if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                    if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                    if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                    //if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                    if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    nlapiLogExecution("AUDIT", "isInterCompany", isInterCompany);
                    nlapiLogExecution("AUDIT", "terceros", terceros);

                    // // interAccount = validateDate ? interAccount : configData.custrecord_sdb_inv_art_intercom;
                    // // terceroAcount = validateDate ? terceroAcount : configData.custrecord_sdb_inv_art_3ro;
                    if (isInterCompany != -1 && interAccount) newLine.setAccountId(parseInt(interAccount));
                    if (terceros != -1 && terceroAcount) newLine.setAccountId(parseInt(terceroAcount));
                    count++;
                }

                // Pasa la cuenta 41100 || 41200 a 25570 desde la invoice descoment 20/04
                // var result = invdata.filter(function (pos) {
                //     return (pos.debit == '' && (pos.account == salesAcc[0]|| salesAcc[1]));
                // });
                // nlapiLogExecution("AUDIT", "result", result);
                // if(result.length){
                // {
                //     "account": "3086",
                //     "debit": "",
                //     "credit": "850.00",
                //     "memo": "FASTENER,L8913L 20MM BLACK",
                //     "posting": "T",
                //     "location": "8",
                //     "subsidiary": "2",
                //     "class": "136",
                //     "department": "106",
                //     "name": "3905",
                //     "segment": "2",
                //     "accountName": "41200"
                // }
                //     for (var x = 0; x < result.length; x++) {

                //         //Value setting item 2
                //         var newLine = customLines.addNewLine();
                //         newLine.setCreditAmount(dataForAcc[x].debit);
                //         newLine.setLocationId(parseInt(esult[x].location));
                //         if (result[x].memo) newLine.setMemo(result[x].memo);
                //         if (result[x].class) newLine.setClassId(result[x].class);
                //         if (result[x].department) newLine.setDepartmentId(result[x].department);
                //         if (result[x].name) newLine.setEntityId(parseInt(result[x].name))
                //         if (result[x].segment) newLine.setSegmentValueId('cseg1', result[x].segment);
                //         newLine.setAccountId(parseInt(configData.custrecord_sdb_momento_vta_ci));
                //     }
                // }


            } else if (installation.custbody_sdb_requires_installation == 'F' && validateDate) {/*IF NOT requires_installation and IF TRANDATE == INVOICE TRANDATE*/
                for (var i = 0; i < standardLines.getCount(); i++) {

                    var currentAcc = standardLines.getLine(i).getAccountId();
                    nlapiLogExecution("ERROR", "currentAcc", currentAcc);
                    if (!currentAcc || i == 0) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    nlapiLogExecution("ERROR", "entity", entity);
                    nlapiLogExecution("ERROR", "accType<>", accType);
                    nlapiLogExecution("Audit", "cseg1", standardLines.getLine(0).getSegmentValueId('cseg1'))
                    var amountValue = 1;
                    // nlapiLogExecution("DEBUG", "amountValue---", amountValue);
                    //    if(i == 0) continue;
                    //  if (isInterCompany != -1) {
                    var locationline = standardLines.getLine(i).getLocationId();
                    if (locationline) locationline = nlapiLookupField('location', locationline, 'name');
                    var acclocation = returnAccounForLocation(locationline, configData)

                    if (currentAcc == configData.custrecord_sdb_cuenta_costo) {

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getCreditAmount custrecord_sdb_cuenta_costo", Number(standardLines.getLine(i).getCreditAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            if (isInterCompany != -1) newLine.setDebitAmount(amountValue);
                            if (terceros != -1) newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_cuenta_costo", Number(standardLines.getLine(i).getDebitAmount()));
                            nlapiLogExecution("DEBUG", "currentAcc", currentAcc);
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            if (isInterCompany != -1) newLine.setDebitAmount(amountValue);
                            if (terceros != -1) newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));
                        }
                    } else if (currentAcc == configData.custrecord_sdb_inv_item_acc /*|| articuloAcc.indexOf(currentAcc) != -1*/) {

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        }

                    } else if (currentAcc == configData.custrecord_sdb_adj_acc_puente && acclocation) {// 14101 Inventory : Inventory (Interim)

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));


                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        }

                    } else {

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "ELSE Gasto If", Number(standardLines.getLine(i).getCreditAmount()));
                            nlapiLogExecution("DEBUG", "currentAcc", currentAcc);
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            //if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cos_intercom));
                            //if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_gasto_3ro));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(acclocation));
                            if (terceros != -1) newLine.setAccountId(parseInt(acclocation));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "ELSE Gasto elseif", Number(standardLines.getLine(i).getCreditAmount()));
                            nlapiLogExecution("DEBUG", "currentAcc", currentAcc);
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());

                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));;
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(acclocation));
                            if (terceros != -1) newLine.setAccountId(parseInt(acclocation));
                        }
                    }
                    // }
                }
            } else if (installation.custbody_sdb_requires_installation == 'F' && !validateDate) { /*IF NOT requires_installation and IF TRANDATE != INVOICE TRANDATE */
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    nlapiLogExecution("ERROR", "currentAcc", currentAcc);
                    // if (!currentAcc || i == 0) continue;
                    if (!currentAcc) continue
                    nlapiLogExecution("DEBUG", "i", i);
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    nlapiLogExecution("ERROR", "accType", accType);
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var amountValue = 1;
                    // nlapiLogExecution("DEBUG", "amountValue---", amountValue);
                    if (i == 0) continue;
                    //  if (isInterCompany != -1) {
                    var locationline = standardLines.getLine(i).getLocationId();
                    if (locationline) locationline = nlapiLookupField('location', locationline, 'name');
                    var acclocation = returnAccounForLocation(locationline, configData)

                    if (currentAcc == configData.custrecord_sdb_cuenta_costo) {
                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getCreditAmount custrecord_sdb_cuenta_costo<>", Number(standardLines.getLine(i).getCreditAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));

                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {

                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_cuenta_costo<-->", Number(standardLines.getLine(i).getDebitAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (currentLocation) newLine.setLocationId(parseInt(currentLocation));
                            if (currentAcc) newLine.setAccountId(parseInt(currentAcc));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId())
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1 && configData.custrecord_sdb_inv_cost_ic) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_ic));
                            if (terceros != -1 && configData.custrecord_sdb_inv_cost_3ro) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cost_3ro));

                            //Value setting item 1
                            if (invdata) {
                                var dataForAcc = fiterInvData(invdata, configData.custrecord_sdb_inv_item_acc, null);
                            } else { continue; }
                            //if (!fiterInvData.arr && !fiterInvData.arr.length) continue;
                            if (count > 0) continue;
                            var hash = {};
                            dataForAcc = dataForAcc.filter(function (current) {
                                var exists = !hash[current.debit];
                                hash[current.debit] = true;
                                return exists;
                            });
                            nlapiLogExecution("DEBUG", "dataForAcc", JSON.stringify(dataForAcc));
                            for (var x = 0; x < dataForAcc.length; x++) {
                                // var newLine = customLines.addNewLine();
                                // newLine.setCreditAmount(dataForAcc[0].credit);
                                // newLine.setLocationId(parseInt(currentLocation));
                                // if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                // if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                // if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                // if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                // if (isInterCompany != -1 && configData.custrecord_sdb_inv_art_intercom) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                                // if (terceros != -1 && configData.custrecord_sdb_inv_art_3ro) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));

                                //Value setting item 2
                                var newLine = customLines.addNewLine();
                                newLine.setCreditAmount(dataForAcc[x].debit);
                                newLine.setLocationId(parseInt(currentLocation));
                                if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                                if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                                if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                                if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                                if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                                if (isInterCompany != -1 && configData.custrecord_sdb_inv_art_intercom) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                                if (terceros != -1 && configData.custrecord_sdb_inv_art_3ro) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                            }
                            if (!inv_data_to_set) continue;
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(inv_data_to_set[0].debit);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            //if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            nlapiLogExecution("AUDIT", "isInterCompany", isInterCompany);
                            nlapiLogExecution("AUDIT", "terceros", terceros);
                            if (isInterCompany != -1 && interAccount) newLine.setAccountId(parseInt(interAccount));
                            if (terceros != -1 && terceroAcount) newLine.setAccountId(parseInt(terceroAcount));
                            count++;
                            nlapiLogExecution("AUDIT", "terceroAcount<> " + count, terceroAcount);
                        }
                    } else if (currentAcc == configData.custrecord_sdb_inv_item_acc /*|| articuloAcc.indexOf(currentAcc) != -1*/) {

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            //   if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            //  if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_intercom));
                            if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_art_3ro));
                        }

                    } else if (currentAcc == configData.custrecord_sdb_adj_acc_puente && acclocation) {// 14101 Inventory : Inventory (Interim)

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        }

                    } else {

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "ELSE Gasto If !validateDate", Number(standardLines.getLine(i).getCreditAmount()));
                            nlapiLogExecution("DEBUG", "currentAcc", currentAcc);
                            nlapiLogExecution("DEBUG", "acclocation", acclocation);
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            //  if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            //   if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            //if (isInterCompany != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_cos_intercom));
                            //if (terceros != -1) newLine.setAccountId(parseInt(configData.custrecord_sdb_inv_gasto_3ro));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(acclocation));
                            if (terceros != -1) newLine.setAccountId(parseInt(acclocation));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "ELSE Gasto elseif", Number(standardLines.getLine(i).getCreditAmount()));
                            nlapiLogExecution("DEBUG", "currentAcc", currentAcc);
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());

                            // if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));;
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            //   if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (isInterCompany != -1) newLine.setAccountId(parseInt(acclocation));
                            if (terceros != -1) newLine.setAccountId(parseInt(acclocation));
                        }
                    }
                    // }
                }
            } else if (installation.custbody_sdb_requires_installation == 'T' && installaded == 'F' && validateDate) { /*IF requires_installation and NOT INSTALLED TRANDATE == INVOICE TRANDATE*/
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var locationline = standardLines.getLine(i).getLocationId();
                    if (locationline) locationline = nlapiLookupField('location', locationline, 'name');
                    var acclocation = returnAccounForLocation(locationline, configData)
                    /*if (Number(standardLines.getLine(i).getCreditAmount()) > 0 && configData.custrecord_sdb_cuenta_costo == currentAcc) {
                        nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getCreditAmount());

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setLocationId(parseInt(configData.custrecord_sdb_iac_location));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));
                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0 && configData.custrecord_sdb_cuenta_costo == currentAcc) {
                        nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getDebitAmount());

                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setLocationId(parseInt(configData.custrecord_sdb_iac_location));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));
                    } else */
                    if (currentAcc == configData.custrecord_sdb_adj_acc_puente && acclocation) {// 14101 Inventory : Inventory (Interim)

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        }

                    }
                }
            } else if (installation.custbody_sdb_requires_installation == 'T' && installaded == 'F' && !validateDate) { /*IF requires_installation and NOT INSTALLED TRANDATE != INVOICE TRANDATE*/
                nlapiLogExecution("DEBUG", 'validacion', 'IF requires_installation and NOT INSTALLED and TRANDATE != INVOICE TRANDATE');
                for (var i = 0; i < standardLines.getCount(); i++) {
                    var currentAcc = standardLines.getLine(i).getAccountId();
                    if (!currentAcc) continue;
                    var accType = nlapiLookupField('account', currentAcc, 'type');
                    var currentLocation = standardLines.getLine(i).getLocationId();
                    var entity = standardLines.getLine(i).getEntityId();
                    var locationline = standardLines.getLine(i).getLocationId();
                    if (locationline) locationline = nlapiLookupField('location', locationline, 'name');
                    var acclocation = returnAccounForLocation(locationline, configData)

                    if (Number(standardLines.getLine(i).getCreditAmount()) > 0 && configData.custrecord_sdb_cuenta_costo == currentAcc) {
                        nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));
                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getCreditAmount());

                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setLocationId(parseInt(configData.custrecord_sdb_iac_location));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));
                    } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0 && configData.custrecord_sdb_cuenta_costo == currentAcc) {
                        nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                        var newLine = customLines.addNewLine();
                        newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                        newLine.setAccountId(parseInt(currentAcc));
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        amountValue = Number(standardLines.getLine(i).getDebitAmount());

                        var newLine = customLines.addNewLine();
                        newLine.setDebitAmount(amountValue);
                        newLine.setLocationId(parseInt(currentLocation));
                        if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                        if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                        if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                        if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                        if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                        newLine.setLocationId(parseInt(configData.custrecord_sdb_iac_location));
                        newLine.setAccountId(parseInt(configData.custrecord_sdb_adj_iac));
                    } else if (currentAcc == configData.custrecord_sdb_adj_acc_puente && acclocation) {// 14101 Inventory : Inventory (Interim)

                        if (Number(standardLines.getLine(i).getCreditAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getCreditAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(Number(standardLines.getLine(i).getCreditAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getCreditAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        } else if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                            nlapiLogExecution("DEBUG", "getDebitAmount custrecord_sdb_inv_item_acc", Number(standardLines.getLine(i).getDebitAmount()));
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                            newLine.setAccountId(parseInt(currentAcc));
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            amountValue = Number(standardLines.getLine(i).getDebitAmount());

                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(amountValue);
                            newLine.setLocationId(parseInt(currentLocation));
                            if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                            if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                            if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                            if (entity && accType != 'AcctRec') newLine.setEntityId(parseInt(entity))
                            if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                            if (acclocation) newLine.setAccountId(parseInt(acclocation));
                        }

                    }
                }
            }

            var compareAcc = [configData.custrecord_sdb_inv_item_acc, configData.custrecord_sdb_intercompany_if, configData.custrecord_sdb_3ro_acc_if, configData.custrecord_sdb_momento_vta_ci, configData.custrecord_sdb_inv_art_3ro, configData.custrecord_sdb_inv_art_intercom, configData.custrecord_sdb_inv_gasto_3ro, configData.custrecord_sdb_inv_cos_intercom, configData.custrecord_sdb_inv_cost_ic, configData.custrecord_sdb_inv_cost_3ro]
            nlapiLogExecution("DEBUG", "invdata ", JSON.stringify(invdata));
            /* if (invdata && invdata.length ) {
                 for (var x = 0; x < invdata.length; x++) {
                     nlapiLogExecution("audit", "invdata[x]", JSON.stringify(invdata[x]));
 
                     // if (invdata[x].account == configData.custrecord_sdb_momento_vta_ci || invdata[x].account == configData.custrecord_sdb_inv_art_3ro || invdata[x].account == configData.custrecord_sdb_inv_art_intercom || invdata[x].account == configData.custrecord_sdb_inv_gasto_3ro || invdata[x].account == configData.custrecord_sdb_inv_cos_intercom || invdata[x].account == configData.custrecord_sdb_inv_cost_ic || invdata[x].account == configData.custrecord_sdb_inv_cost_3ro) {
                     if (invdata[x].account && compareAcc.indexOf(invdata[x].account) != -1) {
                         if (invdata[x].debit) {
                             //  nlapiLogExecution("DEBUG", "INV data invdata[x].debit", invdata[x].account);
                             var newLine = customLines.addNewLine();
                             if (invdata[x].memo) newLine.setMemo(invdata[x].memo)
                             if (invdata[x].class) newLine.setClassId(parseInt(invdata[x].class));
                             if (invdata[x].department) newLine.setDepartmentId(parseInt(invdata[x].department));
                             if (invdata[x].location) newLine.setLocationId(parseInt(invdata[x].location));
                             // if (invdata[x].name) newLine.setEntityId(parseInt(parseInt(invdata[x].name)))
                             if (invdata[x].segment) newLine.setSegmentValueId('cseg1', parseInt(invdata[x].segment));
                             newLine.setCreditAmount(Number(invdata[x].debit));
                             newLine.setAccountId(parseInt(invdata[x].account));
                         } else if (invdata[x].credit) {
                             // nlapiLogExecution("DEBUG", "INV data invdata[x].credit", invdata[x].account);
                             var newLine = customLines.addNewLine();
                             if (invdata[x].memo) newLine.setMemo(invdata[x].memo)
                             if (invdata[x].class) newLine.setClassId(parseInt(invdata[x].class));
                             if (invdata[x].department) newLine.setDepartmentId(parseInt(invdata[x].department));
                             if (invdata[x].location) newLine.setLocationId(parseInt(invdata[x].location));
                             // if (invdata[x].name) newLine.setEntityId(parseInt(parseInt(invdata[x].name)))
                             if (invdata[x].segment) newLine.setSegmentValueId('cseg1', parseInt(invdata[x].segment));
                             newLine.setDebitAmount(Number(invdata[x].credit));
                             newLine.setAccountId(parseInt(invdata[x].account));
                         }
                     }
                 }
 
             }*/
        } catch (e) {
            nlapiLogExecution("ERROR", "ERROR itemfulfillment", e);
        }
    }

    //Logic for  Vendor Prepayment
    if (recordType == 'vendorprepayment') {
        try {
            var currency = transactionRecord.getFieldText('currency');
            var configData = nlapiLookupField('customrecord_sdb_rcd_conf_plugin', 1, ['custrecord_sdb_ant_vendor_acc', 'custrecord_sdb_is_3ros_acc', 'custrecord_sdb_adj_acc_puente', 'custrecordsdb_adj_a1', 'custrecord_sdb_inv_puente_acc', 'custrecord_sdb_inv_art_3ro', 'custrecord_sdb_inv_art_intercom', 'custrecord_sdb_inv_cos_intercom', 'custrecord_sdb_inv_gasto_3ro', 'custrecord_sdb_intercompany_acc_invoice', 'custrecord_sdb_cost_account', 'custrecord_sdb_cat_por_cobrar_inv', 'custrecord_sdb_inv_item_acc', 'custrecord_sdb_cuenta_costo', 'custrecord_sdb_inv_cost_ic', 'custrecord_sdb_art_account', 'custrecord_sdb_acc_expense', 'custrecord_sdb_inv_cost_3ro', 'custrecord_sdb_momento_vta_ci', 'custrecord_sdb_discount_puente', 'custrecord_sdb_discount_inter_acc', 'custrecord_sdb_discount_3ro_acc'])

            nlapiLogExecution("AUDIT", "currency ", currency);
            if (currency != 'UYU') return;
            for (var i = 0; i < standardLines.getCount(); i++) {
                var currentAcc = standardLines.getLine(i).getAccountId();
                if (!currentAcc) continue;
                var accType = nlapiLookupField('account', currentAcc, 'type');

                var entityCM = standardLines.getLine(i).getEntityId();
                // nlapiLogExecution("DEBUG", "entity ", entityCM);
                if (Number(standardLines.getLine(i).getDebitAmount()) > 0) {
                    nlapiLogExecution("DEBUG", "debit ", standardLines.getLine(i).getDebitAmount());
                    var newLine = customLines.addNewLine();
                    if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                    if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                    if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                    if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                    if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    newLine.setCreditAmount(Number(standardLines.getLine(i).getDebitAmount()));
                    newLine.setAccountId(parseInt(currentAcc));

                    var newLine = customLines.addNewLine();
                    if (standardLines.getLine(i).getMemo()) newLine.setMemo(standardLines.getLine(i).getMemo())
                    if (standardLines.getLine(i).getClassId()) newLine.setClassId(standardLines.getLine(i).getClassId());
                    if (standardLines.getLine(i).getDepartmentId()) newLine.setDepartmentId(standardLines.getLine(i).getDepartmentId());
                    if (entityCM && accType != 'AcctRec') newLine.setEntityId(parseInt(entityCM))
                    if (standardLines.getLine(i).getSegmentValueId('cseg1')) newLine.setSegmentValueId('cseg1', standardLines.getLine(i).getSegmentValueId('cseg1'));
                    newLine.setDebitAmount(Number(standardLines.getLine(i).getDebitAmount()));
                    newLine.setAccountId(parseInt(configData.custrecord_sdb_ant_vendor_acc));//15150 Vendor Prepayments : Vendor Prepayments UYU

                }
            }

        } catch (e) {
            nlapiLogExecution("ERROR", "ERROR vendorprepayment", e);
        }
    }

    function getInvoice(id) {
        try {
            var invoiceSearch = nlapiSearchRecord("invoice", null,
                [
                    ["type", "anyof", "CustInvc"],
                    "AND",
                    ["createdfrom", "anyof", id],
                    "AND",
                    ["mainline", "is", "T"]
                ],
                [
                    new nlobjSearchColumn("invoicenum")
                ]
            );

            var impact = false;
            //  if (invoiceSearch) impact = itemValuesList(invoiceSearch[0].id, 'invoice', false);
        } catch (e) {
            nlapiLogExecution("ERROR", "getInvoice", getInvoice);
        }
        return impact
    }

    function itemValuesList(orderId, type, setLine) {
        try {
            nlapiLogExecution("AUDIT", "setLine", setLine);
            nlapiLogExecution("AUDIT", "type", type);
            nlapiLogExecution("AUDIT", "orderId", orderId);
            var installed = true;
            if (!setLine) {
                var order = nlapiLoadRecord(type, orderId);
                var itemCount = order.getLineItemCount("item") || 0;
                if (itemCount == 0) return false;
                nlapiLogExecution("DEBUG", "itemCount", itemCount);

                for (var t = 1; t <= itemCount; t++) {
                    var itemIntall = order.getLineItemValue('item', 'custcol_sdb_installed', t);
                    if (itemIntall == 'F' && !setLine) {
                        installed = false;
                        break;
                    }
                }
            } else {
                var soRcd = nlapiLoadRecord('salesorder', orderId);
                var itemCount = type.getLineItemCount("item") || 0;
                nlapiLogExecution("AUDIT", "itemCount-1", itemCount);
                nlapiLogExecution("AUDIT", "itemCount-2", soRcd.getLineItemCount("item"));
                for (var x = 1; x <= itemCount; x++) {
                    // var itemIntall = type.getLineItemValue('item', 'custcol_sdb_installed', x);
                    // type.setLineItemValue('item', 'custcol_sdb_installed', x, 'T');
                    soRcd.setLineItemValue('item', 'custcol_sdb_installed', x, 'T');
                    nlapiCommitLineItem('item');
                    nlapiLogExecution("AUDIT", "itemCount-2", soRcd.getLineItemValue("item", 'custcol_sdb_installed', x));
                }
                var id = nlapiSubmitRecord(soRcd, true, true);
                nlapiLogExecution("AUDIT", "Saved SO", id);
            }
        } catch (e) {
            nlapiLogExecution("ERROR", "ERROR in  itemValuesList", e);
        }
        nlapiLogExecution("DEBUG", "installed itemValuesList", installed);
        return installed
    }

    function itemListIf(id, type) {
        try {
            nlapiLogExecution("AUDIT", "type", type);
            nlapiLogExecution("AUDIT", "id", id);
            var arrItems = [];
            var installed = true;

            var order = nlapiLoadRecord(type, id);
            var itemCount = order.getLineItemCount("item") || 0;
            if (itemCount == 0) return false;
            nlapiLogExecution("DEBUG", "itemCount", itemCount);

            for (var t = 1; t <= itemCount; t++) {
                var item = order.getLineItemValue('item', 'item', t);
                var checked = order.getLineItemValue('item', 'itemreceive', t);
                if (checked == 'T') arrItems.push(item)
            }

        } catch (e) {
            nlapiLogExecution("ERROR", "ERROR in  itemListIf", e);
        }
        return arrItems
    }

    function returnAccounForLocation(locationline, configData) {
        var location;
        //nlapiLogExecution("DEBUG", "installed configData", JSON.stringify(configData));
        switch (locationline) {
            case "A1":
                location = configData.custrecordsdb_adj_a1
                break;
            case "A2":
                location = configData.custrecordsdb_adj_a1
                break;
            case "TR1":
                location = configData.custrecord_sdb_adj_tr1_tr2
                break;
            case "TR2":
                location = configData.custrecord_sdb_adj_tr1_tr2
                break;
            case "J1":
                location = configData.custrecord_sdb_adj_j1
                break;
            case "DS":
                location = configData.custrecord_sdb_adj_ds
                break;
            case "IAC":
                location = configData.custrecord_sdb_adj_iac
                break;
        }
        //  nlapiLogExecution("DEBUG", "location -- locationId", locationline + '--' + location);
        return location
    }

    function getShipDate(item, cretaefrom) {

        try {
            var date = '';
            var obj = {};
            var invoiceSearch = nlapiSearchRecord("invoice", null,
                [
                    ["type", "anyof", "CustInvc"],
                    "AND",
                    ["item", "anyof", item],
                    "AND",
                    ["createdfrom", "anyof", cretaefrom]
                ],
                [
                    new nlobjSearchColumn("shipdate"),
                    new nlobjSearchColumn("trandate"),
                    new nlobjSearchColumn("entity")
                ]
            );
            if (invoiceSearch) {
                obj.date = invoiceSearch[0].getValue('trandate');
                obj.id = invoiceSearch[0].id
                obj.customer = invoiceSearch[0].getValue('entity');
            }
            return obj
        } catch (e) {
            nlapiLogExecution("ERROR", "getShipDate", e);
        }
    }

    function fiterInvData(arr, inter, tercero) {
        try {
            var result = arr.filter(function (pos) {
                return (pos.account == inter || pos.account == tercero) && pos.debit;
            });

        } catch (e) {
            nlapiLogExecution("ERROR", "fiterInvData", e);
        }
        return result
    }

    function getGlImpact(recordType, recordId) {
        try {
            var results = nlapiSearchRecord(recordType, null, [
                new nlobjSearchFilter('internalid', null, 'anyof', recordId)
            ], [
                new nlobjSearchColumn('internalid', 'account'),
                new nlobjSearchColumn('number', 'account'),
                new nlobjSearchColumn('debitamount'),
                new nlobjSearchColumn('creditamount'),
                new nlobjSearchColumn('memo'),
                new nlobjSearchColumn('posting'),
                new nlobjSearchColumn('subsidiary'),
                new nlobjSearchColumn('location'),
                new nlobjSearchColumn('department'),
                new nlobjSearchColumn('class'),
                new nlobjSearchColumn('entity'),
                new nlobjSearchColumn('cseg1')
            ]);

            return (results || []).map(function (line) {
                return {
                    account: line.getValue('internalid', 'account'),
                    accountNumber: line.getValue('number', 'account'),
                    debit: line.getValue('debitamount'),
                    credit: line.getValue('creditamount'),
                    memo: line.getValue('memo'),
                    posting: line.getValue('posting'),
                    location: line.getValue('location'),
                    subsidiary: line.getValue('subsidiary'),
                    class: line.getValue('class'),
                    department: line.getValue('department'),
                    name: line.getValue('entity'),
                    segment: line.getValue('cseg1')
                };
            });
        } catch (e) {
            nlapiLogExecution("ERROR", "getGlImpact inv", e);
        }
    }
}




